from __future__ import annotations
from flask import jsonify, request
import db as db_layer
from backend.utils.guards import Guards
import requests
from typing import Optional
from datetime import datetime


class EventsAPI:
    """Public + admin event endpoints.
    - Users (and guests) can read upcoming events.
    - Admin can create/delete events.
    """

    GOOGLE_MAPS_API_KEY = "AIzaSyCmd16Y6Pb8uEsjsOoYuge_m1P_fncYykQ"

    def _place_text_search(self, query: str) -> Optional[tuple[float, float]]:
        """Resolve text location into (lat, lng) using Google Places Text Search API."""
        if not query or not query.strip():
            return None

        try:
            url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            params = {
                "query": query,
                "key": self.GOOGLE_MAPS_API_KEY
            }

            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return loc["lat"], loc["lng"]

            print(f"Places search failed for '{query}': {data.get('status')}")
            return None

        except Exception as e:
            print(f"Places API error for '{query}': {e}")
            return None

    def _is_upcoming(self, start_date: str, start_time: str | None = None) -> bool:
        try:
            dt_str = start_date
            if start_time:
                dt_str += f" {start_time}"
                event_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
            else:
                event_dt = datetime.strptime(dt_str, "%Y-%m-%d")
            return event_dt >= datetime.now()
        except Exception:
            return False

    def register(self, app) -> None:
        app.add_url_rule("/api/events", endpoint="events_list", view_func=self.list_events, methods=["GET"])
        app.add_url_rule("/api/events/map", endpoint="events_map", view_func=self.events_map, methods=["GET"])
        app.add_url_rule("/api/admin/events", endpoint="admin_events_list", view_func=self.admin_list_events, methods=["GET"])
        app.add_url_rule("/api/admin/events", endpoint="admin_events_create", view_func=self.admin_create_event, methods=["POST"])
        app.add_url_rule(
            "/api/admin/events/<int:event_id>",
            endpoint="admin_events_delete",
            view_func=self.admin_delete_event,
            methods=["DELETE"],
        )

    def list_events(self):
        limit = int(request.args.get("limit") or 50)
        events = db_layer.list_events(limit=limit, upcoming_only=True)
        return jsonify({"ok": True, "events": events})

    def events_map(self):
        """Return events with coordinates resolved via Places Text Search."""
        limit = int(request.args.get("limit") or 50)
        events = db_layer.list_events(limit=limit, upcoming_only=False)
        events = [ev for ev in events if self._is_upcoming(ev.get("start_date", ""), ev.get("start_time"))][:limit]

        map_events = []

        for event in events:
            location_text = event.get("location", "").strip()
            if not location_text:
                continue

            lat = event.get("latitude")
            lng = event.get("longitude")

            if lat is None or lng is None:
                coords = self._place_text_search(location_text)
                if not coords:
                    continue
                lat, lng = coords

            map_events.append({
                "id": event.get("id"),
                "title": event.get("title"),
                "start_date": event.get("start_date"),
                "start_time": event.get("start_time"),
                "location": location_text,
                "description": event.get("description"),
                "link": event.get("link"),
                "latitude": lat,
                "longitude": lng,
            })

        return jsonify({"ok": True, "events": map_events})

    @Guards.require_admin
    def admin_list_events(self):
        limit = int(request.args.get("limit") or 200)
        show_all = str(request.args.get("all") or "").strip().lower() in {"1", "true", "yes"}
        events = db_layer.list_events(limit=limit, upcoming_only=False)

        if not show_all:
            events = [ev for ev in events if self._is_upcoming(ev.get("start_date", ""), ev.get("start_time"))][:limit]

        return jsonify({"ok": True, "events": events})

    @Guards.require_admin
    def admin_create_event(self):
        data = request.get_json(silent=True) or {}

        title = (data.get("title") or "").strip()
        start_date = (data.get("start_date") or "").strip()
        start_time = (data.get("start_time") or "").strip() or None
        end_date = (data.get("end_date") or "").strip() or None
        end_time = (data.get("end_time") or "").strip() or None
        location = (data.get("location") or "").strip()
        description = (data.get("description") or "").strip()
        link = (data.get("link") or "").strip() or None

        if not title or not start_date:
            return jsonify({"ok": False, "error": "missing_fields"}), 400

        latitude, longitude = None, None
        if location:
            coords = self._place_text_search(location)
            if coords:
                latitude, longitude = coords

        ev = db_layer.create_event(
            title=title,
            start_date=start_date,
            start_time=start_time,
            location=location,
            description=description,
            end_date=end_date,
            end_time=end_time,
            link=link,
            latitude=latitude,
            longitude=longitude,
        )

        return jsonify({"ok": True, "event": ev})

    @Guards.require_admin
    def admin_delete_event(self, event_id: int):
        ok = db_layer.delete_event(int(event_id))
        return jsonify({"ok": True, "deleted": bool(ok)})
