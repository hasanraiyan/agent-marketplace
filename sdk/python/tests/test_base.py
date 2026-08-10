import pytest

from personaai._base import (
    TransportConfig,
    build_headers,
    build_url,
    decode_json_envelope,
    is_success_status,
    raise_for_non_json_error,
)
from personaai.errors import PersonaApiError, PersonaAuthError, PersonaValidationError


def test_transport_config_strips_trailing_slash():
    config = TransportConfig(base_url="https://api.test/", credential="k.s")
    assert config.base_url == "https://api.test"


def test_transport_config_requires_base_url():
    with pytest.raises(ValueError):
        TransportConfig(base_url="", credential="k.s")


def test_transport_config_requires_credential():
    with pytest.raises(ValueError):
        TransportConfig(base_url="https://api.test", credential="")


def test_build_url_no_query():
    assert build_url("https://api.test", "/api/v1/developer/agents") == (
        "https://api.test/api/v1/developer/agents"
    )


def test_build_url_with_query_drops_none():
    url = build_url("https://api.test", "/api/v1/developer/agents", {"page": 2, "search": None})
    assert url == "https://api.test/api/v1/developer/agents?page=2"


def test_build_headers_injects_auth_and_accept():
    config = TransportConfig(base_url="https://api.test", credential="keyId.secret")
    headers = build_headers(config, None, has_json_body=False)
    assert headers["Authorization"] == "Bearer keyId.secret"
    assert headers["Accept"] == "application/json"
    assert "x-persona-external-user-id" not in headers
    assert "Content-Type" not in headers


def test_build_headers_adds_external_user_id_and_content_type():
    config = TransportConfig(
        base_url="https://api.test", credential="keyId.secret", external_user_id="user-1"
    )
    headers = build_headers(config, {"x-agent-id": "a1"}, has_json_body=True)
    assert headers["x-persona-external-user-id"] == "user-1"
    assert headers["Content-Type"] == "application/json"
    assert headers["x-agent-id"] == "a1"


def test_is_success_status():
    assert is_success_status(200)
    assert is_success_status(201)
    assert not is_success_status(429)
    assert not is_success_status(500)
    assert not is_success_status(301)


def test_decode_json_envelope_unwraps_data():
    assert decode_json_envelope(200, {"success": True, "data": {"a": 1}}) == {"a": 1}


def test_decode_json_envelope_passes_through_when_no_data_key():
    body = {"principalType": "ProjectMachine"}
    assert decode_json_envelope(200, body) == body


def test_decode_json_envelope_raises_auth_error_on_401():
    with pytest.raises(PersonaAuthError):
        decode_json_envelope(401, {"success": False, "message": "nope", "code": "UNAUTHORIZED"})


def test_decode_json_envelope_raises_auth_error_on_403():
    with pytest.raises(PersonaAuthError):
        decode_json_envelope(403, {"success": False, "message": "nope", "code": "FORBIDDEN"})


def test_decode_json_envelope_raises_validation_error_on_400():
    with pytest.raises(PersonaValidationError):
        decode_json_envelope(400, {"success": False, "message": "bad", "code": "VALIDATION_ERROR"})


def test_decode_json_envelope_raises_generic_error_on_other_status():
    with pytest.raises(PersonaApiError):
        decode_json_envelope(500, {"success": False, "message": "boom", "code": "SERVER_ERROR"})


def test_decode_json_envelope_raises_when_success_false_even_on_2xx():
    with pytest.raises(PersonaApiError):
        decode_json_envelope(200, {"success": False, "message": "boom", "code": "WEIRD"})


def test_raise_for_non_json_error_raises_on_failure_status():
    with pytest.raises(PersonaApiError) as exc_info:
        raise_for_non_json_error(500)
    assert exc_info.value.code == "NON_JSON_ERROR_RESPONSE"


def test_raise_for_non_json_error_is_noop_on_success_status():
    raise_for_non_json_error(200)  # should not raise
