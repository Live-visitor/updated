from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Dict, Optional


@dataclass
class Presence:
    page: str = ""
    active_contact_id: Optional[int] = None


class RealtimeHub:
    """In-memory presence tracker.

    Used for the rule: send notifications for new messages only when recipient is
    NOT currently on the messages page.

    This is intentionally ephemeral ("fake real-time DB") and resets on restart.
    Messages and notifications themselves persist in SQLite.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._presence: Dict[int, Presence] = {}

    def set_presence(self, user_id: int, *, page: str, active_contact_id: Optional[int] = None) -> None:
        with self._lock:
            self._presence[user_id] = Presence(page=page, active_contact_id=active_contact_id)

    def clear_presence(self, user_id: int) -> None:
        with self._lock:
            self._presence.pop(user_id, None)

    def get_presence(self, user_id: int) -> Presence:
        with self._lock:
            return self._presence.get(user_id, Presence())

    def is_on_messages_page(self, user_id: int) -> bool:
        p = self.get_presence(user_id)
        return (p.page or "").lower() == "messages"
