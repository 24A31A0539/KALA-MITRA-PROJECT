"""
================================================================================
DEVELOPMENT / MOCK PAYMENT GATEWAY ADAPTER
================================================================================
WARNING & DISCLAIMER:
This is a development mock adapter designed ONLY for local development, unit tests,
and frontend checkout simulation prior to connecting a real gateway provider.

- It DOES NOT interact with real payment networks or banks.
- It DOES NOT process real financial transactions.
- It provides deterministic mock order IDs, signatures, and webhook simulations.
- It is completely isolated so it can be swapped for a real gateway without
  changing the core order system.
================================================================================
"""
import hmac
import hashlib
import json
import logging
from decimal import Decimal
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from payment.interface.payment_interface import (
    IPaymentGatewayService,
    PaymentStatus,
    PaymentProvider,
    GatewayOrderResult,
    GatewayVerifyResult,
    GatewayWebhookResult,
    GatewayStatusResult,
    GatewayRefundResult,
)

logger = logging.getLogger("kalamitra.mock_payment")


class MockPaymentGatewayService(IPaymentGatewayService):
    """
    Mock payment gateway for local testing and frontend checkout flow simulation.
    """
    PROVIDER_NAME = PaymentProvider.MOCK
    MOCK_SECRET_KEY = "kalamitra_mock_dev_secret_key_for_testing"

    def __init__(self, auto_success: bool = True):
        self.auto_success = auto_success
        logger.warning(
            "*** RUNNING IN DEVELOPMENT / MOCK PAYMENT MODE *** "
            "No real financial transactions will be processed."
        )

    def _generate_mock_signature(self, order_id: str, payment_id: str) -> str:
        """Generates a reproducible HMAC-SHA256 signature for mock verification."""
        msg = f"{order_id}|{payment_id}".encode("utf-8")
        return hmac.new(self.MOCK_SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    def create_payment_order(
        self,
        order_id: str,
        amount: Decimal,
        currency: str,
        notes: Optional[Dict[str, str]] = None
    ) -> GatewayOrderResult:
        """Simulates creating a payment order for local development."""
        mock_payment_order_id = f"mock_order_{order_id.replace('-', '')[:16]}"
        mock_public_key = "mock_pk_test_kalamitra_dev"

        checkout_payload = {
            "mock_mode": True,
            "banner": "DEVELOPMENT / MOCK PAYMENT GATEWAY - TESTING ONLY",
            "order_id": mock_payment_order_id,
            "amount": str(amount),
            "currency": currency,
            "merchant_name": "KALA-MITRA Artisan Cooperative (Dev)",
            "prefill": {
                "name": notes.get("buyer_name", "Test Buyer") if notes else "Test Buyer",
                "email": notes.get("buyer_email", "buyer@example.com") if notes else "buyer@example.com",
            },
            "notes": notes or {},
            "test_credentials": {
                "hint": "Use payment_id='mock_pay_success' and signature='mock_signature_valid', or use payment_id='mock_pay_fail' to test failure."
            }
        }

        return GatewayOrderResult(
            payment_order_id=mock_payment_order_id,
            amount=amount,
            currency=currency,
            provider=self.PROVIDER_NAME,
            public_key=mock_public_key,
            checkout_payload=checkout_payload,
            raw_response={
                "status": "created",
                "mock": True,
                "id": mock_payment_order_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        )

    def verify_payment(
        self,
        order_id: str,
        payment_order_id: str,
        payment_id: str,
        signature: str
    ) -> GatewayVerifyResult:
        """
        Simulates signature verification.
        Validates whether the payment succeeds or fails deterministically.
        """
        if payment_id == "mock_pay_fail" or signature == "mock_invalid_signature":
            return GatewayVerifyResult(
                is_valid=False,
                payment_transaction_id=payment_id,
                payment_status=PaymentStatus.FAILED,
                error_code="MOCK_PAYMENT_FAILED",
                error_description="Mock payment failed as requested for testing failure flows.",
                raw_response={"verified": False, "mock": True}
            )

        expected_sig = self._generate_mock_signature(payment_order_id, payment_id)

        is_valid = (
            signature == expected_sig or
            signature == "mock_signature_valid" or
            signature.startswith("mock_valid_") or
            (self.auto_success and signature != "invalid_sig")
        )

        if is_valid:
            return GatewayVerifyResult(
                is_valid=True,
                payment_transaction_id=payment_id,
                payment_status=PaymentStatus.PAID,
                raw_response={"verified": True, "mock": True, "transaction_id": payment_id}
            )
        else:
            return GatewayVerifyResult(
                is_valid=False,
                payment_transaction_id=payment_id,
                payment_status=PaymentStatus.FAILED,
                error_code="INVALID_SIGNATURE",
                error_description="Cryptographic signature mismatch in mock gateway verification.",
                raw_response={"verified": False, "mock": True}
            )

    def handle_webhook(
        self,
        raw_body: bytes,
        headers: Dict[str, str]
    ) -> GatewayWebhookResult:
        """Parses and validates mock webhook payloads."""
        try:
            payload_str = raw_body.decode("utf-8")
            data = json.loads(payload_str)
        except Exception as e:
            return GatewayWebhookResult(
                is_authentic=False,
                event_id="invalid_event",
                event_type="unknown",
                order_id=None,
                payment_order_id=None,
                payment_transaction_id=None,
                payment_status=PaymentStatus.FAILED,
                error_message=f"Failed to parse webhook JSON payload: {str(e)}"
            )

        event_id = data.get("event_id") or data.get("id") or f"mock_evt_{int(datetime.now(timezone.utc).timestamp())}"
        event_type = data.get("event") or data.get("type", "payment.captured")

        status_map = {
            "payment.captured": PaymentStatus.PAID,
            "payment.authorized": PaymentStatus.AUTHORIZED,
            "payment.failed": PaymentStatus.FAILED,
            "refund.processed": PaymentStatus.REFUNDED,
            "order.cancelled": PaymentStatus.CANCELLED,
        }

        payment_status = status_map.get(event_type, PaymentStatus.PAID)
        payment_info = data.get("payload", {}).get("payment", {}).get("entity", {}) if "payload" in data else data

        order_id = payment_info.get("notes", {}).get("order_id") or data.get("order_id")
        payment_order_id = payment_info.get("order_id") or data.get("payment_order_id")
        payment_tx_id = payment_info.get("id") or data.get("payment_transaction_id") or f"mock_tx_{event_id}"
        amount = Decimal(str(payment_info.get("amount", "0"))) if payment_info.get("amount") else None
        currency = payment_info.get("currency", "INR")

        return GatewayWebhookResult(
            is_authentic=True,
            event_id=event_id,
            event_type=event_type,
            order_id=order_id,
            payment_order_id=payment_order_id,
            payment_transaction_id=payment_tx_id,
            payment_status=payment_status,
            amount=amount,
            currency=currency,
            raw_payload=data
        )

    def get_payment_status(
        self,
        payment_order_id: str
    ) -> GatewayStatusResult:
        """Simulates fetching status from external gateway."""
        return GatewayStatusResult(
            payment_order_id=payment_order_id,
            payment_transaction_id=f"mock_tx_{payment_order_id}",
            payment_status=PaymentStatus.PAID,
            amount=Decimal("1000.00"),
            currency="INR",
            raw_response={"status": "paid", "mock": True}
        )

    def refund_payment(
        self,
        payment_transaction_id: str,
        amount: Decimal,
        reason: Optional[str] = None
    ) -> GatewayRefundResult:
        """Simulates processing a refund in mock development mode."""
        mock_refund_id = f"mock_rfnd_{payment_transaction_id.replace('-', '')[:16]}"
        return GatewayRefundResult(
            is_successful=True,
            refund_id=mock_refund_id,
            amount_refunded=amount,
            payment_status=PaymentStatus.REFUNDED,
            raw_response={
                "status": "processed",
                "refund_id": mock_refund_id,
                "amount": str(amount),
                "reason": reason,
                "mock": True
            }
        )
