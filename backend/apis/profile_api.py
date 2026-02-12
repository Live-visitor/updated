from __future__ import annotations

from flask import jsonify, request, session

import db as db_layer
from backend.utils.guards import Guards


class ProfileAPI:
    """Profile CRUD for the currently logged-in user."""

    def register(self, app) -> None:
        app.add_url_rule("/api/profile/me", endpoint="profile_me", view_func=self.get_me, methods=["GET"])
        app.add_url_rule("/api/profile/me", endpoint="profile_update_me", view_func=self.update_me, methods=["PUT"])

    @Guards.require_login
    def get_me(self):
        uid = int(session["user_id"])
        user = db_layer.get_user_public(uid)
        if not user:
            session.clear()
            return jsonify({"ok": False, "error": "user_not_found"}), 404
        return jsonify({"ok": True, "user": user})

    @Guards.require_login
    def update_me(self):
        uid = int(session["user_id"])
        if not db_layer.get_user_by_id(uid):
            session.clear()
            return jsonify({"ok": False, "error": "user_not_found"}), 404

        data = request.get_json(silent=True) or {}

        fields = {}
        for field in [
            "full_name",
            "email",
            "age",
            "generation",
            "bio",
            "match_preferences",
            "avatar",
        ]:
            if field in data:
                fields[field] = data.get(field)

        if "email" in fields and fields["email"]:
            fields["email"] = str(fields["email"]).strip().lower()
            existing = db_layer.get_user_by_email(fields["email"])
            if existing and int(existing["id"]) != uid:
                return jsonify({"ok": False, "error": "email_exists"}), 409

        db_layer.update_user(uid, fields)

        if "interests" in data and isinstance(data.get("interests"), list):
            names = [str(x).strip().lower() for x in data.get("interests") if str(x).strip()]
            db_layer.set_user_interests(uid, names)

        return jsonify({"ok": True, "user": db_layer.get_user_public(uid)})
