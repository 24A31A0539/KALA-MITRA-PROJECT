"""
Tests for Razorpay Test Mode Payment Gateway
"""

import hmac
import hashlib
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings

client = TestClient(app)

def test_create_payment_order():
    payload = {
        "order_id": "KM-ORD-10245",
        "amount": 70500,
        "currency": "INR",
        "buyer_id": "buyer-demo",
        "buyer_name": "GreenLeaf Hotels",
        "product_name": "Bamboo Basket"
    }
    response = client.post("/api/v1/payments/create-order", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "razorpay_order_id" in data
    assert data["order_id"] == "KM-ORD-10245"
    assert data["mode"] == "RAZORPAY TEST MODE"
    assert data["amount"] == 70500

def test_verify_payment_success():
    # 1. Create order
    payload = {
        "order_id": "KM-ORD-10245",
        "amount": 70500,
        "currency": "INR",
        "buyer_id": "buyer-demo",
        "buyer_name": "GreenLeaf Hotels",
        "product_name": "Bamboo Basket"
    }
    create_res = client.post("/api/v1/payments/create-order", json=payload).json()
    rzp_order_id = create_res["razorpay_order_id"]
    rzp_payment_id = "pay_test_9988776655"
    
    # 2. Compute authentic HMAC-SHA256 signature
    msg = f"{rzp_order_id}|{rzp_payment_id}".encode("utf-8")
    signature = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    verify_payload = {
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": rzp_payment_id,
        "razorpay_signature": signature,
        "order_id": "KM-ORD-10245",
        "buyer_id": "buyer-demo"
    }
    verify_res = client.post("/api/v1/payments/verify", json=verify_payload)
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["success"] is True
    assert verify_data["payment_status"] == "Paid"

    # 3. Check order details reflect payment status
    order_res = client.get("/api/v1/orders/KM-ORD-10245")
    assert order_res.status_code == 200
    assert order_res.json()["payment_status"] == "Paid"

def test_verify_payment_invalid_signature_rejected():
    verify_payload = {
        "razorpay_order_id": "order_test_fake123",
        "razorpay_payment_id": "pay_test_fake456",
        "razorpay_signature": "fraudulent_signature_that_should_fail",
        "order_id": "KM-ORD-10245",
        "buyer_id": "buyer-demo"
    }
    response = client.post("/api/v1/payments/verify", json=verify_payload)
    assert response.status_code == 400
