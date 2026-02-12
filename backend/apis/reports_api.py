from __future__ import annotations

from typing import Callable, Optional

from flask import jsonify, request, session

import db as db_layer
from backend.utils.guards import Guards


class ReportsAPI:
    """User-submitted reports; admins review via AdminAPI."""

    def __init__(self, *, on_report: Optional[Callable[[dict], None]] = None) -> None:
        self._on_report = on_report

    def register(self, app) -> None:
        app.add_url_rule("/api/reports", endpoint="reports_create", view_func=self.create_report, methods=["POST"])

    @Guards.require_login
    def create_report(self):
        data = request.get_json(silent=True) or {}
        target_user_id = int(data.get("target_user_id") or 0)
        reason = (data.get("reason") or "").strip().lower()
        details = (data.get("details") or "").strip()

        if not target_user_id or not reason:
            return jsonify({"ok": False, "error": "missing_fields"}), 400

        if not db_layer.get_user_by_id(target_user_id):
            return jsonify({"ok": False, "error": "target_not_found"}), 404

        report = db_layer.create_report(
            reporter_id=int(session["user_id"]),
            target_user_id=target_user_id,
            reason=reason,
            details=details,
        )

        if self._on_report:
            try:
                self._on_report(report)
            except Exception:
                pass

        return jsonify({"ok": True, "report": report})
