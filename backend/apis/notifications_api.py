from __future__ import annotations

from typing import Callable, Optional

from flask import jsonify, session

import db as db_layer
from backend.utils.guards import Guards


class NotificationsAPI:
    def __init__(self, *, on_notification: Optional[Callable[[dict], None]] = None) -> None:
        self._on_notification = on_notification

    def register(self, app) -> None:
        app.add_url_rule("/api/notifications", endpoint="notifications_list", view_func=self.list_notifications, methods=["GET"])
        app.add_url_rule("/api/notifications/clear", endpoint="notifications_clear", view_func=self.clear_all, methods=["POST"])
        app.add_url_rule("/api/notifications/mark_all_read", endpoint="notifications_mark_all_read", view_func=self.mark_all_read, methods=["POST"])

    @Guards.require_login
    def list_notifications(self):
        uid = int(session["user_id"])
        notifs = db_layer.list_notifications(uid, limit=50)
        return jsonify({"ok": True, "notifications": notifs})

    @Guards.require_login
    def clear_all(self):
        uid = int(session["user_id"])
        db_layer.clear_notifications(uid)
        return jsonify({"ok": True})

    @Guards.require_login
    def mark_all_read(self):
        uid = int(session["user_id"])
        db_layer.mark_all_notifications_read(uid)
        return jsonify({"ok": True})
