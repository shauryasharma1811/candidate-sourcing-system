from app.common.enums import ScanStatus
from app.services.virus_scan_service import scan


def test_clean_file_passes():
    result = scan(b"%PDF-1.4 ordinary resume content", "resume.pdf")
    assert result.status == ScanStatus.CLEAN
    assert result.is_clean


def test_eicar_signature_is_flagged_infected():
    eicar = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    result = scan(eicar, "resume.pdf")
    assert result.status == ScanStatus.INFECTED
    assert not result.is_clean


def test_eicar_signature_flagged_even_when_surrounded_by_other_bytes():
    eicar = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    result = scan(b"garbage-before" + eicar + b"garbage-after", "resume.pdf")
    assert result.status == ScanStatus.INFECTED
