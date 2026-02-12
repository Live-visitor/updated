from __future__ import annotations

from datetime import datetime, timedelta, timezone

from flask import jsonify, request

import db as db_layer
from backend.utils.guards import Guards


class AdminAPI:
    """Admin-only dashboards and moderation actions."""

    def register(self, app) -> None:
        app.add_url_rule("/api/admin/summary", endpoint="admin_summary", view_func=self.summary, methods=["GET"])
        app.add_url_rule("/api/admin/logins", endpoint="admin_logins", view_func=self.list_logins, methods=["GET"])
        app.add_url_rule("/api/admin/reports", endpoint="admin_reports_list", view_func=self.list_reports, methods=["GET"])
        app.add_url_rule("/api/admin/reports/<int:report_id>", endpoint="admin_reports_update", view_func=self.update_report, methods=["PUT"])
        app.add_url_rule(
            "/api/admin/reports/<int:report_id>/warn",
            endpoint="admin_reports_warn",
            view_func=self.warn_from_report,
            methods=["POST"],
        )
        app.add_url_rule(
            "/api/admin/reports/<int:report_id>/suspend",
            endpoint="admin_reports_suspend",
            view_func=self.suspend_from_report,
            methods=["POST"],
        )
        app.add_url_rule("/api/admin/users", endpoint="admin_users", view_func=self.list_users, methods=["GET"])
        app.add_url_rule("/api/admin/matchup", endpoint="admin_matchup", view_func=self.list_matchup, methods=["GET"])
        app.add_url_rule("/api/admin/users/<int:user_id>/ban", endpoint="admin_user_ban", view_func=self.ban_user, methods=["POST"])
        app.add_url_rule("/api/admin/users/<int:user_id>", endpoint="admin_user_delete", view_func=self.delete_user, methods=["DELETE"])
        app.add_url_rule("/api/admin/stories", endpoint="admin_stories", view_func=self.list_stories, methods=["GET"])
        app.add_url_rule("/api/admin/stories/<int:story_id>", endpoint="admin_story_delete", view_func=self.delete_story, methods=["DELETE"])
        app.add_url_rule(
            "/api/admin/stories/<int:story_id>/comments/<int:comment_id>",
            endpoint="admin_story_comment_delete",
            view_func=self.delete_story_comment,
            methods=["DELETE"],
        )
        app.add_url_rule("/api/admin/skillswap", endpoint="admin_skillswap", view_func=self.list_skillswap, methods=["GET"])
        app.add_url_rule("/api/admin/skillswap/<int:post_id>", endpoint="admin_skillswap_delete", view_func=self.delete_skillswap, methods=["DELETE"])

    @Guards.require_admin
    def summary(self):
        users = db_layer.list_users()
        stories = db_layer.list_stories()
        posts = db_layer.list_skillswap_posts()
        reports = db_layer.list_reports(limit=500)
        pending = [r for r in reports if (r.get("status") or "").lower() == "pending"]

        return jsonify(
            {
                "ok": True,
                "counts": {
                    "users": len(users),
                    "stories": len(stories),
                    "skillswap_posts": len(posts),
                    "reports_pending": len(pending),
                },
            }
        )

    @Guards.require_admin
    def list_logins(self):
        limit = int(request.args.get("limit") or 50)
        events = db_layer.list_login_events(limit=limit)
        return jsonify({"ok": True, "logins": events})

    @Guards.require_admin
    def list_reports(self):
        status = (request.args.get("status") or "").strip().lower()
        reports = db_layer.list_reports(limit=500)
        if status in {"pending", "resolved", "dismissed"}:
            reports = [r for r in reports if (r.get("status") or "").lower() == status]
        return jsonify({"ok": True, "reports": reports})

    @Guards.require_admin
    def update_report(self, report_id: int):
        data = request.get_json(silent=True) or {}
        status = (data.get("status") or "").strip().lower()
        if status not in {"pending", "resolved", "dismissed"}:
            return jsonify({"ok": False, "error": "invalid_status"}), 400

        rep = db_layer.update_report_status(int(report_id), status)
        if not rep:
            return jsonify({"ok": False, "error": "not_found"}), 404
        return jsonify({"ok": True, "report": rep})

    @Guards.require_admin
    def warn_from_report(self, report_id: int):
        rep = db_layer.get_report(int(report_id))
        if not rep:
            return jsonify({"ok": False, "error": "not_found"}), 404

        target = rep.get("target_user") or {}
        target_id = rep.get("target_user_id")

        # Auto-generated warning message (no free-text from admin UI)
        # NOTE: Per requirement, we do NOT include the report's reason/details in the user-facing warning.
        msg = (
            "⚠️ Official Warning\n\n"
            "We received a report about your behavior on GenerationBridge. "
            "Please follow the community guidelines and keep interactions respectful.\n\n"
            "Further reports may result in a temporary suspension or a permanent ban."
        )

        if target_id:
            db_layer.set_user_warning(int(target_id), msg)
            # Also send a notification so it shows in the bell menu.
            db_layer.create_notification(
                int(target_id),
                "moderation",
                "⚠️",
                "Account warning",
                msg,
                link="index.html",
            )

        # Dismiss the report after action
        rep2 = db_layer.update_report_status(int(report_id), "dismissed")
        return jsonify({"ok": True, "report": rep2 or rep, "target": target})

    @Guards.require_admin
    def suspend_from_report(self, report_id: int):
        rep = db_layer.get_report(int(report_id))
        if not rep:
            return jsonify({"ok": False, "error": "not_found"}), 404

        target_id = rep.get("target_user_id")
        reason = (rep.get("reason") or "").strip()

        if not target_id:
            return jsonify({"ok": False, "error": "invalid_target"}), 400

        until_dt = datetime.now(timezone.utc) + timedelta(days=3)
        until_iso = until_dt.isoformat()

        db_layer.set_user_suspension(int(target_id), until_iso)

        msg = (
            "⏸️ Temporary Suspension (3 days)\n\n"
            "Your account has been temporarily suspended for 3 days due to a report received by the moderators.\n\n"
            "You can log in again after the suspension period ends."
        )
        db_layer.create_notification(int(target_id), "moderation", "⏸️", "Account suspended", msg, link="login.html")

        rep2 = db_layer.update_report_status(int(report_id), "dismissed")
        return jsonify({"ok": True, "report": rep2 or rep, "suspended_until": until_iso})

    @Guards.require_admin
    def list_users(self):
        return jsonify({"ok": True, "users": db_layer.list_users()})

    @Guards.require_admin
    def list_matchup(self):
        """Users currently visible in Match-Up (show_in_matchup=1)."""
        return jsonify({"ok": True, "users": db_layer.list_users(only_matchup=True)})

    @Guards.require_admin
    def list_stories(self):
        return jsonify({"ok": True, "stories": db_layer.list_stories()})

    @Guards.require_admin
    def list_skillswap(self):
        return jsonify({"ok": True, "posts": db_layer.list_skillswap_posts()})

    # ---- Moderation actions ----

    @Guards.require_admin
    def ban_user(self, user_id: int):
        u = db_layer.set_user_banned(int(user_id), True)
        if not u:
            return jsonify({"ok": False, "error": "not_found"}), 404
        return jsonify({"ok": True, "user": u})

    @Guards.require_admin
    def delete_user(self, user_id: int):
        ok = db_layer.delete_user(int(user_id))
        return jsonify({"ok": True, "deleted": bool(ok)})

    @Guards.require_admin
    def delete_story(self, story_id: int):
        ok = db_layer.delete_story(int(story_id))
        return jsonify({"ok": True, "deleted": bool(ok)})

    @Guards.require_admin
    def delete_story_comment(self, story_id: int, comment_id: int):
        ok = db_layer.delete_story_comment(int(story_id), int(comment_id))
        return jsonify({"ok": True, "deleted": bool(ok)})

    @Guards.require_admin
    def delete_skillswap(self, post_id: int):
        ok = db_layer.delete_skillswap_post(int(post_id))
        return jsonify({"ok": True, "deleted": bool(ok)})
