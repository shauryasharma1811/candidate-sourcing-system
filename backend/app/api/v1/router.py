from fastapi import APIRouter

from app.api.v1.routes import applications, auth, candidate, dashboard, jobs, notifications, requisitions, storage

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(dashboard.router)
api_router.include_router(requisitions.router)
api_router.include_router(candidate.router)
api_router.include_router(applications.candidate_router)
api_router.include_router(applications.admin_router)
api_router.include_router(notifications.router)
api_router.include_router(storage.router)
