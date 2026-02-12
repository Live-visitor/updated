from __future__ import annotations

import random

from flask import jsonify, request, session

import db as db_layer
from backend.utils.guards import Guards


class MatchesAPI:
    """Simple match generation endpoint.

    Prototype: matches are other users (excluding self), sorted by shared interests.
    """

    def register(self, app) -> None:
        app.add_url_rule("/api/matches", endpoint="matches_list", view_func=self.list_matches, methods=["GET"])
        app.add_url_rule("/api/matches/join", endpoint="matches_join", view_func=self.join_matchup, methods=["POST"])

    @Guards.require_login
    def list_matches(self):
        uid = int(session["user_id"])
        me = db_layer.get_user_public(uid) or {}
        others = db_layer.list_users(exclude_user_id=uid, only_matchup=True)

        # Apply the current user's saved match preference (set in profile.html)
        pref = str(me.get("match_preferences") or "any").strip().lower()

        # We store a "generation" label (e.g., Gen Z / Baby Boomer) for display,
        # but match preferences are modeled as broad age groups.
        def _infer_age_group(user: dict) -> str:
            try:
                a = int(user.get("age") or 0)
            except Exception:
                a = 0
            if a and a < 30:
                return "youth"
            if a and a >= 60:
                return "senior"
            return ""

        my_group = _infer_age_group(me)

        my_interests = set(me.get("interests") or [])
        scored = []
        for u in others:
            # Respect the profile's match preference.
            other_group = _infer_age_group(u)
            if pref == "youth" and other_group and other_group != "youth":
                continue
            if pref == "senior" and other_group and other_group != "senior":
                continue
            if pref == "opposite" and my_group in ("youth", "senior"):
                # For opposite generation matching, require the other user to be in the opposite age group.
                if other_group and other_group == my_group:
                    continue
                if other_group and other_group not in ("youth", "senior"):
                    continue
                if not other_group:
                    continue

            shared = sorted(list(my_interests.intersection(set(u.get("interests") or []))))
            scored.append((len(shared), shared, u))

     
        random.shuffle(scored)
        scored.sort(key=lambda t: t[0], reverse=True)

        matches = [{"user": u, "shared_interests": shared_list} for _, shared_list, u in scored]

        
        generation = (request.args.get("generation") or "").strip()
        if generation:
            matches = [m for m in matches if (m.get("user") or {}).get("generation") == generation]

        return jsonify({"ok": True, "matches": matches})

    @Guards.require_login
    def join_matchup(self):
        uid = int(session["user_id"])
        u = db_layer.set_user_matchup_enabled(uid, True)
        return jsonify({"ok": True, "user": u})

