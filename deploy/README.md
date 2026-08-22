# Deployment Runbook

Target setup: a single Linux VM (2 vCPU / 4GB RAM is enough to start)
running Docker + Docker Compose, fronted by nginx for TLS termination.
Scale out later by moving Postgres/MinIO to managed services and running
`backend`/`frontend` on multiple hosts behind a load balancer — the app
itself is already stateless (JWT auth, no server-side sessions).

## 1. One-time server setup

```bash
# Docker + Compose plugin (Ubuntu 22.04/24.04)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in after this

sudo mkdir -p /opt/candidate-sourcing-system
sudo chown $USER:$USER /opt/candidate-sourcing-system
cd /opt/candidate-sourcing-system
git clone <your-repo-url> .

cp backend/.env.production.example backend/.env.production
cp frontend/.env.production.example frontend/.env.production
# Edit both files now — fill in every CHANGE_ME. See the Production
# Checklist for what "done" looks like for each value.
```

Point your domain's DNS `A`/`AAAA` records at the server's IP before
continuing — Let's Encrypt validates ownership over HTTP.

## 2. First-time TLS certificate issuance

nginx's HTTPS server block (`deploy/nginx/conf.d/candidate-sourcing.conf`)
references certs that don't exist yet, so nginx won't start cleanly until
they do. Bring nginx up with a temporary HTTP-only config, issue the
cert, then switch to the real config:

```bash
# Replace your-domain.com everywhere in the nginx conf first:
sed -i 's/your-domain.com/YOUR-ACTUAL-DOMAIN/g' deploy/nginx/conf.d/candidate-sourcing.conf

# Start everything except nginx so certbot has something to validate against
# isn't required — certbot's webroot plugin just needs a running webserver
# on port 80 serving /var/www/certbot. Start nginx with only the :80
# server block active (comment out the 443 block on first run), then:
docker compose -f docker-compose.prod.yml up -d db minio backend frontend nginx

docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d YOUR-ACTUAL-DOMAIN -d www.YOUR-ACTUAL-DOMAIN \
  --email you@example.com --agree-tos --no-eff-email

# Uncomment the 443 server block (if you commented it out) and reload:
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

The `certbot` service in `docker-compose.prod.yml` then keeps renewing
automatically every 12h (certbot itself no-ops unless a cert is within
30 days of expiry). Add a small cron/systemd timer on the host to reload
nginx after renewal, since certbot renewing the cert on disk doesn't
itself make nginx re-read it:

```cron
0 3 * * * docker compose -f /opt/candidate-sourcing-system/docker-compose.prod.yml exec nginx nginx -s reload
```

## 3. Steady-state deploys

Handled by `.github/workflows/deploy.yml` on every push to `main`:
build → push to GHCR → SSH in → pull → run migrations → swap containers →
health-check → done. To do the same thing manually:

```bash
cd /opt/candidate-sourcing-system
git pull origin main
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend nginx
docker compose -f docker-compose.prod.yml logs -f backend   # watch it come up healthy
```

## 4. GitHub Actions secrets required

Set these under Repo Settings → Secrets and variables → Actions, and
create a `production` Environment (Settings → Environments) if you want
manual-approval gating before deploys run:

| Secret | Used for |
|---|---|
| `PROD_SSH_HOST` | server IP/hostname |
| `PROD_SSH_USER` | deploy user (not root — see checklist) |
| `PROD_SSH_PRIVATE_KEY` | key with access to that user, no passphrase (Actions can't prompt for one) |
| `NEXT_PUBLIC_API_BASE_URL` | baked into the frontend build, e.g. `https://your-domain.com/api/v1` |

`GITHUB_TOKEN` (for pushing to GHCR) is provided automatically — no setup needed.

## 5. Rollback

Every deploy is tagged with the short commit SHA in GHCR
(`ghcr.io/<repo>/backend:<sha>`), and `:latest` always points at the most
recent successful deploy. To roll back:

```bash
export IMAGE_TAG=<previous-good-sha>
export BACKEND_IMAGE=ghcr.io/<repo>/backend:$IMAGE_TAG
export FRONTEND_IMAGE=ghcr.io/<repo>/frontend:$IMAGE_TAG
docker compose -f docker-compose.prod.yml pull backend frontend
docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend
```

If the rollback also needs a DB migration reverted:
`docker compose -f docker-compose.prod.yml run --rm backend alembic downgrade -1`
— check the migration is actually safely reversible first (see
`backend/alembic/versions/`); not all of them are.

## 6. Database backups

`docker-compose.prod.yml` mounts `./deploy/postgres/backups` into the
`db` container. A minimal daily dump via host cron:

```cron
0 2 * * * docker compose -f /opt/candidate-sourcing-system/docker-compose.prod.yml exec -T db \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /opt/candidate-sourcing-system/deploy/postgres/backups/$(date +\%F).sql.gz
30 2 * * * find /opt/candidate-sourcing-system/deploy/postgres/backups -name '*.sql.gz' -mtime +30 -delete
```

Ship those off-box (S3/Spaces `aws s3 sync`, `rclone`, etc.) — a backup
that lives only on the machine it's backing up isn't a backup.
