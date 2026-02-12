from __future__ import annotations

from functools import wraps
from typing import Callable, TypeVar

from flask import jsonify, session

F = TypeVar("F", bound=Callable)


class Guards:
    """Authentication/authorization helpers using Flask session cookies."""

    @staticmethod
    def require_login(fn: F) -> F:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not session.get("user_id"):
                return jsonify({"ok": False, "error": "auth_required"}), 401
            return fn(*args, **kwargs)

        return wrapper  # type: ignore

    @staticmethod
    def require_admin(fn: F) -> F:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not session.get("user_id"):
                return jsonify({"ok": False, "error": "auth_required"}), 401
            if not session.get("is_admin"):
                return jsonify({"ok": False, "error": "admin_required"}), 403
            return fn(*args, **kwargs)

        return wrapper  # type: ignore
