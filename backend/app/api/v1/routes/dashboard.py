from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_role
from app.common.enums import UserRole
from app.db.session import get_db
from app.schemas.response import SuccessResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/admin/dashboard",
    tags=["dashboard (admin)"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("/stats", response_model=SuccessResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    stats = DashboardService(db).get_stats()
    return SuccessResponse(message="Dashboard stats retrieved", data=stats)
