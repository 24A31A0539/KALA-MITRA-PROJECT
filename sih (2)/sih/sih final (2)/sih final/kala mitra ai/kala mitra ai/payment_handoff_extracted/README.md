# KALA-MITRA — Payment Gateway Integration Package

Welcome to the **KALA-MITRA Payment Gateway Module**.

This package contains the complete, isolated payment contract, domain service, mock development provider, schemas, and integration documentation required to implement and plug in **Razorpay** (or any standard payment provider) into the KALA-MITRA e-commerce platform.

---

## 🎯 Scope for Payment Developer

Your goal is to implement the **Razorpay Payment Gateway Adapter** without touching or rewriting the core KALA-MITRA order system or database models.

### ✅ What You Need to Implement
1. **Create Razorpay Adapter:**
   Copy `payment/gateway_adapter/razorpay_adapter_template.py` to `payment/gateway_adapter/razorpay_adapter.py`.
2. **Implement 5 Core Interface Methods:**
   - `create_payment_order(order_id, amount, currency, notes)`
   - `verify_payment(order_id, payment_order_id, payment_id, signature)`
   - `handle_webhook(raw_body, headers)`
   - `get_payment_status(payment_order_id)`
   - `refund_payment(payment_transaction_id, amount, reason)`
3. **Configure Environment:**
   Create `.env` from `.env.example` and supply your Razorpay Test Key ID and Key Secret.
4. **Set Active Provider:**
   Set `PAYMENT_PROVIDER=razorpay` in `.env`.

### 🚫 What is Handled by the Main App (Out of Scope for You)
- Order database schemas & SQLAlchemy models (Already built)
- User authentication & Buyer/Artisan authorization (Already built)
- Artisan payout calculations & commission splitting (Out of scope / future roadmap)
- Frontend checkout screens & order status polling (Already coordinated via API contract)

---

## 📁 Package Structure

```
KALA-MITRA-PAYMENT-HANDOFF/
│
├── README.md                          # This Quickstart Guide
├── PAYMENT_INTEGRATION.md             # Master 15-Section Developer Handoff Guide
├── .env.example                       # Environment template (copy to .env)
│
├── payment/
│   ├── interface/
│   │   ├── __init__.py
│   │   └── payment_interface.py       # IPaymentGatewayService ABC & Dataclasses
│   ├── gateway_adapter/
│   │   ├── __init__.py
│   │   ├── mock_payment_gateway.py    # Isolated DEVELOPMENT / MOCK adapter
│   │   ├── gateway_factory.py         # Provider factory (Mock vs Razorpay)
│   │   └── razorpay_adapter_template.py # Ready-to-fill Razorpay implementation template
│   ├── service/
│   │   ├── __init__.py
│   │   └── payment_service.py         # Business logic, state transitions & idempotency
│   └── schemas/
│       ├── __init__.py
│       ├── order_schemas.py           # Order DTOs & OrderStatus enums
│       └── payment_schemas.py         # Payment request/response DTOs & PaymentStatus enums
│
└── integration/
    ├── API_CONTRACT.md                # Full REST API endpoints & JSON payloads
    └── ORDER_PAYMENT_FLOW.md          # Sequence diagrams, state machines & webhook guide
```

---

## 🚀 Quickstart Guide

### 1. Setup Local Environment
```bash
# Navigate to the package directory
cd KALA-MITRA-PAYMENT-HANDOFF

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install dependencies
pip install pydantic pydantic-settings httpx razorpay
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
Edit `.env`:
```ini
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

### 3. Implement `razorpay_adapter.py`
Follow the instructions in `payment/gateway_adapter/razorpay_adapter_template.py` to fill in the Razorpay SDK or REST API calls.

### 4. Test Verification & Webhooks
Run the unit test scripts or test the signature verification function with mock payloads. Detailed testing steps are provided in [`PAYMENT_INTEGRATION.md`](./PAYMENT_INTEGRATION.md).
