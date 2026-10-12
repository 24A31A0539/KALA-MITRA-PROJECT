"""
================================================================================
KALA-MITRA PAYMENT MODULE — GATEWAY FACTORY
================================================================================
File: payment/gateway_adapter/gateway_factory.py
Description:
    Dynamically instantiates the active IPaymentGatewayService implementation
    based on the PAYMENT_PROVIDER environment setting.
================================================================================
"""
import os
import logging
from typing import Optional

from payment.interface.payment_interface import IPaymentGatewayService, PaymentProvider
from payment.gateway_adapter.mock_payment_gateway import MockPaymentGatewayService

logger = logging.getLogger("kalamitra.payment_factory")


def get_payment_gateway_service(
    provider_name: Optional[str] = None,
    mock_auto_success: bool = True
) -> IPaymentGatewayService:
    """
    Factory function resolving the active payment gateway instance.
    
    Args:
        provider_name: Optional override. Defaults to PAYMENT_PROVIDER env var.
        mock_auto_success: Used when provider is 'mock' to auto-pass test payments.
        
    Returns:
        Instance implementing IPaymentGatewayService.
    """
    provider = (provider_name or os.getenv("PAYMENT_PROVIDER", "mock")).strip().lower()

    if provider == "mock":
        return MockPaymentGatewayService(auto_success=mock_auto_success)

    elif provider == "razorpay":
        key_id = os.getenv("RAZORPAY_KEY_ID")
        key_secret = os.getenv("RAZORPAY_KEY_SECRET")
        webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")

        if not key_id or not key_secret:
            raise ValueError(
                "PAYMENT_PROVIDER is set to 'razorpay' but RAZORPAY_KEY_ID or "
                "RAZORPAY_KEY_SECRET environment variables are missing."
            )

        # Import and instantiate the concrete Razorpay adapter once implemented:
        try:
            from payment.gateway_adapter.razorpay_adapter import RazorpayPaymentGatewayService
            return RazorpayPaymentGatewayService(
                key_id=key_id,
                key_secret=key_secret,
                webhook_secret=webhook_secret
            )
        except ImportError:
            raise NotImplementedError(
                "RazorpayPaymentGatewayService has not been created yet in "
                "payment/gateway_adapter/razorpay_adapter.py. Copy razorpay_adapter_template.py "
                "and complete the 5 methods, or set PAYMENT_PROVIDER=mock."
            )

    else:
        logger.warning(f"Unrecognized provider '{provider}'. Falling back to Mock.")
        return MockPaymentGatewayService(auto_success=mock_auto_success)
