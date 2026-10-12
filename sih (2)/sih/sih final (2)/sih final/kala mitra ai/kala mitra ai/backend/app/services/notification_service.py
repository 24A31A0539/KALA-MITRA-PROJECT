"""
KALA-MITRA Central Notification Service
Dispatches real backend events to notifications for Buyers and Artisans:
- New bulk requirement
- Cluster invitation
- Artisan accepted / declined
- Cluster formed
- Order created
- Payment success / failure
- Production started / Quality check / Shipped / Delivered
"""

from typing import Optional, List
from .store import store

class NotificationService:
    @staticmethod
    def notify_bulk_requirement(buyer_id: str, product_name: str, quantity: int, cluster_id: str):
        store.add_notification(
            user_id=buyer_id,
            notif_type="cluster",
            title="Bulk Requirement Registered",
            message=f"Requirement for {quantity} units of {product_name} registered. Finding artisan cluster.",
            related_id=cluster_id,
            related_type="cluster",
            action_label="View Progress",
            action_route="buyer-orders"
        )

    @staticmethod
    def notify_cluster_invitation(artisan_id: int, artisan_name: str, product_name: str, assigned_quantity: int, cluster_id: str, buyer_name: str = "EcoMarket India", buyer_location: str = "Kakinada", co_artisans: str = ""):
        message = f"New Cluster Request: You are invited to produce {assigned_quantity} units of {product_name} for Buyer {buyer_name} ({buyer_location})."
        if co_artisans:
            message += f" Co-artisans: {co_artisans}."
        store.add_notification(
            user_id=f"artisan-{artisan_id}",
            notif_type="cluster",
            title="New Cluster Request 📦",
            message=message,
            related_id=cluster_id,
            related_type="cluster",
            action_label="View Invitation",
            action_route="artisan-dashboard"
        )

    @staticmethod
    def notify_artisan_accepted(buyer_id: str, artisan_name: str, assigned_quantity: int, cluster_id: str):
        store.add_notification(
            user_id=buyer_id,
            notif_type="cluster",
            title="Artisan Accepted",
            message=f"{artisan_name} accepted the invitation for {assigned_quantity} units.",
            related_id=cluster_id,
            related_type="cluster",
            action_label="View Cluster",
            action_route="buyer-orders"
        )

    @staticmethod
    def notify_artisan_declined(buyer_id: str, artisan_name: str, cluster_id: str):
        store.add_notification(
            user_id=buyer_id,
            notif_type="cluster",
            title="Artisan Declined",
            message=f"{artisan_name} declined the cluster invitation. Initiating AI auto-replacement.",
            related_id=cluster_id,
            related_type="cluster",
            action_label="View Cluster",
            action_route="buyer-bulk-requirement"
        )

    @staticmethod
    def notify_artisan_replaced(buyer_id: str, original_name: str, replacement_name: str, quantity: int, cluster_id: str):
        store.add_notification(
            user_id=buyer_id,
            notif_type="cluster",
            title="AI Auto-Replacement Successful ⚡",
            message=f"{original_name} was replaced by {replacement_name} for {quantity} units. Your collective order is preserved!",
            related_id=cluster_id,
            related_type="cluster",
            action_label="View Cluster",
            action_route="buyer-bulk-requirement"
        )

    @staticmethod
    def notify_cluster_formed(buyer_id: str, product_name: str, total_quantity: int, cluster_id: str, artisan_names: str = ""):
        msg = f"Cluster Formed: Your bulk order of {total_quantity} units of {product_name} has been successfully formed"
        if artisan_names:
            msg += f" with artisans: {artisan_names}."
        else:
            msg += "."
        store.add_notification(
            user_id=buyer_id,
            notif_type="cluster",
            title="Cluster Formed! 🎉",
            message=msg,
            related_id=cluster_id,
            related_type="cluster",
            action_label="View Cluster",
            action_route="buyer-orders"
        )

    @staticmethod
    def notify_artisan_cluster_confirmed(artisan_id: int, product_name: str, total_quantity: int, cluster_id: str, co_artisans: str = ""):
        msg = f"Cluster Confirmed: Order for {total_quantity} units of {product_name} is confirmed!"
        if co_artisans:
            msg += f" You are collaborating with: {co_artisans}."
        store.add_notification(
            user_id=f"artisan-{artisan_id}",
            notif_type="cluster",
            title="Cluster Confirmed 🚀",
            message=msg,
            related_id=cluster_id,
            related_type="cluster",
            action_label="View Order",
            action_route="artisan-dashboard"
        )

    @staticmethod
    def notify_order_created(buyer_id: str, order_id: str, product_name: str, quantity: int):
        store.add_notification(
            user_id=buyer_id,
            notif_type="orders",
            title="Order Placed Successfully",
            message=f"Order #{order_id} for {quantity} units of {product_name} has been placed.",
            related_id=order_id,
            related_type="order",
            action_label="Track Order",
            action_route="buyer-opportunities"
        )

    @staticmethod
    def notify_payment_success(buyer_id: str, order_id: str, amount: float, payment_id: str):
        store.add_notification(
            user_id=buyer_id,
            notif_type="payments",
            title="Payment Successful (Test Mode)",
            message=f"Payment of ₹{int(amount):,} for Order #{order_id} verified via Razorpay TEST MODE ({payment_id}).",
            related_id=order_id,
            related_type="payment",
            action_label="View Order",
            action_route="buyer-opportunities"
        )

    @staticmethod
    def notify_payment_failure(buyer_id: str, order_id: str, reason: str):
        store.add_notification(
            user_id=buyer_id,
            notif_type="payments",
            title="Payment Failed",
            message=f"Payment for Order #{order_id} could not be verified: {reason}",
            related_id=order_id,
            related_type="payment",
            action_label="Retry Payment",
            action_route="buyer-opportunities"
        )

    @staticmethod
    def notify_order_status_update(buyer_id: str, order_id: str, status: str, product_name: str):
        status_messages = {
            "Production Started": f"Production has officially started for your order of {product_name}.",
            "Production in Progress": f"Artisans are crafting your order of {product_name}.",
            "Quality Check": f"Your order of {product_name} has entered Quality Check inspection.",
            "Shipped": f"Your order of {product_name} has been dispatched and is on its way.",
            "Delivered": f"Your order #{order_id} of {product_name} has been successfully delivered!"
        }
        message = status_messages.get(status, f"Order #{order_id} status updated to {status}.")
        store.add_notification(
            user_id=buyer_id,
            notif_type="delivery" if status in ["Shipped", "Delivered"] else "orders",
            title=f"Order Status: {status}",
            message=message,
            related_id=order_id,
            related_type="order",
            action_label="Track Order",
            action_route="buyer-opportunities"
        )

notification_service = NotificationService()
