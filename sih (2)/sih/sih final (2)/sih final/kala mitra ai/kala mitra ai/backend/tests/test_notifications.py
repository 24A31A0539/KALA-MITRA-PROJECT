"""
Tests for Notification Feed & Real Event Generation
"""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_notifications_feed_and_read_state():
    # 1. Fetch notifications
    res = client.get("/api/v1/notifications?user_id=buyer-demo")
    assert res.status_code == 200
    notifications = res.json()
    assert len(notifications) > 0

    first_notif = notifications[0]
    notif_id = first_notif["id"]

    # 2. Mark as read
    mark_res = client.patch(f"/api/v1/notifications/{notif_id}/read")
    assert mark_res.status_code == 200
    assert mark_res.json()["is_read"] is True

    # 3. Unread count endpoint
    count_res = client.get("/api/v1/notifications/unread-count?user_id=buyer-demo")
    assert count_res.status_code == 200
    assert "count" in count_res.json()
