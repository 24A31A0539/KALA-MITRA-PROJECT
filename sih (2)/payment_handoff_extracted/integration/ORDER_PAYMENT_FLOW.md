# KALA-MITRA — Order & Payment Flow Specification

This document details the lifecycle, sequence interactions, and state machines governing orders and payments in KALA-MITRA.

---

## 1. End-to-End Payment Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Buyer (React / Flutter App)
    participant API as FastAPI Backend (/api/v1/payments)
    participant PS as PaymentService
    participant DB as PostgreSQL (Orders & Audits)
    participant Adapter as Gateway Adapter (IPaymentGatewayService)
    actor Gateway as Payment Gateway (Razorpay API)

    %% Step 1: Create Order & Payment Order
    Buyer->>API: 1. POST /api/v1/payments/create-order {orderId}
    API->>PS: create_payment_order(order_id)
    PS->>DB: Fetch order & verify status (PENDING / CREATED)
    PS->>Adapter: create_payment_order(amount, currency, notes)
    Adapter->>Gateway: POST /v1/orders (amount_in_paise, receipt)
    Gateway-->>Adapter: {id: "order_NXg...", amount: 149900, ...}
    Adapter-->>PS: GatewayOrderResult(payment_order_id)
    PS->>DB: Update order (payment_order_id, payment_status=PENDING)
    PS-->>API: PaymentOrderCreateResponse
    API-->>Buyer: 201 Created {paymentOrderId, publicKey, checkoutPayload}

    %% Step 2: Client Checkout
    Buyer->>Gateway: 2. Open SDK Checkout Modal (pass paymentOrderId)
    Buyer->>Gateway: Enters UPI / Card / Netbanking credentials
    Gateway-->>Buyer: Payment Success Callback {paymentId, paymentOrderId, signature}

    %% Step 3: Server-side Cryptographic Verification
    Buyer->>API: 3. POST /api/v1/payments/verify {orderId, paymentOrderId, paymentId, signature}
    API->>PS: verify_payment(payload)
    PS->>Adapter: verify_payment(order_id, payment_order_id, payment_id, signature)
    Adapter->>Adapter: Compute HMAC-SHA256(order_id + "|" + payment_id, secret)
    alt Signature Valid
        Adapter-->>PS: GatewayVerifyResult(is_valid=True, status=PAID)
        PS->>DB: Update order (payment_status=PAID, order_status=CONFIRMED, payment_transaction_id)
        PS->>DB: Insert PaymentAuditLog (EVENT=PAYMENT_VERIFIED_SUCCESS)
        PS-->>API: PaymentVerifyResponse(verified=True, status=PAID)
        API-->>Buyer: 200 OK (Confirmed)
    else Signature Invalid / Tampered
        Adapter-->>PS: GatewayVerifyResult(is_valid=False, status=FAILED)
        PS->>DB: Update order (payment_status=FAILED)
        PS->>DB: Insert PaymentAuditLog (EVENT=VERIFY_FAILED)
        PS-->>API: 400 Bad Request
        API-->>Buyer: 400 Bad Request (Payment Failed / Retry)
    end
```

---

## 2. Server-to-Server Webhook Flow & Idempotency

When a payment succeeds or fails asynchronously (or if the user's browser closes before verification), the gateway sends a direct webhook to FastAPI.

```mermaid
sequenceDiagram
    autonumber
    actor Gateway as Payment Gateway
    participant API as FastAPI Backend (/api/v1/payments/webhook)
    participant PS as PaymentService
    participant Adapter as Gateway Adapter
    participant DB as PostgreSQL

    Gateway->>API: POST /api/v1/payments/webhook [Header: X-Razorpay-Signature]
    API->>PS: handle_webhook(raw_body, headers)
    PS->>Adapter: handle_webhook(raw_body, headers)
    Adapter->>Adapter: Verify HMAC-SHA256(raw_body, webhook_secret) == header
    
    alt Authentic Webhook
        Adapter-->>PS: GatewayWebhookResult(is_authentic=True, event_id, status)
        PS->>DB: Check if event_id already exists in payment_webhook_events
        alt Event ID Already Processed (Duplicate / Replay)
            PS-->>API: WebhookResponse(status=ALREADY_PROCESSED)
            API-->>Gateway: 200 OK (Acknowledge without re-mutating order)
        else Fresh Event
            PS->>DB: Insert payment_webhook_events (status=PROCESSING)
            PS->>DB: Update Order (payment_status=PAID, order_status=CONFIRMED)
            PS->>DB: Insert PaymentAuditLog (EVENT=WEBHOOK_CAPTURED)
            PS->>DB: Update payment_webhook_events (status=PROCESSED)
            PS-->>API: WebhookResponse(status=PROCESSED)
            API-->>Gateway: 200 OK
        end
    else Inauthentic Webhook (Tampered)
        Adapter-->>PS: GatewayWebhookResult(is_authentic=False)
        PS-->>API: 400 Bad Request
        API-->>Gateway: 400 Bad Request (Signature Verification Failed)
    end
```

---

## 3. OrderStatus vs. PaymentStatus State Machines

> [!IMPORTANT]
> `OrderStatus` and `PaymentStatus` are strictly independent fields. An order can only proceed to physical processing (`PROCESSING`, `SHIPPED`, `DELIVERED`) once `PaymentStatus` is `PAID`.

```
           OrderStatus                             PaymentStatus
       ┌─────────────────┐                      ┌─────────────────┐
       │     CREATED     │                      │     PENDING     │
       └────────┬────────┘                      └────────┬────────┘
                │                                        │
      (Checkout Initiated)                    (Payment Attempted)
                │                                        │
                ▼                                        ▼
       ┌─────────────────┐                      ┌─────────────────┐
       │     PENDING     │                      │   AUTHORIZED    │
       └────────┬────────┘                      └────────┬────────┘
                │                                        │
     (Payment Verified PAID)                   (Signature Verified)
                │                                        │
                ▼                                        ▼
       ┌─────────────────┐                      ┌─────────────────┐
       │    CONFIRMED    │◄─────────────────────┤      PAID       │
       └────────┬────────┘                      └────────┬────────┘
                │                                        │
       (Artisan Packaging)                           (Refunded)
                │                                        │
                ▼                                        ▼
       ┌─────────────────┐                      ┌─────────────────┐
       │   PROCESSING    │                      │    REFUNDED     │
       └────────┬────────┘                      └─────────────────┘
                │
         (Dispatched)
                │
                ▼
       ┌─────────────────┐
       │     SHIPPED     │
       └────────┬────────┘
                │
          (Delivered)
                │
                ▼
       ┌─────────────────┐
       │    DELIVERED    │
       └─────────────────┘
```

---

## 4. Refund Lifecycle
1. Admin or authorized buyer requests cancellation on a `PAID` order.
2. Server verifies `order.payment_status == PAID` and extracts `payment_transaction_id`.
3. Gateway Adapter calls `POST /v1/payments/{payment_id}/refund`.
4. Upon successful gateway response:
   - `order.payment_status` becomes `REFUNDED`
   - `order.order_status` becomes `CANCELLED`
   - `payment_transactions` record is updated with `refund_id` and `amount_refunded`.
