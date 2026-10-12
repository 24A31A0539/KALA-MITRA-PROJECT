"""
Tests for Order Management & Tracking Progression
"""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_order_creation_and_status_progression():
    # 1. Create order
    payload = {
        "product": "Handwoven Bamboo Basket",
        "quantity": 100,
        "total_amount": 14000,
        "buyer": "GreenLeaf Hotels",
        "buyer_id": "buyer-demo"
    }
    create_res = client.post("/api/v1/orders/create", json=payload)
    assert create_res.status_code == 201
    order = create_res.json()
    order_id = order["id"]
    assert order["status"] == "Order Placed"
    assert order["payment_status"] == "Pending"

    # 2. Progression: Production Started
    status_1 = client.put(f"/api/v1/orders/{order_id}/status", json={"status": "Production Started"}).json()
    assert status_1["status"] == "Production Started"
    assert "Production Started" in status_1["timeline"]

    # 3. Progression: Quality Check
    status_2 = client.put(f"/api/v1/orders/{order_id}/status", json={"status": "Quality Check"}).json()
    assert status_2["status"] == "Quality Check"

    # 4. Progression: Shipped
    status_3 = client.put(f"/api/v1/orders/{order_id}/status", json={"status": "Shipped"}).json()
    assert status_3["status"] == "Shipped"

    # 5. Progression: Delivered
    status_4 = client.put(f"/api/v1/orders/{order_id}/status", json={"status": "Delivered"}).json()
    assert status_4["status"] == "Delivered"

    # 6. Verify tracking endpoint
    tracking = client.get(f"/api/v1/orders/{order_id}/tracking").json()
    assert tracking["current_status"] == "Delivered"
    assert "Delivered to Buyer" in tracking["location"]
