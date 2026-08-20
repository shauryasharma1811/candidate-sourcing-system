from pydantic import BaseModel


class DashboardStatsResponse(BaseModel):
    published_jobs: int
    draft_jobs: int
    closed_jobs: int
    total_applications: int
    new_applications: int
