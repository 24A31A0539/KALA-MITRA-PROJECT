"""
================================================================================
KALA-MITRA PAYMENT MODULE — ORDER DATA SCHEMAS
================================================================================
File: payment/schemas/order_schemas.py
Description:
    Order data models and status enums showing how Order fulfillment status
    is strictly isolated from financial Payment status.
================================================================================
"""
from decimal import Decimal
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


def to_camel(string: str) -> str:
    """Helper for camelCase JSON serialization in API responses."""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class OrderStatus(str, Enum):
    """
    Fulfillment lifecycle state of the order.
    Completely independent of PaymentStatus.
    """
    CREATED = "CREATED"          # Buyer initiated checkout
    PENDING = "PENDING"          # Awaiting processing
    CONFIRMED = "CONFIRMED"      # Payment settled, order locked in
    PROCESSING = "PROCESSING"    # Artisan crafting/packing product
    SHIPPED = "SHIPPED"          # Consignment dispatched with courier
    DELIVERED = "DELIVERED"      # Product received by buyer
    CANCELLED = "CANCELLED"      # Order cancelled


class PaymentStatus(str, Enum):
    """
    Financial settlement state of the transaction.
    Completely independent of OrderStatus.
    """
    PENDING = "PENDING"          # Checkout initiated, awaiting capture
    AUTHORIZED = "AUTHORIZED"    # Payment authorized on card/mandate
    PAID = "PAID"                # Funds captured and verified
    FAILED = "FAILED"            # Payment declined or signature invalid
    REFUNDED = "REFUNDED"        # Settlement reversed to buyer
    CANCELLED = "CANCELLED"      # Buyer aborted checkout


class OrderDTO(BaseModel):
    """Data Transfer Object representing an Order in KALA-MITRA."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )

    order_id: str
    buyer_id: str
    artisan_id: str
    product_id: str
    quantity: int
    unit_price: Decimal
    total_amount: Decimal
    currency: str = "INR"
    order_status: OrderStatus
    payment_status: PaymentStatus
    payment_order_id: Optional[str] = None
    payment_transaction_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
