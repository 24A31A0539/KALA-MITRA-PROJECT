# KALA-MITRA — Master Payment Integration & Developer Handoff Specification

**Document Version:** 1.0.0  
**Target Platform:** KALA-MITRA Artisan E-Commerce (FastAPI / PostgreSQL / Flutter / React)  
**Target Provider:** Razorpay (with isolated Mock provider for local sandbox testing)  
**Author:** KALA-MITRA Architecture Team

---

## Table of Contents
1. [Current Order Structure](#1-current-order-structure)
2. [PaymentStatus & OrderStatus State Machines](#2-paymentstatus--orderstatus-state-machines)
3. [Required API Endpoints](#3-required-api-endpoints)
4. [Request / Response Formats & Error Schema](#4-request--response-formats--error-schema)
5. [Authentication & Authorization Requirements](#5-authentication--authorization-requirements)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Where the Payment Module Connects](#7-where-the-payment-module-connects)
8. [Payment Success Flow](#8-payment-success-flow)
9. [Payment Failure & Retry Flow](#9-payment-failure--retry-flow)
10. [Webhook Flow & Idempotency Requirements](#10-webhook-flow--idempotency-requirements)
11. [Signature Verification Requirements](#11-signature-verification-requirements)
12. [Refund Integration Point](#12-refund-integration-point)
13. [Security Requirements & PCI-DSS Scope Reduction](#13-security-requirements--pci-dss-scope-reduction)
14. [Testing Instructions](#14-testing-instructions)
15. [Exact Files to Create or Modify](#15-exact-files-to-create-or-modify)

---

## 1. Current Order Structure

The KALA-MITRA database defines an `Order` model in PostgreSQL. The payment gateway interacts with orders through the following standard fields:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `order_id` (`orderId`) | `String(64)` | Primary key UUID for the order |
| `buyer_id` (`buyerId`) | `String(64)` | User ID of the buyer placing the order |
| `artisan_id` (`artisanId`) | `String(64)` | User ID of the artisan craftsman |
| `product_id` (`productId`) | `String(64)` | Product catalog identifier |
| `quantity` | `Integer` | Number of units ordered |
| `unit_price` (`unitPrice`) | `Numeric(12, 2)` | Price per unit in INR |
| `total_amount` (`totalAmount`) | `Numeric(12, 2)` | Total payable amount (`quantity * unit_price`) |
| `currency` | `String(3)` | ISO 4217 Currency Code (default: `INR`) |
| `order_status` (`orderStatus`) | `Enum(OrderStatus)` | Fulfillment status (e.g. `CREATED`, `CONFIRMED`) |
| `payment_status` (`paymentStatus`) | `Enum(PaymentStatus)` | Financial settlement status (e.g. `PENDING`, `PAID`) |
| `payment_order_id` (`paymentOrderId`) | `String(128)` | Gateway Order ID (e.g. Razorpay `order_xxxx`) |
| `payment_transaction_id` (`paymentTransactionId`) | `String(128)` | Gateway Payment ID (e.g. Razorpay `pay_xxxx`) |
| `payment_provider` (`paymentProvider`) | `Enum(PaymentProvider)` | Active provider (`RAZORPAY`, `MOCK`) |
| `created_at` (`createdAt`) | `DateTime (UTC)` | Order creation timestamp |
| `updated_at` (`updatedAt`) | `DateTime (UTC)` | Last modified timestamp |

---

## 2. PaymentStatus & OrderStatus State Machines

> [!IMPORTANT]
> `OrderStatus` and `PaymentStatus` are **strictly separated** in the database. Never combine them into a single string.

### PaymentStatus Values
- `PENDING`: Checkout initiated; waiting for payment attempt.
- `AUTHORIZED`: Funds authorized on buyer's card or mandate (pre-capture).
- `PAID`: Funds captured and server-side signature verified.
- `FAILED`: Payment rejected by bank or signature mismatch.
- `REFUNDED`: Funds returned to buyer.
- `CANCELLED`: Checkout dismissed or timed out by buyer.

### OrderStatus Values
- `CREATED`: Order record initialized in shopping session.
- `PENDING`: Order awaiting payment settlement.
- `CONFIRMED`: Payment confirmed `PAID`; order locked for fulfillment.
- `PROCESSING`: Artisan handcrafting or packaging product.
- `SHIPPED`: Consignment dispatched with logistics tracking.
- `DELIVERED`: Product delivered to buyer.
- `CANCELLED`: Order cancelled (before dispatch).

---

## 3. Required API Endpoints

The payment router exposes the following REST endpoints under `/api/v1/payments`:

1. `POST /api/v1/payments/create-order`
   - **Purpose:** Creates an order on the gateway and returns the `paymentOrderId` and client checkout config.
2. `POST /api/v1/payments/verify`
   - **Purpose:** Cryptographically verifies the client SDK payment response and updates order to `PAID` / `CONFIRMED`.
3. `POST /api/v1/payments/webhook`
   - **Purpose:** Asynchronous server-to-server webhook endpoint for gateway status notifications.
4. `GET /api/v1/payments/{orderId}`
   - **Purpose:** Queries the current payment status and order fulfillment status.
5. `POST /api/v1/payments/refund`
   - **Purpose:** Issues full or partial refunds for settled orders.

---

## 4. Request / Response Formats & Error Schema

All endpoints exchange JSON with camelCase attributes for frontend convenience and snake_case internally via Pydantic model aliases.

### Error Envelope
HTTP 4xx / 5xx responses always follow:
```json
{
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "Cryptographic signature verification failed.",
    "details": null
  }
}
```

### Create Order Payload
**Request:**
```json
{
  "orderId": "ord_9a8b7c6d5e",
  "notes": {
    "buyerName": "Sunita Rao",
    "buyerPhone": "+919876543210"
  }
}
```
**Response (201 Created):**
```json
{
  "orderId": "ord_9a8b7c6d5e",
  "paymentOrderId": "order_NXh1a2b3c4d5",
  "amount": 2499.00,
  "currency": "INR",
  "provider": "RAZORPAY",
  "publicKey": "rzp_test_xxxx",
  "checkoutPayload": {
    "key": "rzp_test_xxxx",
    "amount": 249900,
    "currency": "INR",
    "name": "KALA-MITRA",
    "order_id": "order_NXh1a2b3c4d5"
  }
}
```

### Verify Payment Payload
**Request:**
```json
{
  "orderId": "ord_9a8b7c6d5e",
  "paymentOrderId": "order_NXh1a2b3c4d5",
  "paymentId": "pay_NXh9z8y7x6w5",
  "signature": "b6a827cf17b960b134882df8b105d15a4b7f7...",
  "paymentMethod": "upi"
}
```
**Response (200 OK):**
```json
{
  "orderId": "ord_9a8b7c6d5e",
  "paymentStatus": "PAID",
  "orderStatus": "CONFIRMED",
  "verified": true,
  "paymentTransactionId": "pay_NXh9z8y7x6w5",
  "message": "Payment verified and order confirmed successfully."
}
```

---

## 5. Authentication & Authorization Requirements

1. **Buyer Endpoints (`create-order`, `verify`, status query):**
   - Must include `Authorization: Bearer <JWT>` header or development header `X-User-ID: <buyer_id>`.
   - The server verifies that `order.buyer_id == current_user.id`. A user cannot initiate or verify payment for another user's order.
2. **Webhook Endpoint (`webhook`):**
   - **No JWT required.**
   - Authenticated strictly through the gateway signature header (`X-Razorpay-Signature`).
   - Requests with missing or invalid signatures are rejected immediately with HTTP 400.

---

## 6. Environment Variables Reference

Configure these in your local `.env` file (copied from `.env.example`):

```ini
# Core Configuration
ENVIRONMENT=development
PAYMENT_PROVIDER=razorpay          # Switch between 'mock' and 'razorpay'
DEFAULT_CURRENCY=INR

# Razorpay Test Credentials (from Dashboard -> Settings -> API Keys)
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET

# Webhook Security
WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS=300
```

> [!CAUTION]
> Never commit your real `.env` file or API secret keys to Git.

---

## 7. Where the Payment Module Connects

The connection point is `IPaymentGatewayService` located at:
`payment/interface/payment_interface.py`

To plug in Razorpay:
1. Copy `payment/gateway_adapter/razorpay_adapter_template.py` to `payment/gateway_adapter/razorpay_adapter.py`.
2. Implement the class `RazorpayPaymentGatewayService(IPaymentGatewayService)`.
3. In `payment/gateway_adapter/gateway_factory.py`, the factory automatically imports and returns your class when `PAYMENT_PROVIDER=razorpay`.

No other files or database queries need to be touched.

---

## 8. Payment Success Flow

```
1. Buyer clicks "Proceed to Payment" in Web / Mobile App
2. Frontend calls POST /api/v1/payments/create-order
3. Backend calls Razorpay Orders API -> returns payment_order_id
4. Frontend opens Razorpay Checkout modal
5. Buyer completes payment via UPI / Card / Netbanking
6. Razorpay SDK returns (payment_id, payment_order_id, signature) to Frontend
7. Frontend sends payload to POST /api/v1/payments/verify
8. Backend computes HMAC-SHA256 signature using RAZORPAY_KEY_SECRET
9. If signature matches:
   - Order payment_status becomes PAID
   - Order order_status becomes CONFIRMED
   - Payment audit log recorded
10. Frontend displays "Order Confirmed" screen
```

---

## 9. Payment Failure & Retry Flow

```
1. Buyer's card declined or UPI transaction times out
2. Razorpay SDK returns failure or buyer closes modal
3. If client sends verification with invalid signature or failed code:
   - Backend marks payment_status = FAILED
   - order_status remains CREATED / PENDING
4. Frontend displays "Payment Failed" with "Retry Payment" button
5. Clicking "Retry Payment" calls create-order again with same orderId
6. A fresh payment order is initialized without creating duplicate Order rows
```

---

## 10. Webhook Flow & Idempotency Requirements

### Why Webhooks are Necessary
If a buyer completes payment on UPI but closes the browser before the frontend can call `/verify`, the gateway webhook guarantees the order is still marked `PAID`.

### Idempotency Enforcement Rule
Gateways frequently retry webhooks if network latency exceeds timeouts. Your webhook processing **must be idempotent**:

1. Extract the unique `event_id` (e.g. `data["id"]` or `data["event_id"]`).
2. Query `payment_webhook_events` table for `event_id`.
3. If already processed, return `200 OK` immediately without running update statements.
4. If fresh, record event, update order to `PAID`, commit transaction, and return `200 OK`.

---

## 11. Signature Verification Requirements

### Checkout Signature Formula (HMAC-SHA256)
```python
import hmac
import hashlib

message = f"{payment_order_id}|{payment_id}".encode("utf-8")
generated_signature = hmac.new(
    key_secret.encode("utf-8"),
    message,
    hashlib.sha256
).hexdigest()

# Always use constant-time comparison:
is_valid = hmac.compare_digest(generated_signature, received_signature)
```

### Webhook Signature Formula
```python
expected_signature = hmac.new(
    webhook_secret.encode("utf-8"),
    raw_request_body_bytes,
    hashlib.sha256
).hexdigest()

is_valid = hmac.compare_digest(expected_signature, header_signature)
```

---

## 12. Refund Integration Point

* **Method:** `refund_payment(payment_transaction_id, amount, reason)`
* **Conditions:**
  - `order.payment_status` must equal `PAID`
  - `order.payment_transaction_id` must be present
* **Gateway API:** `POST https://api.razorpay.com/v1/payments/{payment_id}/refund`
* **On Success:** Order `payment_status` transitions to `REFUNDED` and `order_status` transitions to `CANCELLED`.

---

## 13. Security Requirements & PCI-DSS Scope Reduction

1. **Zero Raw Card Data:** The KALA-MITRA backend never accepts, processes, or stores card numbers, CVVs, or bank PINs. All card inputs occur inside the gateway's hosted SDK iframe.
2. **Secret Key Isolation:** Gateway secret keys (`RAZORPAY_KEY_SECRET`) are never sent to the browser, mobile app, or frontend repositories.
3. **Constant-Time Comparison:** Use `hmac.compare_digest` for all cryptographic comparisons to prevent timing side-channel attacks.

---

## 14. Testing Instructions

### Step 1: Run with Mock Provider (No keys required)
```bash
export PAYMENT_PROVIDER=mock
pytest tests/ -v
```
All payment tests will pass using deterministic test signatures.

### Step 2: Test with Razorpay Sandbox
1. Create a free Razorpay account at https://razorpay.com
2. Switch dashboard to **Test Mode**.
3. Generate Key ID and Key Secret.
4. Put credentials in `.env` and set `PAYMENT_PROVIDER=razorpay`.
5. Run checkout flow using Razorpay test cards / UPI IDs:
   - Success UPI: `success@razorpay`
   - Failure UPI: `failure@razorpay`

---

## 15. Exact Files to Create or Modify

| Action | File Path | Description |
| :--- | :--- | :--- |
| **CREATE** | `payment/gateway_adapter/razorpay_adapter.py` | Implement the 5 methods of `IPaymentGatewayService` for Razorpay. |
| **CREATE** | `.env` | Copy from `.env.example` and set `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`. |
| **VERIFY** | `payment/gateway_adapter/gateway_factory.py` | Verify that `PAYMENT_PROVIDER=razorpay` instantiates your new adapter. |
| **TEST** | `tests/test_razorpay_adapter.py` | Add unit tests for your Razorpay adapter methods. |
| **NO TOUCH** | Core Order DB / Auth / Frontend / Main Backend | These are already integrated and expect this contract. |
