from __future__ import annotations

from typing import Callable, Optional

from flask import jsonify, request, session

import db as db_layer


class AuthAPI:
    """Session-based auth endpoints.

    Constraints:
    - Plaintext passwords (NO hashing)
    - SQLite via sqlite3 helpers in db.py
    """

    def __init__(self, *, on_login_event: Optional[Callable[[dict], None]] = None) -> None:
        self._on_login_event = on_login_event

    def register(self, app) -> None:
        app.add_url_rule("/api/auth/me", endpoint="auth_me", view_func=self.me, methods=["GET"])
        app.add_url_rule("/api/auth/signup", endpoint="auth_signup", view_func=self.signup, methods=["POST"])
        app.add_url_rule("/api/auth/login", endpoint="auth_login", view_func=self.login, methods=["POST"])
        app.add_url_rule("/api/auth/admin_login", endpoint="auth_admin_login", view_func=self.admin_login, methods=["POST"])
        app.add_url_rule("/api/auth/warning_ack", endpoint="auth_warning_ack", view_func=self.warning_ack, methods=["POST"])
        app.add_url_rule("/api/auth/logout", endpoint="auth_logout", view_func=self.logout, methods=["POST"])

    def me(self):
        uid = session.get("user_id")
        if not uid:
            return jsonify({"ok": True, "user": None})

        # Need the full row for moderation gating
        full = db_layer.get_user_by_id(int(uid))
        if not full:
            session.clear()
            return jsonify({"ok": True, "user": None})

        is_susp, until = db_layer.is_user_currently_suspended(full)
        if is_susp:
            # If a suspended user still has an old session cookie, force logout.
            session.clear()
            return jsonify({"ok": True, "user": None, "suspended": {"active": True, "until": until}})

        user_public = db_layer.get_user_public(int(uid))
        pending, msg = db_layer.get_user_warning(int(uid))
        return jsonify({"ok": True, "user": user_public, "warning": {"pending": bool(pending), "message": msg}})

    def signup(self):
        data = request.get_json(silent=True) or {}
        full_name = (data.get("full_name") or data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()

        if not full_name or not email or not password:
            return jsonify({"ok": False, "error": "missing_fields"}), 400

        ok, user_row, err = db_layer.create_user(full_name=full_name, email=email, password=password)
        if not ok:
            return jsonify({"ok": False, "error": "email_exists", "message": err}), 409

        # Optional profile fields
        fields = {}
        for k in ("age", "generation", "bio", "match_preferences", "avatar"):
            if k in data and data.get(k) not in (None, ""):
                fields[k] = data.get(k)
        if fields and user_row:
            db_layer.update_user(int(user_row["id"]), fields)

        user_public = db_layer.get_user_public(int(user_row["id"])) if user_row else None
        session["user_id"] = int(user_row["id"]) if user_row else None
        session["is_admin"] = bool(user_row.get("is_admin")) if user_row else False

        self._log_login_event(email=email, user_id=session.get("user_id"), success=True)
        if user_public:
            self._emit_login_event(user=user_public, action="signup")

        return jsonify({"ok": True, "user": user_public})

    def login(self):
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()

        user = db_layer.get_user_by_email(email)
        if (not user) or (user.get("password") != password) or bool(user.get("is_banned")):
            self._log_login_event(email=email, user_id=user.get("id") if user else None, success=False)
            return jsonify({"ok": False, "error": "invalid_credentials"}), 401

        is_susp, until = db_layer.is_user_currently_suspended(user)
        if is_susp:
            self._log_login_event(email=email, user_id=int(user.get("id")), success=False)
            return jsonify({"ok": False, "error": "suspended", "suspended_until": until}), 403

        

        session["user_id"] = int(user["id"])
        session["is_admin"] = bool(user.get("is_admin"))

        self._log_login_event(email=email, user_id=int(user["id"]), success=True)
        user_public = db_layer.get_user_public(int(user["id"]))
        if user_public:
            self._emit_login_event(user=user_public, action="login")

        pending, msg = db_layer.get_user_warning(int(user["id"]))
        return jsonify({"ok": True, "user": user_public, "warning": {"pending": bool(pending), "message": msg}})

    def admin_login(self):
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()

        user = db_layer.get_user_by_email(email)
        if (not user) or bool(user.get("is_banned")) or (not bool(user.get("is_admin"))) or (user.get("password") != password):
            self._log_login_event(email=email, user_id=user.get("id") if user else None, success=False)
            return jsonify({"ok": False, "error": "invalid_admin_credentials"}), 401

        session["user_id"] = int(user["id"])
        session["is_admin"] = True

        self._log_login_event(email=email, user_id=int(user["id"]), success=True)
        user_public = db_layer.get_user_public(int(user["id"]))
        if user_public:
            self._emit_login_event(user=user_public, action="admin_login")

        pending, msg = db_layer.get_user_warning(int(user["id"]))
        return jsonify({"ok": True, "user": user_public, "warning": {"pending": bool(pending), "message": msg}})

    def logout(self):
        uid = session.get("user_id")
        user_public = db_layer.get_user_public(int(uid)) if uid else None
        session.clear()
        if user_public:
            self._emit_login_event(user=user_public, action="logout")
        return jsonify({"ok": True})

    def warning_ack(self):
        """Mark the currently logged-in user's warning as acknowledged."""
        uid = session.get("user_id")
        if not uid:
            return jsonify({"ok": False, "error": "not_logged_in"}), 401

        try:
            db_layer.ack_user_warning(int(uid))
        except Exception:
            # Keep this resilient; the UI should still proceed.
            pass

        return jsonify({"ok": True})

    def _log_login_event(self, *, email: str, user_id: Optional[int], success: bool) -> None:
        try:
            db_layer.log_login_event(
                user_id=user_id,
                email=email,
                success=bool(success),
                ip=request.remote_addr or "",
                user_agent=request.headers.get("User-Agent") or "",
            )
        except Exception:
            pass

    def _emit_login_event(self, *, user: dict, action: str) -> None:
        if not self._on_login_event:
            return
        payload = {"action": action, "user": user}
        try:
            self._on_login_event(payload)
        except Exception:
            pass
