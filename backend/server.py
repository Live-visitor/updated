"""Flask + SQLite backend with pseudo-realtime (SSE).

Important note:
The execution environment for this build does not include `flask-socketio`.
To preserve the "real-time" user experience while keeping the project runnable
out of the box, the app implements Server-Sent Events (SSE) and a small
client-side realtime wrapper.

All business logic remains class-per-file.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Optional


_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from flask import Flask, Response, jsonify, redirect, request, send_from_directory, session
from flask_cors import CORS  # ← ADDED THIS

from db import init_db
from backend.realtime.hub import RealtimeHub

from backend.apis.auth_api import AuthAPI
from backend.apis.AI_chatbot import ChatbotAPI
from backend.apis.translator import Translator
from backend.apis.events_api import EventsAPI
from backend.apis.profile_api import ProfileAPI
from backend.apis.stories_api import StoriesAPI
from backend.apis.skillswap_api import SkillSwapAPI
from backend.apis.matches_api import MatchesAPI
from backend.apis.messages_api import MessagesAPI
from backend.apis.notifications_api import NotificationsAPI
from backend.apis.reports_api import ReportsAPI
from backend.apis.admin_api import AdminAPI
from backend.utils.guards import Guards




class RealtimeService:
    """In-memory per-user event queues exposed via SSE."""

    def __init__(self) -> None:
        self._queues: Dict[int, list] = {}

    def _q(self, user_id: int) -> list:
        return self._queues.setdefault(int(user_id), [])

    def push(self, user_id: int, event: str, data: dict) -> None:
        self._q(user_id).append({"event": event, "data": data})

    def push_admin(self, event: str, data: dict) -> None:
        # Push to all currently-known admin users (simple prototype).
        # Admin sessions will receive only if connected to SSE stream.
        for uid in list(self._queues.keys()):
            self._q(uid).append({"event": event, "data": data, "admin": True})

    def pop(self, user_id: int) -> Optional[dict]:
        q = self._q(user_id)
        if not q:
            return None
        return q.pop(0)


def create_app() -> Flask:
    root_dir = Path(__file__).resolve().parents[1]
    app = Flask(__name__, static_folder=str(root_dir), static_url_path="")

    # ← ADDED THIS LINE - Enable CORS for all routes
    CORS(app)

    app.config["SECRET_KEY"] = os.environ.get("GENBRIDGE_SECRET", "dev_secret_key")
    app.config["SQLITE_PATH"] = os.environ.get("GENBRIDGE_SQLITE_PATH", str(root_dir / "app.db"))

    # Create schema + seed data
    with app.app_context():
        init_db(app)

    hub = RealtimeHub()
    rt = RealtimeService()

    _register_static_routes(app, root_dir)
    _register_realtime_routes(app, hub, rt)
    _register_api_routes(app, hub, rt)

    return app


def _register_static_routes(app: Flask, root_dir: Path) -> None:
    # Project uses these admin HTML files.
    admin_pages = {
        "adminhome.html",
        "adminmatch.html",
        "adminevents.html",
        "adminsettings.html",
        "adminskillswap.html",
        "adminstories.html",
        "adminlog.html",
    }

    @app.before_request
    def _protect_admin_pages():
        path = (request.path or "").lstrip("/")
        if path in admin_pages:
            # adminlog.html remains accessible, but dashboard pages require admin.
            if path == "adminlog.html":
                return None
            if not session.get("user_id") or not session.get("is_admin"):
                return redirect("/adminlog.html")
        return None

    @app.get("/")
    def root():
        return redirect("/index.html")

    @app.get("/<path:filename>")
    def static_files(filename: str):
        return send_from_directory(str(root_dir), filename)



def _register_realtime_routes(app: Flask, hub: RealtimeHub, rt: RealtimeService) -> None:
    @app.get("/api/realtime/stream")
    @Guards.require_login
    def stream():
        user_id = int(session["user_id"])
        is_admin = bool(session.get("is_admin"))

        def gen():
        # Initial presence update
            yield "event: ready\n" + "data: {}\n\n"

            last_keepalive = time.time()
            while True:
                item = rt.pop(user_id)
                if item:
                    if item.get("admin") and not is_admin:
                        continue
                    event = item.get("event")
                    data = item.get("data")
                    yield f"event: {event}\n" + f"data: {json.dumps(data)}\n\n"
                    continue

                now = time.time()
                if now - last_keepalive > 20:
                    yield "event: keepalive\n" + "data: {}\n\n"
                    last_keepalive = now
                time.sleep(0.5)

        return Response(gen(), mimetype="text/event-stream")

    @app.post("/api/realtime/presence")
    @Guards.require_login
    def presence():
        data = request.get_json(silent=True) or {}
        page = (data.get("page") or "").strip().lower()
        if not page:
            page = "unknown"
        hub.set_presence(int(session["user_id"]), page=page)
        return jsonify({"ok": True})


def _register_api_routes(app: Flask, hub: RealtimeHub, rt: RealtimeService) -> None:

    def on_message(message_dict: dict, *, recipient_id: int, sender_id: int) -> None:
        rt.push(recipient_id, "message:new", message_dict)
        rt.push(sender_id, "message:new", message_dict)

    def on_notification(notification_dict: dict, *, user_id: int) -> None:
        rt.push(user_id, "notification:new", notification_dict)

    def on_login_event(login_dict: dict) -> None:
        rt.push_admin("login:event", login_dict)

    def on_report(report_dict: dict) -> None:
        rt.push_admin("report:new", report_dict)

    AuthAPI(on_login_event=on_login_event).register(app)
    ProfileAPI().register(app)
    StoriesAPI().register(app)
    SkillSwapAPI().register(app)
    EventsAPI().register(app)
    MatchesAPI().register(app)
    MessagesAPI(hub=hub, on_message=on_message, on_notification=on_notification).register(app)
    NotificationsAPI(on_notification=on_notification).register(app)
    ReportsAPI(on_report=on_report).register(app)
    AdminAPI().register(app)
    ChatbotAPI().register(app) 
    Translator().register(app)