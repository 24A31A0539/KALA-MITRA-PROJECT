"""
KALA-MITRA Notifications Router
Provides REST endpoints for retrieving, filtering, and marking notifications as read.
Backed by the central DataStore and NotificationService.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from ...services.store import store

router = APIRouter(prefix="/notifications", tags=["Notifications"])

class NotificationSchema(BaseModel):
    id: str
    user_id: str = "buyer-demo"
    type: str
    title: str
    message: str
    related_id: str = ""
    related_type: str = ""
    is_read: bool = False
    timestamp: str
    action_label: str = "View"
    action_route: str = ""

class CreateNotificationRequest(BaseModel):
    user_id: str = "buyer-demo"
    type: str = "system"
    title: str
    message: str
    related_id: str = ""
    related_type: str = ""
    action_label: str = "View"
    action_route: str = "buyer-home"

@router.get("", response_model=List[NotificationSchema])
@router.get("/", response_model=List[NotificationSchema])
async def get_notifications(
    user_id: str = Query("buyer-demo"),
    category: str = Query("all")
):
    """Retrieve notifications filtered by user and category."""
    results = []
    is_buyer = user_id == "buyer-demo" or user_id.startswith("buyer")
    for item in store.notifications:
        if is_buyer and item.get("type") == "cluster":
            continue
        # Match user or general demo
        user_matches = (
            user_id == "all" or
            item.get("user_id") == user_id or
            (user_id == "buyer-demo" and item.get("user_id", "").startswith("buyer")) or
            (user_id.startswith("artisan") and item.get("user_id", "").startswith("artisan"))
        )
        cat_matches = category == "all" or item.get("type") == category
        if user_matches and cat_matches:
            results.append(item)
    return results

@router.get("/unread-count")
async def unread_count(user_id: str = Query("buyer-demo")):
    """Get count of unread notifications for user."""
    is_buyer = user_id == "buyer-demo" or user_id.startswith("buyer")
    count = sum(
        1 for item in store.notifications
        if not item.get("is_read", False) and not (is_buyer and item.get("type") == "cluster") and (
            user_id == "all" or
            item.get("user_id") == user_id or
            (user_id == "buyer-demo" and item.get("user_id", "").startswith("buyer")) or
            (user_id.startswith("artisan") and item.get("user_id", "").startswith("artisan"))
        )
    )
    return {"count": count}

@router.post("", response_model=NotificationSchema)
@router.post("/", response_model=NotificationSchema)
async def create_notification(req: CreateNotificationRequest):
    """Create a manual or programmatic notification."""
    notif = store.add_notification(
        user_id=req.user_id,
        notif_type=req.type,
        title=req.title,
        message=req.message,
        related_id=req.related_id,
        related_type=req.related_type,
        action_label=req.action_label,
        action_route=req.action_route
    )
    return notif

@router.patch("/{notification_id}/read")
async def mark_notification_read(notification_id: str, user_id: str = Query("buyer-demo")):
    """Mark a single notification as read."""
    for item in store.notifications:
        if item.get("id") == notification_id:
            item["is_read"] = True
            store.save()
            return item
    raise HTTPException(status_code=404, detail="Notification not found")

@router.patch("/read-all")
async def mark_all_notifications_read(user_id: str = Query("buyer-demo")):
    """Mark all notifications as read for user."""
    updated = 0
    for item in store.notifications:
        if user_id == "all" or item.get("user_id") == user_id or (user_id == "buyer-demo" and item.get("user_id", "").startswith("buyer")):
            if not item.get("is_read"):
                item["is_read"] = True
                updated += 1
    store.save()
    return {"updated": updated}
