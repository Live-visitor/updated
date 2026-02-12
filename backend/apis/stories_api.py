from __future__ import annotations

from flask import jsonify, request, session

import db as db_layer
from backend.utils.guards import Guards


class StoriesAPI:
    """Story endpoints."""

    def register(self, app) -> None:
        app.add_url_rule("/api/stories", endpoint="stories_list", view_func=self.list_stories, methods=["GET"])
        app.add_url_rule("/api/stories", endpoint="stories_create", view_func=self.create_story, methods=["POST"])
        app.add_url_rule(
            "/api/stories/<int:story_id>/comments",
            endpoint="stories_comments_list",
            view_func=self.list_comments,
            methods=["GET"],
        )
        app.add_url_rule(
            "/api/stories/<int:story_id>/comments",
            endpoint="stories_comments_add",
            view_func=self.add_comment,
            methods=["POST"],
        )
        app.add_url_rule(
            "/api/stories/<int:story_id>/comments/<int:comment_id>",
            endpoint="stories_comments_delete",
            view_func=self.delete_comment,
            methods=["DELETE"],
        )

    def list_stories(self):
        status = (request.args.get("status") or "").strip().lower()
        category = (request.args.get("category") or "").strip().lower()

        allowed_categories = {"daytoday", "tradition", "career", "untagged"}

        stories = db_layer.list_stories()
        if status in {"ongoing", "resolved"}:
            stories = [s for s in stories if (s.get("status") or "").lower() == status]
        if category and category not in {"all"}:
            if category not in allowed_categories:
                category = "untagged"
            stories = [s for s in stories if (s.get("category") or "").lower() == category]

        return jsonify({"ok": True, "stories": stories})

    @Guards.require_login
    def create_story(self):
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        content = (data.get("content") or "").strip()
        category = (data.get("category") or "untagged").strip().lower() or "untagged"

        allowed_categories = {"daytoday", "tradition", "career", "untagged"}
        if category not in allowed_categories:
            category = "untagged"

        status = (data.get("status") or "ongoing").strip().lower()
        if status not in {"ongoing", "resolved"}:
            status = "ongoing"

        if not title or not content:
            return jsonify({"ok": False, "error": "missing_fields"}), 400

        story = db_layer.create_story(
            user_id=int(session["user_id"]),
            title=title,
            category=category,
            content=content,
            status=status,
        )
        return jsonify({"ok": True, "story": story})

    def list_comments(self, story_id: int):
        comments = db_layer.list_story_comments(int(story_id))
        return jsonify({"ok": True, "comments": comments})

    @Guards.require_login
    def add_comment(self, story_id: int):
        data = request.get_json(silent=True) or {}
        text = (data.get("text") or "").strip()
        if not text:
            return jsonify({"ok": False, "error": "missing_fields"}), 400
        c = db_layer.create_story_comment(int(story_id), int(session["user_id"]), text)
        return jsonify({"ok": True, "comment": c})

    @Guards.require_login
    def delete_comment(self, story_id: int, comment_id: int):
        """Allow comment deletion by the comment owner or an admin."""
        uid = int(session["user_id"])
        is_admin = bool(session.get("is_admin"))

        c = db_layer.get_story_comment(int(comment_id)) or {}
        if not c or int(c.get("story_id") or 0) != int(story_id):
            return jsonify({"ok": False, "error": "not_found"}), 404

        if not is_admin and int(c.get("user_id") or 0) != uid:
            return jsonify({"ok": False, "error": "forbidden"}), 403

        ok = db_layer.delete_story_comment(int(story_id), int(comment_id))
        return jsonify({"ok": True, "deleted": bool(ok)})

