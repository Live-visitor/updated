from __future__ import annotations

from flask import jsonify, request, session

import db as db_layer
from backend.utils.guards import Guards


class SkillSwapAPI:
    """SkillSwap posts endpoints."""

    def register(self, app) -> None:
        app.add_url_rule("/api/skillswap", endpoint="skillswap_list", view_func=self.list_posts, methods=["GET"])
        app.add_url_rule("/api/skillswap", endpoint="skillswap_create", view_func=self.create_post, methods=["POST"])

    def list_posts(self):
        post_type = (request.args.get("type") or "").strip().lower()
        category = (request.args.get("category") or "").strip().lower()

        posts = db_layer.list_skillswap_posts()
        if post_type in {"offer", "request"}:
            posts = [p for p in posts if (p.get("post_type") or "").lower() == post_type]
        allowed_categories = {"cultural", "religious", "technical", "creative", "practical", "others"}
        if category and category not in {"all"}:
            if category not in allowed_categories:
                category = "practical"
            posts = [p for p in posts if (p.get("category") or "").lower() == category]

        return jsonify({"ok": True, "posts": posts})

    @Guards.require_login
    def create_post(self):
        data = request.get_json(silent=True) or {}
        post_type = (data.get("post_type") or data.get("type") or "offer").strip().lower()

    
        if post_type in {"offering", "offer"}:
            post_type = "offer"
        elif post_type in {"seeking", "request"}:
            post_type = "request"
        else:
            post_type = "offer"


        title = (data.get("title") or "").strip() or ("Offering" if post_type == "offer" else "Request")
        category = (data.get("category") or "practical").strip().lower() or "practical"
        allowed_categories = {"cultural", "religious", "technical", "creative", "practical", "others"}
        if category not in allowed_categories:
            category = "practical"
        description = (data.get("description") or "").strip()
        if not description:
            return jsonify({"ok": False, "error": "missing_fields"}), 400

        post = db_layer.create_skillswap_post(
            user_id=int(session["user_id"]),
            post_type=post_type,
            title=title,
            category=category,
            description=description,
        )
        return jsonify({"ok": True, "post": post})
    

    