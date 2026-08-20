import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.password_reset_token import PasswordResetToken
from app.repositories.base import BaseRepository

RESET_TOKEN_TTL_MINUTES = 30


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


class PasswordResetTokenRepository(BaseRepository[PasswordResetToken]):
    def __init__(self, db: Session):
        super().__init__(PasswordResetToken, db)

    def create_for_user(self, user_id: uuid.UUID, raw_token: str) -> PasswordResetToken:
        token = PasswordResetToken(
            user_id=user_id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
        )
        return self.create(token)

    def get_valid_by_raw_token(self, raw_token: str) -> PasswordResetToken | None:
        token = self.db.query(PasswordResetToken).filter(
            PasswordResetToken.token_hash == hash_token(raw_token)
        ).first()
        if token and token.is_valid:
            return token
        return None

    def mark_used(self, token: PasswordResetToken) -> None:
        token.used_at = datetime.now(timezone.utc)
        self.update(token)
