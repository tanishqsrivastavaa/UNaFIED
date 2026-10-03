"""
Tests for authentication endpoints: signup, login, /me, and refresh.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import uuid


# We need to mock the database before importing the app
@pytest.fixture
def mock_session():
    """Create a mock database session."""
    session = MagicMock()
    return session


@pytest.fixture
def client(mock_session):
    """Create a test client with mocked DB."""
    from app.db.db import get_session

    # Import the app
    from main import app

    app.dependency_overrides[get_session] = lambda: mock_session

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


def test_health(client):
    """Health endpoint should always return ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_signup_success(client, mock_session):
    """Signup with a new email should return 200."""
    mock_session.exec.return_value.first.return_value = None  # No existing user

    test_user_id = uuid.uuid4()

    def side_effect_add(obj):
        obj.id = test_user_id

    mock_session.add.side_effect = side_effect_add

    response = client.post(
        "/api/v1/signup",
        json={"email": "test@example.com", "password": "securepass123"},
    )
    assert response.status_code == 200
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()


def test_signup_duplicate_email(client, mock_session):
    """Signup with existing email should return 401."""
    mock_session.exec.return_value.first.return_value = MagicMock()  # Existing user

    response = client.post(
        "/api/v1/signup",
        json={"email": "existing@example.com", "password": "pass123"},
    )
    assert response.status_code == 401


def test_login_invalid_credentials(client, mock_session):
    """Login with wrong credentials should return 401."""
    mock_session.exec.return_value.first.return_value = None  # User not found

    response = client.post(
        "/api/v1/login",
        json={"email": "nobody@example.com", "password": "wrong"},
    )
    assert response.status_code == 401


def test_me_without_token(client):
    """Accessing /me without a token should return 401."""
    response = client.get("/api/v1/me")
    assert response.status_code == 401


def test_refresh_invalid_token(client):
    """Using an invalid refresh token should return 401."""
    response = client.post(
        "/api/v1/refresh",
        json={"refresh_token": "invalid.token.here"},
    )
    assert response.status_code == 401


# --- Google sign-in (Google's token endpoint and the ID-token check are stubbed) ---

import httpx
from app.config.settings import settings
from app.models.user import User

GOOGLE_CLAIMS = {"email": "g@example.com", "email_verified": True}


@pytest.fixture
def google_on():
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-client-id"), patch.object(settings, "GOOGLE_CLIENT_SECRET", "test-secret"):
        yield


def google_login(client, claims=GOOGLE_CLAIMS, token_status=200, token_error=None, verify_error=None):
    token_response = MagicMock(status_code=token_status)
    token_response.json.return_value = {"id_token": "id-token"}
    with (
        patch("app.core.security.httpx.post", return_value=token_response, side_effect=token_error) as exchange,
        patch("app.core.security.google_id_token.verify_oauth2_token", return_value=claims, side_effect=verify_error) as verify,
    ):
        response = client.post("/api/v1/auth/google", json={"code": "one-time-code"})
    return response, exchange, verify


def test_google_off_without_secret(client):
    with patch.object(settings, "GOOGLE_CLIENT_ID", "test-client-id"), patch.object(settings, "GOOGLE_CLIENT_SECRET", None):
        assert client.get("/api/v1/auth/google").json() == {"client_id": None}
        response, exchange, _ = google_login(client)
    assert response.status_code == 404
    exchange.assert_not_called()


def test_google_first_visit_creates_account(client, mock_session, google_on):
    mock_session.exec.return_value.first.return_value = None
    assert client.get("/api/v1/auth/google").json() == {"client_id": "test-client-id"}
    response, exchange, verify = google_login(client)

    assert response.status_code == 200
    assert response.json()["access_token"]
    sent = exchange.call_args.kwargs["data"]
    assert (sent["code"], sent["client_secret"], sent["redirect_uri"]) == ("one-time-code", "test-secret", "postmessage")
    assert verify.call_args.args[2] == "test-client-id"  # audience is checked
    user = mock_session.add.call_args_list[0].args[0]
    assert (user.email, user.auth_provider, user.hashed_password) == ("g@example.com", "google", None)


def test_google_returning_user_signs_in(client, mock_session, google_on):
    mock_session.exec.return_value.first.return_value = User(email="g@example.com", auth_provider="google")
    response, _, _ = google_login(client)
    assert response.status_code == 200
    assert not any(isinstance(c.args[0], User) for c in mock_session.add.call_args_list)


def test_google_refuses_password_account(client, mock_session, google_on):
    mock_session.exec.return_value.first.return_value = User(email="g@example.com", hashed_password="x")
    response, _, _ = google_login(client)
    assert response.status_code == 409
    mock_session.add.assert_not_called()


def test_google_unverified_email(client, google_on):
    response, _, _ = google_login(client, claims={"email": "g@example.com", "email_verified": False})
    assert response.status_code == 401


def test_google_rejects_code(client, google_on):
    response, _, verify = google_login(client, token_status=400)
    assert response.status_code == 401
    verify.assert_not_called()


def test_google_bad_id_token(client, google_on):
    response, _, _ = google_login(client, verify_error=ValueError("Token expired"))
    assert response.status_code == 401


def test_google_unreachable(client, google_on):
    response, _, _ = google_login(client, token_error=httpx.ConnectError("down"))
    assert response.status_code == 502
