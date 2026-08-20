from pydantic import BaseModel


class PaginatedMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
