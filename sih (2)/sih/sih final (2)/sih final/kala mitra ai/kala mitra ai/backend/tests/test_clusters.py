"""
Tests for Artisan Cluster Lifecycle & Business Logic
"""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_provisional_cluster_workflow():
    # 1. Create provisional cluster
    payload = {
        "product": "Handwoven Bamboo Basket",
        "quantity": 500,
        "delivery_days": 14,
        "budget": 75000,
        "location": "Kakinada",
        "category": "Bamboo Crafts",
        "buyer_id": "buyer-demo",
        "selected_artisans": [
            {"artisan_id": 1, "proposed_contribution": 200},
            {"artisan_id": 2, "proposed_contribution": 200},
            {"artisan_id": 3, "proposed_contribution": 100}
        ]
    }
    res = client.post("/api/v1/clusters/provisional", json=payload)
    assert res.status_code == 200
    cluster = res.json()
    assert cluster["status"] == "PROVISIONAL"
    assert cluster["total_allocated"] == 500
    assert len(cluster["members"]) == 3

    cluster_id = cluster["id"]

    # 2. Send requests to artisans
    send_res = client.post(f"/api/v1/clusters/{cluster_id}/send-requests")
    assert send_res.status_code == 200
    assert send_res.json()["status"] == "PENDING"

    # 3. Artisans accept
    for member in cluster["members"]:
        resp = client.post(f"/api/v1/clusters/{cluster_id}/respond?action=accept&artisan_id={member['id']}")
        assert resp.status_code == 200

    # 4. Buyer confirms cluster
    confirm_res = client.post(f"/api/v1/clusters/{cluster_id}/confirm")
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "CONFIRMED"
