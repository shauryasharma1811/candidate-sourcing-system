from app.core.security import hash_password, verify_password


def test_password_hash_roundtrip():
    hashed = hash_password("S3cret!")
    assert verify_password("S3cret!", hashed)
    assert not verify_password("wrong", hashed)
