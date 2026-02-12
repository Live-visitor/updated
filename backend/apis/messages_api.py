from __future__ import annotations

from typing import Callable, Optional

from flask import jsonify, request, session

import db as db_layer
from backend.realtime.hub import RealtimeHub
from backend.utils.guards import Guards


class MessagesAPI:
    """Messaging endpoints.

    Endpoints used by frontend:
    - GET /api/messages/contacts
    - GET /api/messages/thread/<other_id>
    - POST /api/messages/send {recipient_id, text}

    Real-time behavior:
    - Always emit message:new to sender and recipient via callback.
    - Create a notification for the recipient *only if* recipient is NOT on messages page.
    """

    def __init__(
        self,
        *,
        hub: RealtimeHub,
        on_message: Optional[Callable[[dict], None]] = None,
        on_notification: Optional[Callable[[dict], None]] = None,
    ) -> None:
        self.hub = hub
        self._on_message = on_message
        self._on_notification = on_notification

    def register(self, app) -> None:
        app.add_url_rule("/api/messages/contacts", endpoint="messages_contacts", view_func=self.contacts, methods=["GET"])
        app.add_url_rule("/api/messages/thread/<int:other_id>", endpoint="messages_thread", view_func=self.thread, methods=["GET"])
        app.add_url_rule("/api/messages/send", endpoint="messages_send", view_func=self.send, methods=["POST"])

    @Guards.require_login
    def contacts(self):
        uid = int(session["user_id"])
        contacts = db_layer.list_contacts_for_user(uid)
        # Add presence state
        for c in contacts:
            c["name"] = c.get("full_name") or c.get("name") or ""
            c["online"] = bool(self.hub.get_presence(int(c["id"])).page)
        return jsonify({"ok": True, "contacts": contacts})

    @Guards.require_login
    def thread(self, other_id: int):
        uid = int(session["user_id"])
        msgs = db_layer.list_thread(uid, int(other_id))
        return jsonify({"ok": True, "messages": msgs})

    @Guards.require_login
    def send(self):
        uid = int(session["user_id"])
        data = request.get_json(silent=True) or {}
        recipient_id = int(data.get("recipient_id") or 0)
        text = (data.get("text") or "").strip()
        if not recipient_id or not text:
            return jsonify({"ok": False, "error": "missing_fields"}), 400

        msg = db_layer.create_message(sender_id=uid, recipient_id=recipient_id, text=text)

        # Emit realtime message
        if self._on_message:
            try:
                self._on_message(msg, recipient_id=recipient_id, sender_id=uid)
            except TypeError:
                # Backward-compat if callback has different signature
                try:
                    self._on_message(msg)
                except Exception:
                    pass
            except Exception:
                pass

        # Notification suppression rule
        if not self.hub.is_on_messages_page(recipient_id):
            sender = db_layer.get_user_public(uid) or {}
            title = f"New message from {sender.get('full_name') or 'Someone'}"
            notif = db_layer.create_notification(
                user_id=recipient_id,
                notif_type="message",
                icon="💬",
                title=title,
                content=text[:120],
                link=f"/messages.html?contact={uid}",
            )
            if self._on_notification:
                try:
                    self._on_notification(notif, user_id=recipient_id)
                except TypeError:
                    try:
                        self._on_notification(notif)
                    except Exception:
                        pass
                except Exception:
                    pass

        return jsonify({"ok": True, "message": msg})
