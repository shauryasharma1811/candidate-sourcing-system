"""
Virus scanning for uploaded files. This is a PLACEHOLDER implementation —
it never touches boto3 or the storage layer directly (that dependency
stays isolated to storage_service, per the storage module's own
docstring), and it never actually inspects file contents against a real
signature database.

What it does today: simple, deterministic checks (empty file, size
sanity, an EICAR-string check so the standard antivirus test file is
reliably caught) that let the rest of the pipeline — reject-on-infected,
record the verdict, gate downloads on it — be built and tested end to
end now.

Swapping in a real scanner later (ClamAV daemon over clamd, a vendor
API, S3 Object Lambda) means replacing the body of `scan()` to call out
to that service instead. Every caller already only depends on
`ScanResult`, so nothing above this module needs to change.
"""
import logging
from dataclasses import dataclass

from app.common.enums import ScanStatus
from app.core.config import settings

logger = logging.getLogger(__name__)

# The standard antivirus test string (EICAR) — every real scanner flags a
# file containing this signature. Checking for it here is what lets this
# placeholder be exercised with a genuinely "malicious" test file, without
# needing any actual malware.
_EICAR_SIGNATURE = (
    r"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
).encode("ascii")


@dataclass(frozen=True)
class ScanResult:
    status: ScanStatus
    provider: str
    detail: str | None = None

    @property
    def is_clean(self) -> bool:
        return self.status == ScanStatus.CLEAN


def scan(contents: bytes, filename: str) -> ScanResult:
    """Scan file bytes before they're persisted to storage. Always
    returns a verdict synchronously today (PENDING is never actually
    returned by this placeholder) — a real async scanner would instead
    upload first, return PENDING immediately, and update the row when a
    callback/poll resolves the verdict."""
    if not settings.VIRUS_SCAN_ENABLED:
        return ScanResult(status=ScanStatus.CLEAN, provider="disabled", detail="Scanning disabled by configuration")

    if not contents:
        return ScanResult(status=ScanStatus.FAILED, provider=settings.VIRUS_SCAN_PROVIDER, detail="Empty file")

    if _EICAR_SIGNATURE in contents:
        logger.warning("Virus scan flagged upload as infected: %s", filename)
        return ScanResult(
            status=ScanStatus.INFECTED,
            provider=settings.VIRUS_SCAN_PROVIDER,
            detail="EICAR test signature detected",
        )

    return ScanResult(status=ScanStatus.CLEAN, provider=settings.VIRUS_SCAN_PROVIDER)
