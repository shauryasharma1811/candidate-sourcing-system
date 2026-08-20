from fastapi import APIRouter

from app.api.v1.routes import applications, auth, dashboard, jobs, notifications, requisitions

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(dashboard.router)
api_router.include_router(requisitions.router)
api_router.include_router(applications.candidate_router)
api_router.include_router(applications.admin_router)
api_router.include_router(notifications.router)
