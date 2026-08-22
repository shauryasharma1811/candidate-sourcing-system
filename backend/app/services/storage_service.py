"""
S3-compatible object storage. This is the ONLY module that touches boto3 —
services call `storage_service.upload(...)` and get back an internal
object key, never a raw path or URL (storage paths are never exposed to
API clients, per contract).
"""
import logging
import uuid

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

logger = logging.getLogger(__name__)


def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )


def build_object_key(candidate_id: uuid.UUID, original_name: str) -> str:
    ext = "." + original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    return f"resumes/{candidate_id}/{uuid.uuid4()}{ext}"


def upload_resume(file: UploadFile, object_key: str) -> None:
    try:
        _client().upload_fileobj(
            file.file,
            settings.S3_BUCKET_NAME,
            object_key,
            ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("Resume upload failed for key %s: %s", object_key, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't store the resume. Please try again.")


def delete_resume(object_key: str) -> None:
    try:
        _client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
    except (BotoCoreError, ClientError) as exc:
        # Best-effort cleanup — don't fail the caller's request over it.
        logger.warning("Resume delete failed for key %s: %s", object_key, exc)


def build_photo_object_key(candidate_id: uuid.UUID, original_name: str) -> str:
    ext = "." + original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    return f"profile-photos/{candidate_id}/{uuid.uuid4()}{ext}"


def upload_photo(file: UploadFile, object_key: str) -> None:
    try:
        _client().upload_fileobj(
            file.file,
            settings.S3_BUCKET_NAME,
            object_key,
            ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("Photo upload failed for key %s: %s", object_key, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't store the photo. Please try again.")


def delete_photo(object_key: str) -> None:
    try:
        _client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
    except (BotoCoreError, ClientError) as exc:
        logger.warning("Photo delete failed for key %s: %s", object_key, exc)


def get_presigned_download_url(
    object_key: str, download_filename: str, mime_type: str | None = None, expires_in: int | None = None
) -> str:
    """Short-lived signed URL for a recruiter to download a resume.
    Storage paths/keys are never exposed to API clients directly — only
    this time-limited URL is, per contract.

    Secure-download hardening: the response's Content-Disposition is
    forced to `attachment` (never opens inline in the browser, so a
    crafted file can't execute as HTML/script in the recruiter's
    session), and the Content-Type is pinned to the mime type recorded
    at upload time rather than trusting whatever's stored in S3 —
    closing off MIME-sniffing tricks from a renamed file.
    """
    params = {
        "Bucket": settings.S3_BUCKET_NAME,
        "Key": object_key,
        "ResponseContentDisposition": f'attachment; filename="{download_filename}"',
    }
    if mime_type:
        params["ResponseContentType"] = mime_type

    try:
        return _client().generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expires_in or settings.RESUME_DOWNLOAD_URL_TTL_SECONDS,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("Failed to presign download for key %s: %s", object_key, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't generate a resume download link. Please try again.")


def ensure_bucket_lifecycle_policy() -> None:
    """Storage-layer backstop for the retention policy: an S3/MinIO
    bucket lifecycle rule that expires objects under `resumes/` after
    settings.RESUME_RETENTION_DAYS, independent of whether the app-level
    purge job (retention_service.purge_expired_resumes) ever runs.

    Called once at startup (see main.py). Best-effort: some S3-compatible
    backends or credentials don't support lifecycle configuration, and
    that must never prevent the API from starting — the app-level purge
    job still enforces the same policy either way.
    """
    try:
        _client().put_bucket_lifecycle_configuration(
            Bucket=settings.S3_BUCKET_NAME,
            LifecycleConfiguration={
                "Rules": [
                    {
                        "ID": "resume-retention-policy",
                        "Status": "Enabled",
                        "Filter": {"Prefix": "resumes/"},
                        "Expiration": {"Days": settings.RESUME_RETENTION_DAYS},
                    }
                ]
            },
        )
        logger.info(
            "Resume bucket lifecycle policy applied: expire after %s days", settings.RESUME_RETENTION_DAYS
        )
    except (BotoCoreError, ClientError) as exc:
        logger.warning("Couldn't apply bucket lifecycle policy (continuing without it): %s", exc)
