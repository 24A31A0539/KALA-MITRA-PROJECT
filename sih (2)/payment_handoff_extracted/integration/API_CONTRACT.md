# KALA-MITRA Payment Module — REST API Contract

**Base URL:** `/api/v1/payments`  
**Protocol:** HTTPS  
**Format:** JSON (`application/json`)  
**Security Policy:** Server-side cryptographic signature verification required. No gateway secret keys exposed to frontend clients.

---

## Error Response Format
All error responses return a standardized JSON structure:

```json
{
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "Cryptographic signature verification failed.",
    "details": null
  }
}
```

---

## Endpoints Specification

### 1. Create Payment Order
Initiates a payment order with the gateway for an existing KALA-MITRA order.

* **Endpoint:** `POST /api/v1/payments/create-order`
* **Auth:** Required (Buyer JWT Token or `X-User-ID` matching `buyer_id`)
* **Headers:**
  - `Authorization: Bearer <jwt_token>` (or `X-User-ID: <buyer_id>`)
  - `Content-Type: application/json`

#### Request Body
```json
{
  "orderId": "ord_8f1b2c3d4e5f",
  "notes": {
    "buyerName": "Aarav Sharma",
    "buyerPhone": "+919876543210"
  }
}
```

#### Response (201 Created)
```json
{
  "orderId": "ord_8f1b2c3d4e5f",
  "paymentOrderId": "order_NXg9z481h2kL1a",
  "amount": 1499.00,
  "currency": "INR",
  "provider": "RAZORPAY",
  "publicKey": "rzp_test_51a2b3c4d5e6f7",
  "checkoutPayload": {
    "key": "rzp_test_51a2b3c4d5e6f7",
    "amount": 149900,
    "currency": "INR",
    "name": "KALA-MITRA",
    "description": "Payment for Handcrafted Terracotta Vase",
    "order_id": "order_NXg9z481h2kL1a",
    "prefill": {
      "name": "Aarav Sharma",
      "email": "aarav@example.com",
      "contact": "+919876543210"
    },
    "theme": {
      "color": "#8B4513"
    }
  }
}
```

#### Status Codes:
* `201 Created`: Payment order created on gateway.
* `400 Bad Request`: Order already paid or cancelled.
* `401 Unauthorized`: Missing or invalid authentication token.
* `403 Forbidden`: Authenticated user does not own this order.
* `404 Not Found`: Order ID does not exist.

---

### 2. Verify Payment Signature
Verifies the cryptographic signature returned by the client SDK after payment completion.

* **Endpoint:** `POST /api/v1/payments/verify`
* **Auth:** Required (Buyer JWT Token or `X-User-ID`)
* **Headers:**
  - `Authorization: Bearer <jwt_token>`
  - `Content-Type: application/json`

#### Request Body
```json
{
  "orderId": "ord_8f1b2c3d4e5f",
  "paymentOrderId": "order_NXg9z481h2kL1a",
  "paymentId": "pay_NXgA7b1c3d4e5f",
  "signature": "e8d69f2571b0e3528b9d8a391c49b0487532bb9a1841e065582f3c73708e3129",
  "paymentMethod": "upi"
}
```

#### Response (200 OK)
```json
{
  "orderId": "ord_8f1b2c3d4e5f",
  "paymentStatus": "PAID",
  "orderStatus": "CONFIRMED",
  "verified": true,
  "paymentTransactionId": "pay_NXgA7b1c3d4e5f",
  "message": "Payment verified and order confirmed successfully."
}
```

#### Status Codes:
* `200 OK`: Signature verified; order transitioned to `CONFIRMED` and `PAID`.
* `400 Bad Request`: Invalid signature / verification failed.
* `401 Unauthorized`: Authentication missing.
* `404 Not Found`: Order ID not found.

---

### 3. Inbound Gateway Webhook
Receives asynchronous server-to-server notifications from the gateway.

* **Endpoint:** `POST /api/v1/payments/webhook`
* **Auth:** Gateway Signature Header (e.g. `X-Razorpay-Signature`)
* **Headers:**
  - `X-Razorpay-Signature: <hmac_sha256_hex_digest>`
  - `Content-Type: application/json`

#### Sample Webhook Request Body (Razorpay format)
```json
{
  "entity": "event",
  "account_id": "acc_BF0M5uTNg7R5uK",
  "event": "payment.captured",
  "contains": ["payment"],
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_NXgA7b1c3d4e5f",
        "entity": "payment",
        "amount": 149900,
        "currency": "INR",
        "status": "captured",
        "order_id": "order_NXg9z481h2kL1a",
        "method": "upi",
        "notes": {
          "order_id": "ord_8f1b2c3d4e5f"
        }
      }
    }
  },
  "created_at": 1725456000
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Webhook processed successfully.",
  "eventId": "evt_NXgB2c3d4e5f6g",
  "status": "PAID"
}
```

#### Webhook Idempotency Policy:
- If a webhook with the same `event_id` is replayed, the endpoint returns `200 OK` with `"status": "ALREADY_PROCESSED"` and makes **no duplicate mutations**.

---

### 4. Query Payment Status
Retrieves current payment settlement and order lifecycle status.

* **Endpoint:** `GET /api/v1/payments/{orderId}`
* **Auth:** Required (Buyer or Admin)

#### Response (200 OK)
```json
{
  "orderId": "ord_8f1b2c3d4e5f",
  "paymentOrderId": "order_NXg9z481h2kL1a",
  "paymentTransactionId": "pay_NXgA7b1c3d4e5f",
  "paymentStatus": "PAID",
  "orderStatus": "CONFIRMED",
  "amount": 1499.00,
  "currency": "INR",
  "provider": "RAZORPAY",
  "createdAt": "2026-09-04T14:30:00Z",
  "updatedAt": "2026-09-04T14:32:15Z"
}
```

---

### 5. Issue Refund
Issues a full or partial refund for a settled order.

* **Endpoint:** `POST /api/v1/payments/refund`
* **Auth:** Admin / Authorized Service Role

#### Request Body
```json
{
  "orderId": "ord_8f1b2c3d4e5f",
  "amount": 1499.00,
  "reason": "Customer cancellation prior to dispatch"
}
```

#### Response (200 OK)
```json
{
  "orderId": "ord_8f1b2c3d4e5f",
  "refundId": "rfnd_NXgC9d8e7f6a5b",
  "paymentStatus": "REFUNDED",
  "amountRefunded": 1499.00,
  "success": true,
  "message": "Refund processed successfully."
}
```
