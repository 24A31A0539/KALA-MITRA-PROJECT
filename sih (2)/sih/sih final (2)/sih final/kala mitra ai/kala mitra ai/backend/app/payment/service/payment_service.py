"""
================================================================================
KALA-MITRA PAYMENT MODULE — DOMAIN SERVICE
================================================================================
File: payment/service/payment_service.py
Description:
    Domain service managing payment business logic:
    - Order state validation before checkout initiation
    - Calling IPaymentGatewayService adapter to generate payment orders
    - Server-side signature verification after checkout
    - Idempotent processing of gateway webhooks (replays ignored)
    - Refund orchestration
    - Ensuring OrderStatus and PaymentStatus remain strictly separated
================================================================================
"""
import logging
from decimal import Decimal
from typing import Optional, Dict, Any, List

try:
    from ..interface.payment_interface import (
        IPaymentGatewayService,
        PaymentStatus,
        PaymentProvider,
        GatewayOrderResult,
        GatewayVerifyResult,
        GatewayWebhookResult,
        GatewayRefundResult,
    )
    from ..schemas.order_schemas import OrderStatus, OrderDTO
    from ..schemas.payment_schemas import (
        PaymentOrderCreateRequest,
        PaymentOrderCreateResponse,
        PaymentVerifyRequest,
        PaymentVerifyResponse,
        PaymentStatusResponse,
        RefundRequest,
        RefundResponse,
        WebhookResponse,
    )
except ImportError:
    from payment.interface.payment_interface import (
        IPaymentGatewayService,
        PaymentStatus,
        PaymentProvider,
        GatewayOrderResult,
        GatewayVerifyResult,
        GatewayWebhookResult,
        GatewayRefundResult,
    )
    from payment.schemas.order_schemas import OrderStatus, OrderDTO
    from payment.schemas.payment_schemas import (
        PaymentOrderCreateRequest,
        PaymentOrderCreateResponse,
        PaymentVerifyRequest,
        PaymentVerifyResponse,
        PaymentStatusResponse,
        RefundRequest,
        RefundResponse,
        WebhookResponse,
    )

logger = logging.getLogger("kalamitra.payment_service")


class PaymentServiceException(Exception):
    """Base domain exception for payment errors."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PaymentService:
    """
    High-level Payment Service Orchestrator.
    """
    def __init__(self, gateway_service: IPaymentGatewayService):
        self.gateway = gateway_service
        # In-memory storage or DB session abstraction for handoff package
        self._processed_webhook_events: set = set()

    def create_payment_order(
        self,
        order: OrderDTO,
        notes: Optional[Dict[str, str]] = None
    ) -> PaymentOrderCreateResponse:
        """
        Validates order state and initiates a payment order on the gateway.
        
        Business Rules:
        - Order cannot be in PAID status.
        - Order cannot be CANCELLED or DELIVERED.
        """
        if order.payment_status == PaymentStatus.PAID:
            raise PaymentServiceException("Order has already been paid for.", status_code=400)

        if order.order_status in [OrderStatus.CANCELLED, OrderStatus.DELIVERED]:
            raise PaymentServiceException(
                f"Cannot initiate payment for order in '{order.order_status.value}' status.",
                status_code=400
            )

        # Build metadata notes
        order_notes = notes or {}
        order_notes.update({
            "order_id": order.order_id,
            "buyer_id": order.buyer_id,
            "product_id": order.product_id,
        })

        # Invoke gateway adapter
        gateway_result: GatewayOrderResult = self.gateway.create_payment_order(
            order_id=order.order_id,
            amount=order.total_amount,
            currency=order.currency,
            notes=order_notes
        )

        return PaymentOrderCreateResponse(
            order_id=order.order_id,
            payment_order_id=gateway_result.payment_order_id,
            amount=order.total_amount,
            currency=order.currency,
            provider=gateway_result.provider,
            public_key=gateway_result.public_key,
            checkout_payload=gateway_result.checkout_payload
        )

    def verify_payment(
        self,
        order: OrderDTO,
        request: PaymentVerifyRequest
    ) -> PaymentVerifyResponse:
        """
        Verifies the payment cryptographic signature returned from client checkout.
        
        CRITICAL: Only transitions order to PAID and CONFIRMED when the gateway
        signature verification passes.
        """
        # Idempotent check if already settled with the same transaction ID
        if order.payment_status == PaymentStatus.PAID and order.payment_transaction_id == request.payment_id:
            return PaymentVerifyResponse(
                order_id=order.order_id,
                payment_status=PaymentStatus.PAID,
                order_status=order.order_status,
                verified=True,
                payment_transaction_id=order.payment_transaction_id,
                message="Payment was already verified and confirmed."
            )

        # Call gateway signature verification
        verify_result: GatewayVerifyResult = self.gateway.verify_payment(
            order_id=order.order_id,
            payment_order_id=request.payment_order_id,
            payment_id=request.payment_id,
            signature=request.signature
        )

        if verify_result.is_valid:
            return PaymentVerifyResponse(
                order_id=order.order_id,
                payment_status=PaymentStatus.PAID,
                order_status=OrderStatus.CONFIRMED,
                verified=True,
                payment_transaction_id=verify_result.payment_transaction_id,
                message="Payment verified successfully. Order confirmed."
            )
        else:
            raise PaymentServiceException(
                f"Signature verification failed: {verify_result.error_description or 'Invalid cryptographic signature'}",
                status_code=400
            )

    def handle_webhook(
        self,
        raw_body: bytes,
        headers: Dict[str, str]
    ) -> WebhookResponse:
        """
        Processes inbound webhooks with strict idempotency and signature verification.
        """
        # Step 1: Verify webhook authenticity
        webhook_result: GatewayWebhookResult = self.gateway.handle_webhook(raw_body, headers)
        if not webhook_result.is_authentic:
            logger.error(f"Inauthentic webhook rejected: {webhook_result.error_message}")
            raise PaymentServiceException(
                f"Webhook verification failed: {webhook_result.error_message}",
                status_code=400
            )

        # Step 2: Enforce Idempotency
        if webhook_result.event_id in self._processed_webhook_events:
            logger.info(f"Duplicate webhook event '{webhook_result.event_id}' ignored (Idempotent).")
            return WebhookResponse(
                success=True,
                message="Event already processed (idempotent replay).",
                event_id=webhook_result.event_id,
                status="ALREADY_PROCESSED"
            )

        # Step 3: Record event ID to prevent replays
        self._processed_webhook_events.add(webhook_result.event_id)

        # Step 4: Map outcome
        return WebhookResponse(
            success=True,
            message=f"Webhook event '{webhook_result.event_type}' processed successfully.",
            event_id=webhook_result.event_id,
            status=webhook_result.payment_status.value
        )

    def refund_payment(
        self,
        order: OrderDTO,
        request: RefundRequest
    ) -> RefundResponse:
        """
        Processes partial or full refund for a settled order.
        """
        if order.payment_status != PaymentStatus.PAID:
            raise PaymentServiceException(
                f"Cannot refund order with payment status '{order.payment_status.value}'. Order must be PAID.",
                status_code=400
            )

        if not order.payment_transaction_id:
            raise PaymentServiceException("No payment transaction ID found for refund.", status_code=400)

        refund_amount = request.amount or order.total_amount

        gateway_refund: GatewayRefundResult = self.gateway.refund_payment(
            payment_transaction_id=order.payment_transaction_id,
            amount=refund_amount,
            reason=request.reason
        )

        if gateway_refund.is_successful:
            return RefundResponse(
                order_id=order.order_id,
                refund_id=gateway_refund.refund_id,
                payment_status=PaymentStatus.REFUNDED,
                amount_refunded=refund_amount,
                success=True,
                message="Refund processed successfully."
            )
        else:
            raise PaymentServiceException(
                f"Refund failed: {gateway_refund.error_message or 'Gateway declined refund.'}",
                status_code=400
            )
