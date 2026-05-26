from app.core.security import hash_password, verify_password, create_access_token, decode_token


def test_password_round_trip():
    h = hash_password("hunter22long")
    assert verify_password("hunter22long", h)
    assert not verify_password("wrong", h)


def test_token_round_trip():
    tok = create_access_token("alice@x.com", "user")
    payload = decode_token(tok)
    assert payload["sub"] == "alice@x.com"
    assert payload["role"] == "user"
    assert payload["type"] == "access"
