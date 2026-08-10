from personaai.errors import (
    PersonaApiError,
    PersonaAuthError,
    PersonaValidationError,
    error_from_response,
)


def test_error_from_response_401_is_auth_error():
    err = error_from_response(401, {"message": "no credential", "code": "UNAUTHORIZED"})
    assert isinstance(err, PersonaAuthError)
    assert err.status_code == 401
    assert err.code == "UNAUTHORIZED"
    assert err.message == "no credential"


def test_error_from_response_403_is_auth_error():
    err = error_from_response(403, {"message": "not active", "code": "PROJECT_NOT_ACTIVE"})
    assert isinstance(err, PersonaAuthError)


def test_error_from_response_400_is_validation_error():
    err = error_from_response(400, {"message": "bad input", "code": "VALIDATION_ERROR"})
    assert isinstance(err, PersonaValidationError)
    assert not isinstance(err, PersonaAuthError)


def test_error_from_response_other_status_is_generic_api_error():
    err = error_from_response(500, {"message": "boom", "code": "SERVER_ERROR"})
    assert isinstance(err, PersonaApiError)
    assert not isinstance(err, PersonaAuthError)
    assert not isinstance(err, PersonaValidationError)


def test_error_from_response_defaults_when_body_missing_fields():
    err = error_from_response(404, {})
    assert err.message == "Request failed with status 404"
    assert err.code == "UNKNOWN_ERROR"


def test_error_from_response_handles_none_body():
    err = error_from_response(500, None)
    assert err.message == "Request failed with status 500"
    assert err.code == "UNKNOWN_ERROR"
    assert err.response is None


def test_persona_api_error_is_a_real_exception():
    err = PersonaApiError("boom", 500, "SERVER_ERROR")
    assert isinstance(err, Exception)
    assert str(err) == "boom"
