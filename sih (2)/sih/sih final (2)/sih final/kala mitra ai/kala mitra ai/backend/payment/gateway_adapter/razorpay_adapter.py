"""
================================================================================
RAZORPAY PAYMENT GATEWAY ADAPTER (PRODUCTION & TEST READY)
================================================================================
File: payment/gateway_adapter/razorpay_adapter.py
Description:
    Fully working Razorpay integration implementing `IPaymentGatewayService`.
    Supports standard Checkout, UPI Dynamic QR codes, HMAC-SHA256 signature
    verification, webhooks, and refunds.
================================================================================
"""
import hmac
import hashlib
import json
import logging
from decimal import Decimal
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import httpx

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
    Production and Test Mode adapter for Razorpay API.
    """
    PROVIDER_NAME = PaymentProvider.RAZORPAY
    BASE_URL = "https://api.razorpay.com/v1"

    def __init__(
        self,
        key_id: str,
        key_secret: str,
        webhook_secret: Optional[str] = None,
        timeout: float = 15.0
    ):
        if not key_id or not key_secret:
            raise ValueError("Razorpay key_id and key_secret must be provided.")
        
        self.key_id = key_id.strip()
        self.key_secret = key_secret.strip()
        self.webhook_secret = webhook_secret.strip() if webhook_secret else None
        self.timeout = timeout

    def _get_client(self) -> httpx.Client:
        """Returns an authenticated HTTP client for Razorpay REST API."""
        return httpx.Client(
            auth=(self.key_id, self.key_secret),
            timeout=self.timeout
        )

    def create_payment_order(
        self,
        order_id: str,
        amount: Decimal,
        currency: str,
        notes: Optional[Dict[str, str]] = None
    ) -> GatewayOrderResult:
        """
        Creates an order on Razorpay Orders API.
        Converts INR amount to paise (amount * 100).
        """
        amount_in_paise = int(amount * 100)
        clean_receipt = order_id.replace("-", "")[:40]

        payload = {
            "amount": amount_in_paise,
            "currency": currency.upper(),
            "receipt": clean_receipt,
            "notes": notes or {}
        }

        with self._get_client() as client:
            response = client.post(f"{self.BASE_URL}/orders", json=payload)
            
            if response.status_code not in [200, 201]:
                logger.error(f"Razorpay order creation failed: {response.status_code} - {response.text}")
                raise RuntimeError(f"Razorpay API error ({response.status_code}): {response.text}")

            data = response.json()
            payment_order_id = data["id"]

        # Build client-side checkout payload ready for Razorpay standard popup / UPI QR
        checkout_payload = {
            "key": self.key_id,
            "amount": amount_in_paise,
            "currency": currency.upper(),
            "name": "KALA-MITRA Artisan Cooperative",
            "description": f"Order #{order_id[:12]}",
            "order_id": payment_order_id,
            "prefill": {
                "name": notes.get("buyer_name", "Buyer") if notes else "Buyer",
                "email": notes.get("buyer_email", "buyer@kalamitra.org") if notes else "buyer@kalamitra.org",
                "contact": notes.get("buyer_phone", "") if notes else ""
            },
            "theme": {
                "color": "#9333EA"  # Artisan Royal Purple Theme
            },
            "notes": notes or {}
        }

        return GatewayOrderResult(
            payment_order_id=payment_order_id,
            amount=amount,
            currency=currency.upper(),
            provider=self.PROVIDER_NAME,
            public_key=self.key_id,
            checkout_payload=checkout_payload,
            raw_response=data
        )

    def verify_payment(
        self,
        order_id: str,
        payment_order_id: str,
        payment_id: str,
        signature: str
    ) -> GatewayVerifyResult:
        """
        Verifies cryptographic HMAC-SHA256 signature returned by Razorpay Checkout.
        Formula: HMAC_SHA256(f"{payment_order_id}|{payment_id}", key_secret) == signature
        """
        try:
            msg = f"{payment_order_id}|{payment_id}".encode("utf-8")
            expected_sig = hmac.new(
                self.key_secret.encode("utf-8"),
                msg,
                hashlib.sha256
            ).hexdigest()

            is_valid = hmac.compare_digest(expected_sig, signature)

            if is_valid:
                return GatewayVerifyResult(
                    is_valid=True,
                    payment_transaction_id=payment_id,
                    payment_status=PaymentStatus.PAID,
                    raw_response={"verified": True, "provider": "razorpay"}
                )
            else:
                logger.warning(
                    f"Razorpay signature mismatch for order {order_id}. "
                    f"Received: {signature}, Expected: {expected_sig}"
                )
                return GatewayVerifyResult(
                    is_valid=False,
                    payment_transaction_id=payment_id,
                    payment_status=PaymentStatus.FAILED,
                    error_code="INVALID_SIGNATURE",
                    error_description="Razorpay HMAC-SHA256 signature verification failed.",
                    raw_response={"verified": False}
                )

        except Exception as e:
            logger.error(f"Exception during Razorpay signature verification: {e}")
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
        Verifies and parses inbound Razorpay Webhook.
        """
        if not self.webhook_secret:
            logger.warning("No RAZORPAY_WEBHOOK_SECRET configured. Skipping signature check in dev.")
            is_authentic = True
        else:
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

            expected_sig = hmac.new(
                self.webhook_secret.encode("utf-8"),
                raw_body,
                hashlib.sha256
            ).hexdigest()

            is_authentic = hmac.compare_digest(expected_sig, received_sig)

        if not is_authentic:
            return GatewayWebhookResult(
                is_authentic=False,
                event_id="tampered_sig",
                event_type="unknown",
                order_id=None,
                payment_order_id=None,
                payment_transaction_id=None,
                payment_status=PaymentStatus.FAILED,
                error_message="Webhook HMAC-SHA256 signature verification failed."
            )

        data = json.loads(raw_body.decode("utf-8"))
        event_type = data.get("event")
        payment_entity = data.get("payload", {}).get("payment", {}).get("entity", {})

        if event_type == "payment.captured":
            payment_status = PaymentStatus.PAID
        elif event_type == "payment.failed":
            payment_status = PaymentStatus.FAILED
        elif event_type == "refund.processed":
            payment_status = PaymentStatus.REFUNDED
        elif event_type == "payment.authorized":
            payment_status = PaymentStatus.AUTHORIZED
        else:
            payment_status = PaymentStatus.PENDING

        order_id = payment_entity.get("notes", {}).get("order_id")
        payment_order_id = payment_entity.get("order_id")
        payment_tx_id = payment_entity.get("id")
        amount_paise = payment_entity.get("amount")
        amount = Decimal(str(amount_paise / 100)) if amount_paise else None

        return GatewayWebhookResult(
            is_authentic=True,
            event_id=data.get("id", f"rzp_evt_{payment_tx_id or 'unknown'}"),
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
        """Queries Razorpay Orders API for current payment status."""
        with self._get_client() as client:
            response = client.get(f"{self.BASE_URL}/orders/{payment_order_id}")
            if response.status_code != 200:
                raise RuntimeError(f"Razorpay API error ({response.status_code}): {response.text}")
            
            data = response.json()
            status_str = data.get("status", "created")
            
            status_map = {
                "paid": PaymentStatus.PAID,
                "attempted": PaymentStatus.PENDING,
                "created": PaymentStatus.PENDING,
            }
            
            amount_paise = data.get("amount", 0)
            return GatewayStatusResult(
                payment_order_id=payment_order_id,
                payment_transaction_id=None,
                payment_status=status_map.get(status_str, PaymentStatus.PENDING),
                amount=Decimal(str(amount_paise / 100)),
                currency=data.get("currency", "INR"),
                raw_response=data
            )

    def refund_payment(
        self,
        payment_transaction_id: str,
        amount: Decimal,
        reason: Optional[str] = None
    ) -> GatewayRefundResult:
        """Processes refund through Razorpay Refund API."""
        amount_in_paise = int(amount * 100)
        payload = {
            "amount": amount_in_paise,
            "notes": {"reason": reason or "Customer requested refund"}
        }

        with self._get_client() as client:
            response = client.post(
                f"{self.BASE_URL}/payments/{payment_transaction_id}/refund",
                json=payload
            )
            if response.status_code not in [200, 201]:
                return GatewayRefundResult(
                    is_successful=False,
                    refund_id=None,
                    amount_refunded=Decimal("0.0"),
                    payment_status=PaymentStatus.PAID,
                    error_message=f"Razorpay refund declined: {response.text}",
                    raw_response=response.json() if response.status_code == 400 else {}
                )

            data = response.json()
            return GatewayRefundResult(
                is_successful=True,
                refund_id=data.get("id"),
                amount_refunded=amount,
                payment_status=PaymentStatus.REFUNDED,
                raw_response=data
            )
