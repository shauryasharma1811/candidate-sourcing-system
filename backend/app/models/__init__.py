"""
Import all models here so Alembic autogenerate and Base.metadata
can discover every table.
"""
from app.models.user import User          # noqa: F401
from app.models.admin import Admin        # noqa: F401
from app.models.candidate import Candidate, Education, Experience  # noqa: F401
from app.models.job import Job            # noqa: F401
from app.models.resume import Resume      # noqa: F401
from app.models.application import Application  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.password_reset_token import PasswordResetToken  # noqa: F401
