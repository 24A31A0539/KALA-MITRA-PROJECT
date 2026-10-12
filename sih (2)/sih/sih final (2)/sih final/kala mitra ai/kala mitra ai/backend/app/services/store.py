"""
KALA-MITRA Central State Store & Persistence Manager
Provides a single backend source of truth for:
- Orders & Tracking Milestones
- Clusters & Artisan Allocations
- Notifications Feed
- Products Catalog
- User Profiles (Buyer & Artisan)
- Payments (Razorpay records)
"""

import os
import json
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from ..config import settings

LOCK = threading.Lock()

DEFAULT_ORDERS: Dict[str, dict] = {
    "KM-ORD-10245": {
        "id": "KM-ORD-10245",
        "product": "Bamboo Basket",
        "quantity": 500,
        "buyer": "GreenLeaf Hotels",
        "order_date": "04 Sep 2026",
        "expected_delivery": "15 Sep 2026",
        "total_amount": 70500,
        "status": "In Production",
        "payment_status": "Paid",
        "cluster": True,
        "cluster_id": "CL-BAMBOO-102",
        "members": [
            {"artisan_id": 1, "name": "Lakshmi Bamboo Crafts", "location": "Kakinada", "assigned": 120, "completed": 100, "status": "Completed"},
            {"artisan_id": 2, "name": "Sri Handloom Collective", "location": "Samalkota", "assigned": 100, "completed": 100, "status": "Completed"},
            {"artisan_id": 3, "name": "Godavari Woodworks", "location": "Kakinada Rural", "assigned": 150, "completed": 100, "status": "In Production"},
            {"artisan_id": 4, "name": "Sakhi Embroidery House", "location": "Yanam Road", "assigned": 130, "completed": 50, "status": "In Production"},
        ],
        "shipment": {
            "tracking_number": "KM-SHIP-84521",
            "carrier": "KALA-MITRA Logistics",
            "current_location": "Kakinada Distribution Center",
            "status": "Production in Progress",
            "estimated_delivery": "15 Sep 2026"
        },
        "timeline": ["Order Placed", "Order Confirmed", "Artisan Cluster Confirmed", "Production Started", "Production in Progress"],
    },
    "KM-ORD-10231": {
        "id": "KM-ORD-10231",
        "product": "Kalamkari Bags",
        "quantity": 200,
        "buyer": "Vastra Boutique",
        "order_date": "01 Sep 2026",
        "expected_delivery": "12 Sep 2026",
        "total_amount": 28000,
        "status": "Quality Check",
        "payment_status": "Paid",
        "cluster": True,
        "members": [
            {"artisan_id": 5, "name": "Vastra Handlooms", "location": "Mangalagiri", "assigned": 200, "completed": 200, "status": "Completed"}
        ],
        "shipment": {
            "tracking_number": "KM-SHIP-84510",
            "carrier": "KALA-MITRA Logistics",
            "current_location": "Mangalagiri Collection Center",
            "status": "Quality Check",
            "estimated_delivery": "12 Sep 2026"
        },
        "timeline": ["Order Placed", "Order Confirmed", "Artisan Cluster Confirmed", "Production Started", "Production in Progress", "Quality Check"],
    },
    "KM-ORD-10218": {
        "id": "KM-ORD-10218",
        "product": "Wooden Toys",
        "quantity": 150,
        "buyer": "Heritage Store",
        "order_date": "28 Aug 2026",
        "expected_delivery": "08 Sep 2026",
        "total_amount": 36000,
        "status": "Shipped",
        "payment_status": "Paid",
        "cluster": False,
        "members": [
            {"artisan_id": 3, "name": "Godavari Woodworks", "location": "Kakinada Rural", "assigned": 150, "completed": 150, "status": "Completed"}
        ],
        "shipment": {
            "tracking_number": "KM-SHIP-84490",
            "carrier": "KALA-MITRA Logistics",
            "current_location": "Rajahmundry Distribution Center",
            "status": "Shipped",
            "estimated_delivery": "08 Sep 2026"
        },
        "timeline": ["Order Placed", "Order Confirmed", "Production Started", "Quality Check", "Ready for Shipment", "Shipped"],
    },
    "KM-ORD-10198": {
        "id": "KM-ORD-10198",
        "product": "Jute Bags",
        "quantity": 300,
        "buyer": "EcoMarket India",
        "order_date": "20 Aug 2026",
        "expected_delivery": "01 Sep 2026",
        "total_amount": 28000,
        "status": "Delivered",
        "payment_status": "Paid",
        "cluster": True,
        "members": [
            {"artisan_id": 8, "name": "Coastal Jute Works", "location": "Pithapuram", "assigned": 300, "completed": 300, "status": "Completed"}
        ],
        "shipment": {
            "tracking_number": "KM-SHIP-84412",
            "carrier": "KALA-MITRA Logistics",
            "current_location": "Delivered",
            "status": "Delivered",
            "estimated_delivery": "01 Sep 2026"
        },
        "timeline": ["Order Placed", "Order Confirmed", "Production Started", "Quality Check", "Ready for Shipment", "Shipped", "Out for Delivery", "Delivered"],
    }
}

DEFAULT_NOTIFICATIONS: List[dict] = [
    {
        "id": "notif-init-1",
        "user_id": "buyer-demo",
        "type": "orders",
        "title": "Order Placed",
        "message": "Order #KM-ORD-10245 has been placed for Bamboo Baskets (500 units).",
        "related_id": "KM-ORD-10245",
        "related_type": "order",
        "is_read": False,
        "timestamp": "10 minutes ago",
        "action_label": "Track Order",
        "action_route": "buyer-opportunities"
    },
    {
        "id": "notif-init-3",
        "user_id": "buyer-demo",
        "type": "payments",
        "title": "Payment Successful",
        "message": "Payment verified via Razorpay TEST MODE for Order #KM-ORD-10245.",
        "related_id": "KM-ORD-10245",
        "related_type": "payment",
        "is_read": True,
        "timestamp": "1 hour ago",
        "action_label": "View Order",
        "action_route": "buyer-opportunities"
    }
]

class DataStore:
    def __init__(self, filepath: str = settings.DATA_STORE_PATH):
        self.filepath = filepath
        self.orders: Dict[str, dict] = {}
        self.clusters: Dict[str, dict] = {}
        self.notifications: List[dict] = []
        self.users: Dict[str, dict] = {}
        self.payments: Dict[str, dict] = {}
        self._load()

    def _load(self):
        with LOCK:
            if os.path.exists(self.filepath):
                try:
                    with open(self.filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.orders = data.get("orders", DEFAULT_ORDERS.copy())
                        self.clusters = data.get("clusters", {})
                        self.notifications = data.get("notifications", DEFAULT_NOTIFICATIONS.copy())
                        self.users = data.get("users", {})
                        self.payments = data.get("payments", {})
                        return
                except Exception:
                    pass
            # Default initialization
            self.orders = {k: v.copy() for k, v in DEFAULT_ORDERS.items()}
            self.clusters = {}
            self.notifications = [n.copy() for n in DEFAULT_NOTIFICATIONS]
            self.users = {}
            self.payments = {}
            self._save_unlocked()

    def _save_unlocked(self):
        try:
            os.makedirs(os.path.dirname(self.filepath), exist_ok=True)
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump({
                    "orders": self.orders,
                    "clusters": self.clusters,
                    "notifications": self.notifications,
                    "users": self.users,
                    "payments": self.payments,
                }, f, indent=2)
        except Exception as e:
            print(f"[Store] Warning: could not write to {self.filepath}: {e}")

    def save(self):
        with LOCK:
            self._save_unlocked()

    def add_notification(
        self,
        user_id: str,
        notif_type: str,
        title: str,
        message: str,
        related_id: str = "",
        related_type: str = "",
        action_label: str = "View",
        action_route: str = "buyer-home"
    ) -> dict:
        notif = {
            "id": f"notif-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "user_id": user_id,
            "type": notif_type,
            "title": title,
            "message": message,
            "related_id": related_id,
            "related_type": related_type,
            "is_read": False,
            "timestamp": "Just now",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "action_label": action_label,
            "action_route": action_route
        }
        with LOCK:
            self.notifications.insert(0, notif)
            self._save_unlocked()
        return notif

store = DataStore()
