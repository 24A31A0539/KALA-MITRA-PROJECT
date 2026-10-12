"""
================================================================================
RAZORPAY PAYMENT GATEWAY ADAPTER TEMPLATE
================================================================================
File: payment/gateway_adapter/razorpay_adapter.py (Rename when implementing)
Developer Guide:
    This file is the implementation canvas for the Razorpay Payment Gateway.
    Implement the 5 required methods of `IPaymentGatewayService` using either:
      Option A: The official Python SDK (`razorpay` package)
      Option B: Direct HTTPS REST requests via `httpx` or `requests`

CRITICAL SECURITY RULES:
  1. NEVER hardcode API keys or secret tokens.
  2. Load keys strictly from environment variables via constructor arguments.
  3. NEVER trust client checkout results without server-side HMAC-SHA256 signature verification.
  4. Always verify webhook authenticity before processing events.
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

logger = logging.getLogger("kalamitra.razorpay_gateway")


class RazorpayPaymentGatewayService(IPaymentGatewayService):
    """
    Razorpay Implementation of IPaymentGatewayService.
    """
    PROVIDER_NAME = PaymentProvider.RAZORPAY

    def __init__(
        self,
        key_id: str,
        key_secret: str,
        webhook_secret: Optional[str] = None
    ):
        """
        Initializes Razorpay client credentials.
        
        Args:
            key_id: Razorpay API Key ID (e.g. 'rzp_test_xxxx')
            key_secret: Razorpay API Secret Key
            webhook_secret: Secret string configured in Razorpay Dashboard for Webhooks
        """
        if not key_id or not key_secret:
            raise ValueError("Razorpay key_id and key_secret must be provided via environment variables.")
        
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret

        # OPTIONAL: If using razorpay-python SDK:
        # import razorpay
        # self.client = razorpay.Client(auth=(self.key_id, self.key_secret))

    def create_payment_order(
        self,
        order_id: str,
        amount: Decimal,
        currency: str,
        notes: Optional[Dict[str, str]] = None
    ) -> GatewayOrderResult:
        """
        STEP 1: Call Razorpay Orders API
        Endpoint: POST https://api.razorpay.com/v1/orders
        
        Note: Razorpay expects amounts in the smallest currency sub-unit:
              INR 500.00 = 50000 paise (amount * 100)
        """
        # Convert amount to paise
        amount_in_paise = int(amount * 100)

        # Payload structure:
        # order_data = {
        #     "amount": amount_in_paise,
        #     "currency": currency,
        #     "receipt": order_id[:40],
        #     "notes": notes or {}
        # }
        # razorpay_order = self.client.order.create(data=order_data)
        
        # --- Placeholder return until real API call is plugged in ---
        raise NotImplementedError(
            "RazorpayPaymentGatewayService.create_payment_order() needs to be implemented. "
            "Call Razorpay Orders API to generate the gateway order_id."
        )

    def verify_payment(
        self,
        order_id: str,
        payment_order_id: str,
        payment_id: str,
        signature: str
    ) -> GatewayVerifyResult:
        """
        STEP 2: Cryptographically verify Razorpay signature returned by checkout SDK.
        
        Verification formula:
            HMAC_SHA256(
                message = f"{payment_order_id}|{payment_id}",
                secret = self.key_secret
            ) == signature
        """
        try:
            # Generate expected signature
            msg = f"{payment_order_id}|{payment_id}".encode("utf-8")
            expected_signature = hmac.new(
                self.key_secret.encode("utf-8"),
                msg,
                hashlib.sha256
            ).hexdigest()

            # Constant-time comparison to prevent timing attacks
            is_valid = hmac.compare_digest(expected_signature, signature)

            if is_valid:
                return GatewayVerifyResult(
                    is_valid=True,
                    payment_transaction_id=payment_id,
                    payment_status=PaymentStatus.PAID,
                    raw_response={"verified": True, "provider": "razorpay"}
                )
            else:
                return GatewayVerifyResult(
                    is_valid=False,
                    payment_transaction_id=payment_id,
                    payment_status=PaymentStatus.FAILED,
                    error_code="INVALID_SIGNATURE",
                    error_description="Razorpay HMAC-SHA256 signature verification failed.",
                    raw_response={"verified": False}
                )

        except Exception as e:
            logger.error(f"Error verifying Razorpay payment signature: {e}")
            return GatewayVerifyResult(
                is_valid=False,
                payment_transaction_id=payment_id,
                payment_status=PaymentStatus.FAILED,
                error_code="VERIFICATION_EXCEPTION",
                error_description=str(e)
            )

    def handle_webhook(
        self,
        raw_body: bytes,
        headers: Dict[str, str]
    ) -> GatewayWebhookResult:
        """
        STEP 3: Verify webhook signature header and parse event.
        
        Header: 'X-Razorpay-Signature'
        Verification formula:
            HMAC_SHA256(message = raw_body, secret = self.webhook_secret) == header_signature
        """
        if not self.webhook_secret:
            raise ValueError("RAZORPAY_WEBHOOK_SECRET must be configured to process webhooks.")

        received_sig = headers.get("x-razorpay-signature") or headers.get("X-Razorpay-Signature")
        if not received_sig:
            return GatewayWebhookResult(
                is_authentic=False,
                event_id="missing_sig",
                event_type="unknown",
                order_id=None,
                payment_order_id=None,
                payment_transaction_id=None,
                payment_status=PaymentStatus.FAILED,
                error_message="Missing 'X-Razorpay-Signature' header"
            )

        # Verify signature
        expected_sig = hmac.new(
            self.webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, received_sig):
            return GatewayWebhookResult(
                is_authentic=False,
                event_id="tampered_sig",
                event_type="unknown",
                order_id=None,
                payment_order_id=None,
                payment_transaction_id=None,
                payment_status=PaymentStatus.FAILED,
                error_message="Invalid webhook HMAC signature. Potential tampering."
            )

        # Parse payload
        data = json.loads(raw_body.decode("utf-8"))
        event_type = data.get("event")
        payment_entity = data.get("payload", {}).get("payment", {}).get("entity", {})

        # Map event type
        if event_type == "payment.captured":
            payment_status = PaymentStatus.PAID
        elif event_type == "payment.failed":
            payment_status = PaymentStatus.FAILED
        elif event_type == "refund.processed":
            payment_status = PaymentStatus.REFUNDED
        else:
            payment_status = PaymentStatus.PENDING

        order_id = payment_entity.get("notes", {}).get("order_id")
        payment_order_id = payment_entity.get("order_id")
        payment_tx_id = payment_entity.get("id")
        amount_paise = payment_entity.get("amount")
        amount = Decimal(str(amount_paise / 100)) if amount_paise else None

        return GatewayWebhookResult(
            is_authentic=True,
            event_id=data.get("id", f"rzp_evt_{payment_tx_id}"),
            event_type=event_type,
            order_id=order_id,
            payment_order_id=payment_order_id,
            payment_transaction_id=payment_tx_id,
            payment_status=payment_status,
            amount=amount,
            currency=payment_entity.get("currency", "INR"),
            raw_payload=data
        )

    def get_payment_status(
        self,
        payment_order_id: str
    ) -> GatewayStatusResult:
        """
        STEP 4: Fetch order status from Razorpay API.
        GET https://api.razorpay.com/v1/orders/{order_id}
        """
        raise NotImplementedError("Implement get_payment_status() via Razorpay Orders API.")

    def refund_payment(
        self,
        payment_transaction_id: str,
        amount: Decimal,
        reason: Optional[str] = None
    ) -> GatewayRefundResult:
        """
        STEP 5: Process refund through Razorpay Refund API.
        POST https://api.razorpay.com/v1/payments/{payment_id}/refund
        """
        raise NotImplementedError("Implement refund_payment() via Razorpay Refund API.")
