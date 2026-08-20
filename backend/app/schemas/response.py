from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str
    data: T | None = None
    meta: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    errors: list[dict[str, Any]] = []
