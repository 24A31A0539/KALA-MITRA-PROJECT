"""
Unit Tests for KALA-MITRA Payment Integration Handoff Package.
Verifies interface contracts, Mock gateway behavior, signature checks, and idempotency.
"""
import pytest
import json
from decimal import Decimal
from datetime import datetime, timezone

from payment.interface.payment_interface import (
    IPaymentGatewayService,
    PaymentStatus,
    PaymentProvider,
)
from payment.schemas.order_schemas import OrderStatus, OrderDTO
from payment.schemas.payment_schemas import (
    PaymentOrderCreateRequest,
    PaymentVerifyRequest,
    RefundRequest,
)
from payment.gateway_adapter.mock_payment_gateway import MockPaymentGatewayService
from payment.gateway_adapter.gateway_factory import get_payment_gateway_service
from payment.service.payment_service import PaymentService, PaymentServiceException


@pytest.fixture
def mock_gateway():
    return MockPaymentGatewayService(auto_success=True)


@pytest.fixture
def payment_service(mock_gateway):
    return PaymentService(gateway_service=mock_gateway)


@pytest.fixture
def sample_order():
    return OrderDTO(
        order_id="ord_test_12345",
        buyer_id="usr_buyer_1",
        artisan_id="usr_artisan_1",
        product_id="prod_vase_01",
        quantity=2,
        unit_price=Decimal("499.00"),
        total_amount=Decimal("998.00"),
        currency="INR",
        order_status=OrderStatus.CREATED,
        payment_status=PaymentStatus.PENDING,
        payment_order_id=None,
        payment_transaction_id=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )


def test_mock_gateway_create_order(mock_gateway, sample_order):
    """Verify that Mock Gateway creates an order with expected fields."""
    res = mock_gateway.create_payment_order(
        order_id=sample_order.order_id,
        amount=sample_order.total_amount,
        currency=sample_order.currency,
        notes={"buyer_name": "Test User"}
    )
    assert res.payment_order_id.startswith("mock_order_")
    assert res.amount == Decimal("998.00")
    assert res.currency == "INR"
    assert res.provider == PaymentProvider.MOCK
    assert "order_id" in res.checkout_payload


def test_payment_service_create_order(payment_service, sample_order):
    """Verify payment service validates state and calls gateway adapter."""
    res = payment_service.create_payment_order(order=sample_order)
    assert res.order_id == sample_order.order_id
    assert res.payment_order_id.startswith("mock_order_")
    assert res.amount == Decimal("998.00")


def test_payment_service_cannot_create_for_paid_order(payment_service, sample_order):
    """Ensure double-payment is blocked."""
    sample_order.payment_status = PaymentStatus.PAID
    with pytest.raises(PaymentServiceException) as exc:
        payment_service.create_payment_order(order=sample_order)
    assert "already been paid" in str(exc.value)


def test_payment_verification_success(payment_service, sample_order):
    """Verify valid signature leads to PAID status and CONFIRMED order."""
    verify_req = PaymentVerifyRequest(
        order_id=sample_order.order_id,
        payment_order_id="mock_order_123",
        payment_id="mock_pay_success_1",
        signature="mock_signature_valid",
        payment_method="upi"
    )
    res = payment_service.verify_payment(order=sample_order, request=verify_req)
    assert res.verified is True
    assert res.payment_status == PaymentStatus.PAID
    assert res.order_status == OrderStatus.CONFIRMED


def test_payment_verification_failure(payment_service, sample_order):
    """Verify invalid signature or failed payment ID rejects transaction."""
    verify_req = PaymentVerifyRequest(
        order_id=sample_order.order_id,
        payment_order_id="mock_order_123",
        payment_id="mock_pay_fail",
        signature="mock_invalid_signature"
    )
    with pytest.raises(PaymentServiceException):
        payment_service.verify_payment(order=sample_order, request=verify_req)


def test_webhook_idempotency(payment_service):
    """Verify duplicate webhook payloads are recognized and do not re-execute."""
    event_payload = {
        "event": "payment.captured",
        "id": "evt_unique_12345",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_tx_789",
                    "order_id": "order_mock_1",
                    "amount": 99800,
                    "currency": "INR",
                    "notes": {"order_id": "ord_test_12345"}
                }
            }
        }
    }
    raw_body = json.dumps(event_payload).encode("utf-8")
    headers = {"x-mock-signature": "mock_sig"}

    # First call - fresh processing
    res1 = payment_service.handle_webhook(raw_body, headers)
    assert res1.success is True
    assert res1.status == "PAID"

    # Second call - idempotent replay
    res2 = payment_service.handle_webhook(raw_body, headers)
    assert res2.success is True
    assert res2.status == "ALREADY_PROCESSED"


def test_gateway_factory_resolution():
    """Verify factory returns Mock provider by default."""
    service = get_payment_gateway_service(provider_name="mock")
    assert isinstance(service, MockPaymentGatewayService)
    assert service.PROVIDER_NAME == PaymentProvider.MOCK
