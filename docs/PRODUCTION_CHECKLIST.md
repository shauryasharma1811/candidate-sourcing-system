# Production Deployment Checklist

Work through this before pointing real traffic at the stack, and again
before each major release. Items are grouped so you can assign/track them
independently.

## Secrets & environment

- [ ] `backend/.env.production` created (not committed) with every `CHANGE_ME` filled in
- [ ] `JWT_SECRET_KEY` is a fresh `openssl rand -hex 32` value — not reused from dev/staging
- [ ] `POSTGRES_PASSWORD` is a generated 32+ char secret, matches in both `POSTGRES_PASSWORD` and `DATABASE_URL`
- [ ] `S3_*` credentials point at the production bucket, scoped to least privilege (put/get/delete on that bucket only — not full account access)
- [ ] `SMTP_*` points at a real transactional email provider (SES/Postmark/SendGrid), not a test inbox
- [ ] `CORS_ORIGINS` lists only the real production frontend origin(s) — no `localhost`, no wildcard
- [ ] `DEBUG=false` and `APP_ENV=production` (this also disables `/docs`, `/redoc`, `/openapi.json`)
- [ ] `frontend/.env.production` has `NEXT_PUBLIC_API_BASE_URL` set to the real API URL and was present at **build** time (it's baked in, not runtime-configurable)
- [ ] Secrets live in GitHub Actions Secrets / a secrets manager — never in git history (check with `git log -p -- '*.env*'` on the repo before going live)

## Database

- [ ] Alembic migrations run cleanly against a fresh production-shaped DB (`alembic upgrade head`)
- [ ] `alembic upgrade head` runs automatically as part of deploy, **before** new backend containers take traffic
- [ ] Automated daily backups configured and verified to actually contain data (`deploy/README.md` §6)
- [ ] Backups shipped off-box, not just stored on the same VM
- [ ] A restore has actually been tested once, not just assumed to work
- [ ] Connection pool sized sensibly for `--workers 4` × however many backend replicas (SQLAlchemy default pool is fine to start; revisit if you see connection exhaustion under load)

## Storage (resumes)

- [ ] Production S3 bucket is **private** (no public read) — access is only via the app's short-lived signed URLs
- [ ] Bucket lifecycle policy matches `RESUME_RETENTION_DAYS` (the app sets this at startup via `ensure_bucket_lifecycle_policy`, but verify it actually took effect: check the bucket's lifecycle rules in your provider's console)
- [ ] If self-hosting MinIO instead of managed S3: `minio_data` volume is included in backup strategy too, not just Postgres

## HTTPS / nginx

- [ ] Domain DNS points at the server before requesting certs
- [ ] Real domain substituted for `your-domain.com` in `deploy/nginx/conf.d/candidate-sourcing.conf`
- [ ] Let's Encrypt cert issued successfully (`deploy/README.md` §2) and `https://your-domain.com` loads with a valid cert (check with `curl -vI` or an SSL Labs scan)
- [ ] HTTP → HTTPS redirect confirmed (`curl -I http://your-domain.com` returns 301)
- [ ] Certbot renewal cron/timer in place and nginx reload wired to it — don't find out about expiry when the site goes down
- [ ] `client_max_body_size` in nginx (8m) comfortably exceeds `MAX_UPLOAD_SIZE_MB` (5MB) with headroom for multipart overhead
- [ ] Rate limits on `/api/v1/auth/*` tuned for real traffic (5r/m per IP is a starting point — watch for false positives from office NATs)
- [ ] Security headers present in responses (HSTS, X-Frame-Options, CSP) — verify with `curl -I`

## Application security

- [ ] `/docs`, `/redoc`, `/openapi.json` return 404 in production (confirms `APP_ENV=production` took effect)
- [ ] Admin accounts are seeded directly (per `AUTH.md`), never via a public registration endpoint
- [ ] No secrets or PII appear in application logs (spot-check: trigger a login failure, a resume upload, a 500 error, and grep the logs)
- [ ] Dependency vulnerability scan run on `requirements.txt` / `package.json` (`pip-audit`, `npm audit`, or GitHub Dependabot alerts enabled on the repo)

## CI/CD

- [ ] `ci.yml` is required to pass before merge (branch protection rule on `main`)
- [ ] Coverage gate (`--cov-fail-under=80`) matches the project contract's stated target
- [ ] `deploy.yml`'s `production` GitHub Environment has required reviewers configured, if you want a human in the loop before prod deploys
- [ ] Deploy SSH key belongs to a **non-root** user with docker group membership only — not broad sudo
- [ ] A deploy has been rolled back at least once in a non-emergency, so the rollback steps in `deploy/README.md` §5 are proven, not just written

## Observability

- [ ] `GET /health` (backend) and nginx's `/healthz` are wired into whatever uptime monitor you use (UptimeRobot, Better Stack, etc.)
- [ ] Container logs are retained somewhere durable, not just `docker compose logs` on a single VM (ship to a log service, or at minimum configure Docker's log rotation so disk doesn't fill up)
- [ ] Alerting exists for: site down, backend unhealthy, disk >85% full, TLS cert expiring within 14 days
- [ ] Error tracking (Sentry or similar) wired into the backend for unhandled exceptions — the current global handler only formats `HTTPException`s; anything else currently 500s with no structured record

## Performance / capacity

- [ ] Gunicorn worker count (`--workers 4`) matches the VM's actual CPU count — tune per Gunicorn's `(2 × cores) + 1` guidance
- [ ] Database indexes present for the query patterns actually used (search/filter on jobs, pagination) — covered by the Sprint 0 schema's GIN/partial indexes; re-verify with `EXPLAIN ANALYZE` on slow endpoints if load testing surfaces anything
- [ ] Basic load test run against a staging copy of this stack before the real launch (even a simple `hey`/`k6` script against `/api/v1/jobs` and the login endpoint) — validates both app performance and the nginx rate limits aren't so tight they block real usage patterns

## Legal / compliance (BRD-adjacent, not code)

- [ ] Candidate consent checkbox copy reviewed by whoever owns privacy policy for this org
- [ ] `RESUME_RETENTION_DAYS` matches whatever retention period is actually promised to candidates
- [ ] A data-deletion request process exists for candidates who ask to be removed (not automated by this codebase today — track as a follow-up if needed)

## Final go-live check

- [ ] Full candidate journey walked through manually against production (or a production-identical staging env): browse → register → apply → upload resume → submit → confirmation email arrives
- [ ] Full admin journey walked through manually: login → create requisition → publish → see application in grid → download resume → update status → candidate sees status change
- [ ] `docker compose -f docker-compose.prod.yml ps` shows every service healthy
- [ ] Team knows where the runbook (`deploy/README.md`) lives before anyone needs it at 2am
