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
    """Accessing /me without a token should return 403."""
    response = client.get("/api/v1/me")
    assert response.status_code == 403


def test_refresh_invalid_token(client):
    """Using an invalid refresh token should return 401."""
    response = client.post(
        "/api/v1/refresh",
        json={"refresh_token": "invalid.token.here"},
    )
    assert response.status_code == 401
