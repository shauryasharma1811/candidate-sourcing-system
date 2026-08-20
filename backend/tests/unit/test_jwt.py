from datetime import timedelta

from app.core.security import create_access_token, create_refresh_token, create_token, decode_token


def test_access_token_roundtrip():
    token = create_access_token(subject="user-123", role="Candidate")
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert payload["role"] == "Candidate"


def test_refresh_token_roundtrip():
    token = create_refresh_token(subject="user-123")
    payload = decode_token(token)
    assert payload is not None
    assert payload["type"] == "refresh"


def test_expired_token_rejected():
    token = create_token(subject="user-123", expires_delta=timedelta(seconds=-1), token_type="access")
    assert decode_token(token) is None


def test_garbage_token_rejected():
    assert decode_token("not-a-real-token") is None
