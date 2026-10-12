import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_check_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["copilot_service"] == "ready"

def test_copilot_chat_endpoint():
    payload = {
        "query": "How should I price my bamboo baskets for bulk orders?",
        "artisan_context": {
            "location": "Andhra Pradesh",
            "craftType": "Bamboo Crafts"
        }
    }
    response = client.post("/api/v1/copilot/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert "tools_available" in data
    assert "calculate_collective_capacity" in data["tools_available"]
