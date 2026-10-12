"""
KALA-MITRA Order Tracking & Management Router
Single backend source of truth for Buyer and Artisan orders.
Integrates with DataStore and NotificationService.
"""

from typing import Dict, List, Optional
from uuid import uuid4
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ...services.store import store
from ...services.notification_service import notification_service

router = APIRouter(prefix="/orders", tags=["Order Tracking"])

class OrderStatusUpdate(BaseModel):
    status: str

class ProductionUpdate(BaseModel):
    artisan_id: int
    completed_quantity: int = Field(..., ge=0)
    status: str = "In Production"

class CreateOrderRequest(BaseModel):
    product: str
    quantity: int = Field(..., gt=0)
    total_amount: float = Field(..., gt=0)
    buyer: str = "Buyer"
    buyer_id: str = "buyer-demo"
    cluster_id: Optional[str] = None
    artisan_id: Optional[int] = 1
    artisan_name: Optional[str] = "Lakshmi Bamboo Crafts"
    location: Optional[str] = "East Godavari, Andhra Pradesh"

def calculate_order_metrics(order: dict) -> dict:
    members = order.get("members", [])
    if members:
        completed = sum(member.get("completed", 0) for member in members)
    else:
        completed = order.get("completed_quantity", 0)
    
    qty = order.get("quantity", 1)
    progress = round((completed / qty) * 100) if qty > 0 else 0
    remaining = max(0, qty - completed)

    return {
        **order,
        "completed_quantity": completed,
        "remaining_quantity": remaining,
        "progress": min(100, progress),
        "payment_status": order.get("payment_status", "Pending")
    }

@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
async def list_orders():
    """Returns all active orders with up-to-date completion metrics."""
    return [calculate_order_metrics(order) for order in store.orders.values()]

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_order(req: CreateOrderRequest):
    """Creates a new order from buyer direct checkout or formed cluster."""
    order_id = f"KM-ORD-{uuid4().hex[:6].upper()}"
    today = date.today().strftime("%d %b %Y")
    expected = (date.today() + timedelta(days=14)).strftime("%d %b %Y")
    
    members = []
    is_cluster = False
    
    # If cluster was provided, pull cluster members
    if req.cluster_id and req.cluster_id in store.clusters:
        cluster = store.clusters[req.cluster_id]
        is_cluster = True
        members = [
            {
                "artisan_id": m.get("id", i + 1),
                "name": m.get("name", "Artisan"),
                "location": m.get("location", "Andhra Pradesh"),
                "assigned": m.get("assigned_quantity", 0),
                "completed": 0,
                "status": "In Production"
            }
            for i, m in enumerate(cluster.get("members", []))
            if m.get("status") in ["Accepted", "Invitation Sent"]
        ]
    
    if not members:
        members = [{
            "artisan_id": req.artisan_id or 1,
            "name": req.artisan_name or "Lakshmi Bamboo Crafts",
            "location": req.location or "Kakinada",
            "assigned": req.quantity,
            "completed": 0,
            "status": "In Production"
        }]

    new_order = {
        "id": order_id,
        "product": req.product,
        "quantity": req.quantity,
        "buyer": req.buyer,
        "buyer_id": req.buyer_id,
        "order_date": today,
        "expected_delivery": expected,
        "total_amount": req.total_amount,
        "status": "Order Placed",
        "payment_status": "Pending",
        "cluster": is_cluster or len(members) > 1,
        "cluster_id": req.cluster_id,
        "members": members,
        "shipment": {
            "tracking_number": f"KM-SHIP-{uuid4().hex[:6].upper()}",
            "carrier": "KALA-MITRA Logistics",
            "current_location": "Order Processing Center",
            "status": "Order Placed",
            "estimated_delivery": expected
        },
        "timeline": ["Order Placed", "Order Confirmed"]
    }
    
    store.orders[order_id] = new_order
    store.save()

    notification_service.notify_order_created(
        buyer_id=req.buyer_id,
        order_id=order_id,
        product_name=req.product,
        quantity=req.quantity
    )

    return calculate_order_metrics(new_order)

@router.get("/{order_id}")
async def get_order_details(order_id: str):
    """Get single order details."""
    order = store.orders.get(order_id.upper())
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return calculate_order_metrics(order)

@router.get("/{order_id}/tracking")
async def get_order_tracking(order_id: str):
    """Retrieve tracking timeline and shipment location."""
    order = store.orders.get(order_id.upper())
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    metrics = calculate_order_metrics(order)
    return {
        "order_id": order["id"],
        "timeline": order.get("timeline", []),
        "current_status": order.get("status"),
        "payment_status": order.get("payment_status", "Pending"),
        "message": f"{metrics['completed_quantity']} of {order['quantity']} units completed.",
        "location": order.get("shipment", {}).get("current_location", "Distribution Center")
    }

@router.get("/{order_id}/progress")
async def get_order_progress(order_id: str):
    """Retrieve production progress breakdown."""
    order = store.orders.get(order_id.upper())
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    metrics = calculate_order_metrics(order)
    return {
        "order_id": order["id"],
        "required": order["quantity"],
        "completed": metrics["completed_quantity"],
        "remaining": metrics["remaining_quantity"],
        "percentage": metrics["progress"],
        "members": order.get("members", [])
    }

@router.put("/{order_id}/status")
async def update_order_status(order_id: str, update: OrderStatusUpdate):
    """
    Update order status across standard progression:
    Order Placed -> Production Started -> Quality Check -> Shipped -> Delivered
    """
    order = store.orders.get(order_id.upper())
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order["status"] = update.status
    
    # Update timeline if status not yet recorded
    if "timeline" not in order:
        order["timeline"] = []
    if update.status not in order["timeline"]:
        order["timeline"].append(update.status)
        
    # Update shipment location according to status
    location_map = {
        "Order Placed": "Order Processing Center",
        "Production Started": "Artisan Workshop - In Production",
        "Production in Progress": "Artisan Workshop",
        "Quality Check": "Samalkota Craft Quality Inspection Hub",
        "Shipped": "Rajahmundry Distribution Center",
        "Delivered": "Delivered to Buyer"
    }
    if "shipment" in order:
        order["shipment"]["status"] = update.status
        order["shipment"]["current_location"] = location_map.get(update.status, order["shipment"].get("current_location", "In Transit"))

    store.save()

    # Emit real backend event notification
    notification_service.notify_order_status_update(
        buyer_id=order.get("buyer_id", "buyer-demo"),
        order_id=order["id"],
        status=update.status,
        product_name=order.get("product", "Handicraft Product")
    )

    return calculate_order_metrics(order)

@router.post("/{order_id}/production-update")
async def update_production(order_id: str, update: ProductionUpdate):
    """Artisan updates their portion of production."""
    order = store.orders.get(order_id.upper())
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    member = next((item for item in order.get("members", []) if item["artisan_id"] == update.artisan_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Artisan contribution not found")
    
    member["completed"] = min(update.completed_quantity, member["assigned"])
    member["status"] = update.status
    
    metrics = calculate_order_metrics(order)
    if metrics["progress"] == 100:
        order["status"] = "Quality Check"
        if "Quality Check" not in order["timeline"]:
            order["timeline"].append("Quality Check")
    
    store.save()
    return metrics

@router.get("/{order_id}/shipment")
async def order_shipment(order_id: str):
    """Retrieve shipment details."""
    order = store.orders.get(order_id.upper())
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order.get("shipment", {})
