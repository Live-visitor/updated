"""SQLite (sqlite3) database layer for GenerationBridge.

Prototype constraints:
- Plaintext passwords (NO hashing)
- SQLite persistence
- Dict-based CRUD helpers (no ORM)

The rest of the backend imports and uses these functions.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone, date
from typing import Any, Dict, List, Optional, Tuple
import pytz 


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


class DB:
    """Very small helper wrapper around sqlite3."""

    def __init__(self) -> None:
        self._path: Optional[str] = None

    def init_app(self, app) -> None:
        self._path = app.config["SQLITE_PATH"]

    def connect(self) -> sqlite3.Connection:
        if not self._path:
            raise RuntimeError("DB not initialized; call db.init_app(app)")
        conn = sqlite3.connect(self._path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn


# Singleton used by APIs
_db = DB()


def init_db(app) -> None:
    """Create (or migrate) schema + seed data.

    Constraints:
    - Plaintext passwords (NO hashing)
    - SQLite persistence
    - Seed demo data for testing
    """
    _db.init_app(app)
    conn = _db.connect()
    try:
        # Base schema (idempotent)
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                age INTEGER,
                generation TEXT,
                bio TEXT,
                match_preferences TEXT,
                avatar TEXT,
                is_admin INTEGER NOT NULL DEFAULT 0,
                is_banned INTEGER NOT NULL DEFAULT 0,
                show_in_matchup INTEGER NOT NULL DEFAULT 0,
                suspended_until TEXT,
                warning_message TEXT,
                warning_ack INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS interests (
                name TEXT PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS user_interests (
                user_id INTEGER NOT NULL,
                interest_name TEXT NOT NULL,
                PRIMARY KEY (user_id, interest_name),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (interest_name) REFERENCES interests(name) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS stories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                content TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ongoing',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS story_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                story_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS skillswap_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                post_type TEXT NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                location TEXT,
                start_date TEXT NOT NULL,
                start_time TEXT,
                end_date TEXT,
                end_time TEXT,
                link TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                recipient_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                notif_type TEXT NOT NULL,
                icon TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                link TEXT,
                created_at TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL,
                target_user_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                details TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS login_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                email TEXT,
                success INTEGER NOT NULL,
                ip TEXT,
                user_agent TEXT,
                created_at TEXT NOT NULL
            );
            """
        )

        # Lightweight migrations for older DB files
        # NOTE: If you add a column, refresh the pragma list before checking again,
        # otherwise duplicate ALTERs can crash startup.
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "is_banned" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0")
            cols = [r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "show_in_matchup" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN show_in_matchup INTEGER NOT NULL DEFAULT 0")
            cols = [r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()]

        # Moderation gating
        if "suspended_until" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN suspended_until TEXT")
            cols = [r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "warning_message" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN warning_message TEXT")
            cols = [r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "warning_ack" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN warning_ack INTEGER NOT NULL DEFAULT 1")

        # Migration: Add latitude and longitude columns to events table
        event_cols = [r["name"] for r in conn.execute("PRAGMA table_info(events)").fetchall()]
        if "latitude" not in event_cols:
            conn.execute("ALTER TABLE events ADD COLUMN latitude REAL")
            event_cols = [r["name"] for r in conn.execute("PRAGMA table_info(events)").fetchall()]
        if "longitude" not in event_cols:
            conn.execute("ALTER TABLE events ADD COLUMN longitude REAL")

        # Seed baseline interests
        base_interests = [
            "tech", "art", "music", "cooking", "reading", "sports", "gaming", "practical",
            "cultural", "religious", "technical", "creative"
        ]
        for name in base_interests:
            conn.execute("INSERT OR IGNORE INTO interests(name) VALUES (?)", (name,))

        # Enforce single admin credential
        ADMIN_EMAIL = "admin@generationbridge.com"
        ADMIN_PASSWORD = "admin123"

        # Upsert admin + baseline users + required demo users
        seeds = [
            # Admin (only one)
            ("Admin", ADMIN_EMAIL, ADMIN_PASSWORD, 30, "Gen Y", "Platform admin", "", "🛡️", 1),

            # Required demo users for testing
            ("Eleanor Martinez", "eleanor.martinez@generationbridge.com", "123456", 54, "Baby Boomer",
             "Enjoys sharing life experience and learning new tech.", "Looking for friendly chats.", "👩‍🦳", 0),
            ("David Miller", "david.miller@generationbridge.com", "123456", 34, "Gen Y",
             "Curious about culture and mentoring.", "Prefer weekend meetups.", "👨‍💼", 0),
            ("Robert Thompson", "robert.thompson@generationbridge.com", "123456", 61, "Baby Boomer",
             "Retired engineer open to mentoring and learning.", "Looking for practical exchanges.", "👴", 0),
            ("Sophie Johnson", "sophie.johnson@generationbridge.com", "123456", 22, "Gen Z",
             "Student who loves creative projects and learning.", "Prefer quick sessions.", "👩‍🎓", 0),

            # Extra users to ensure Match-Up always has matches
            ("Alice Tan", "alice@example.com", "123456", 21, "Gen Z", "Hi, I'm Alice.", "", "😊", 0),
            ("Mr Lim", "mr_lim@example.com", "123456", 52, "Gen X", "Happy to mentor.", "", "👨‍🏫", 0),
            ("Mei Chen", "mei.chen@example.com", "123456", 29, "Gen Y", "Enjoys cooking and culture.", "", "👩‍🍳", 0),
            ("Jason Ng", "jason.ng@example.com", "123456", 45, "Gen X", "DIY and practical skills enthusiast.", "", "🧰", 0),
        ]

        for full_name, email, password, age, gen, bio, mp, avatar, is_admin in seeds:
            conn.execute(
                """
                INSERT OR IGNORE INTO users(full_name,email,password,age,generation,bio,match_preferences,avatar,is_admin,is_banned)
                VALUES (?,?,?,?,?,?,?,?,?,0)
                """,
                (full_name, email, password, age, gen, bio, mp, avatar, is_admin),
            )

        # Make absolutely sure only ADMIN_EMAIL is admin
        conn.execute("UPDATE users SET is_admin=0")
        conn.execute("UPDATE users SET is_admin=1, password=? WHERE email=?", (ADMIN_PASSWORD, ADMIN_EMAIL))

        # Ensure required demo users appear in Match-Up by default
        conn.execute(
            """
            UPDATE users
            SET show_in_matchup=1
            WHERE email IN (?,?,?,?)
            """,
            (
                "eleanor.martinez@generationbridge.com",
                "david.miller@generationbridge.com",
                "robert.thompson@generationbridge.com",
                "sophie.johnson@generationbridge.com",
            ),
        )

        # Seed interests per user (lightweight for matching)
        email_to_interests = {
            ADMIN_EMAIL: ["practical"],
            "eleanor.martinez@generationbridge.com": ["cultural", "reading", "practical"],
            "david.miller@generationbridge.com": ["cultural", "technical", "reading"],
            "robert.thompson@generationbridge.com": ["technical", "practical", "reading"],
            "sophie.johnson@generationbridge.com": ["creative", "tech", "music"],
            "alice@example.com": ["tech", "creative", "gaming"],
            "mr_lim@example.com": ["practical", "technical", "reading"],
            "mei.chen@example.com": ["cooking", "cultural", "music"],
            "jason.ng@example.com": ["practical", "sports", "technical"],
        }
        email_to_id = {r["email"]: r["id"] for r in conn.execute("SELECT id,email FROM users").fetchall()}
        for email, ints in email_to_interests.items():
            uid = email_to_id.get(email)
            if not uid:
                continue
            conn.execute("DELETE FROM user_interests WHERE user_id=?", (int(uid),))
            for name in ints:
                conn.execute("INSERT OR IGNORE INTO interests(name) VALUES (?)", (name,))
                conn.execute(
                    "INSERT OR IGNORE INTO user_interests(user_id,interest_name) VALUES (?,?)",
                    (int(uid), name),
                )

        # Seed sample stories and comments (categories restricted to 4)
        allowed_story_categories = {"daytoday", "tradition", "career", "untagged"}
        story_count = conn.execute("SELECT COUNT(*) FROM stories").fetchone()[0]
        if story_count == 0:
            def _ins_story(email: str, title: str, category: str, content: str, status: str):
                uid = email_to_id.get(email) or 1
                cat = category if category in allowed_story_categories else "untagged"
                conn.execute(
                    "INSERT INTO stories(user_id,title,category,content,status,created_at) VALUES (?,?,?,?,?,?)",
                    (int(uid), title, cat, content, status, utcnow_iso()),
                )

            _ins_story("sophie.johnson@generationbridge.com",
                       "Balancing school and part-time work",
                       "daytoday",
                       "I am struggling to balance classes, assignments, and a part-time job. Any tips from someone who has been through this?",
                       "ongoing")
            _ins_story("robert.thompson@generationbridge.com",
                       "Career change after 50",
                       "career",
                       "I would like to share my experience switching careers later in life and hear others' perspectives on staying relevant.",
                       "ongoing")
            _ins_story("eleanor.martinez@generationbridge.com",
                       "Keeping traditions alive in a modern family",
                       "tradition",
                       "How do you keep family traditions meaningful when everyone is busy and lives far apart?",
                       "resolved")
            _ins_story("david.miller@generationbridge.com",
                       "Finding community in a new city",
                       "untagged",
                       "Recently moved and finding it hard to build a social circle. What worked for you?",
                       "ongoing")

        # Normalize any existing stories to allowed categories
        conn.execute(
            "UPDATE stories SET category='untagged' WHERE lower(category) NOT IN ('daytoday','tradition','career','untagged')"
        )

        # Seed comments if none exist
        comment_count = conn.execute("SELECT COUNT(*) FROM story_comments").fetchone()[0]
        if comment_count == 0:
            # Add a few comments to the most recent stories
            story_rows = conn.execute("SELECT id,user_id FROM stories ORDER BY id DESC LIMIT 3").fetchall()
            for sr in story_rows:
                sid = sr["id"]
                # Commenters: Alice and Mr Lim if available
                for commenter_email, text in [
                    ("alice@example.com", "I relate to this. One thing that helped me was planning my week in blocks."),
                    ("mr_lim@example.com", "Try small consistent steps—habit building is more sustainable than big changes."),
                ]:
                    uid = email_to_id.get(commenter_email)
                    if not uid:
                        continue
                    conn.execute(
                        "INSERT INTO story_comments(story_id,user_id,text,created_at) VALUES (?,?,?,?)",
                        (int(sid), int(uid), text, utcnow_iso()),
                    )

        # Seed skillswap posts if empty (use categories present in filter bar)
        skill_count = conn.execute("SELECT COUNT(*) FROM skillswap_posts").fetchone()[0]
        if skill_count == 0:
            def _ins_skill(email: str, post_type: str, title: str, category: str, desc: str):
                uid = email_to_id.get(email) or 1
                conn.execute(
                    "INSERT INTO skillswap_posts(user_id,post_type,title,category,description,created_at) VALUES (?,?,?,?,?,?)",
                    (int(uid), post_type, title, category, desc, utcnow_iso()),
                )

            _ins_skill("robert.thompson@generationbridge.com", "offer", "Excel Basics for Budgeting", "practical",
                       "I can teach formulas, pivot tables, and simple budgets. Availability: Weeknights 8–10pm.")
            _ins_skill("sophie.johnson@generationbridge.com", "offer", "Intro to Video Editing (Mobile)", "creative",
                       "Learn quick edits for short-form videos. Availability: Weekends 2–6pm.")
            _ins_skill("eleanor.martinez@generationbridge.com", "offer", "Traditional Family Recipes", "cultural",
                       "Cooking session sharing classic family recipes. Availability: Saturday mornings.")
            _ins_skill("david.miller@generationbridge.com", "request", "Public Speaking Practice", "practical",
                       "Seeking coaching for confident presentations. Prefer 30-minute sessions.")
            _ins_skill("alice@example.com", "request", "Basic Networking / LinkedIn Tips", "technical",
                       "Need help improving my profile and networking approach.")
            _ins_skill("mr_lim@example.com", "offer", "Interview Preparation Mentoring", "technical",
                       "Mock interviews and resume feedback. Availability: Tue/Thu 7–9pm.")

        # ---- Seed sample events (from OnePA + SAFRA) ----
        event_count = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        if event_count == 0:
            def _ins_event(title, desc, loc, sd, st="", ed="", et="", link="", lat=None, lng=None):
                conn.execute(
                    """
                    INSERT INTO events
                    (title, description, location, start_date, start_time, end_date, end_time, link, latitude, longitude, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (title, desc, loc, sd, st, ed, et, link, lat, lng, utcnow_iso())
                )
            # 1) Punggol Meadows RC Line Dance Interest Group
            _ins_event(
                "Punggol Meadows RC Line Dance Interest Group",
                "Community line dance interest group session organised by Punggol Meadows RC.",
                "Punggol Meadows Community Centre, Singapore",
                "2026-05-01",
                "",
                "",
                "",
                "https://www.onepa.gov.sg/events/punggol-meadows-rc-line-dance-interest-group-64220439"
            )
            # 2) Jurong Spring CACC Giant Delight 2025
            _ins_event(
                "Jurong Spring CACC Giant Delight 2025",
                "Community celebration and family activity event by Jurong Spring CACC.",
                "Jurong Spring, Singapore",
                "2025-06-25",
                "",
                "",
                "",
                "https://www.onepa.gov.sg/events/jurong-spring-cacc-giant-delight-2025-62571032"
            )
            # 3) SAFRA – What's New in February 2026 (Event Listing)
            _ins_event(
                "SAFRA – What's New in February 2026",
                "Official SAFRA listing of February 2026 events including Total Defence 2026, Lunar New Year celebrations, and Buddies Day Out.",
                "Multiple SAFRA Clubs, Singapore",
                "2026-02-01",
                "",
                "",
                "",
                "https://www.safra.sg/nsman-magazine/things-to-do/Things-to-do/2026/02/04/whats-new-in-february-2026"
            )
            # 4) Community Connectors – Bendemeer Senior Befriending (with coordinates)
            _ins_event(
                "Community Connectors – Bendemeer Senior Befriending",
                "Youth volunteers engage seniors through conversations, community activities, and social support.",
                "Lion Befrienders Active Ageing Centre, Bendemeer, Singapore",
                "2026-03-01",
                "14:00",
                "",
                "",
                "https://www.volunteer.gov.sg/volunteer/opportunity/details/?id=dfbd8f85-98ba-ee11-ac5f-0aec74081c56",
                1.3216,
                103.8622
            )

            # 5) Joyful Connections – SGH Hospital Senior Companionship (with coordinates)
            _ins_event(
                "Joyful Connections – SGH Senior Companionship",
                "Hospital-based befriending programme where youth volunteers engage elderly patients through games and conversation.",
                "Singapore General Hospital, Singapore",
                "2026-03-18",
                "10:00",
                "",
                "",
                "https://www.volunteer.gov.sg/volunteer/opportunity/details/?id=5cce7e81-93c3-f011-ac7e-027d80ecb760",
                1.2789,
                103.8345
            )

            # 6) Le Celebake – Youth & Seniors Intergenerational Baking (with coordinates)
            _ins_event(
                "Le Celebake – Youth & Seniors Intergenerational Baking",
                "Youth and seniors come together for baking workshops and bonding sessions.",
                "Jalan Kukoh, Singapore",
                "2026-03-08",
                "10:00",
                "",
                "",
                "https://www.volunteer.gov.sg/volunteer/opportunity/details/?id=1e1ed635-f2cf-ee11-ac5e-027d80ecb760",
                1.2867,
                103.8397
            )
        conn.commit()

    finally:
        conn.close()




def get_conn() -> sqlite3.Connection:
    return _db.connect()


# ---- Users / Auth ----

def get_user_by_email(email: str) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE id=?", (int(user_id),)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def create_user(full_name: str, email: str, password: str) -> Tuple[bool, Optional[dict], str]:
    conn = get_conn()
    try:
        try:
            conn.execute(
                "INSERT INTO users(full_name,email,password,is_admin) VALUES (?,?,?,0)",
                (full_name, email, password),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            return False, None, "Email already exists"
        user = get_user_by_email(email)
        return True, user, ""
    finally:
        conn.close()


def update_user(user_id: int, fields: dict) -> Optional[dict]:
    allowed = {"full_name", "email", "age", "generation", "bio", "match_preferences", "avatar"}
    sets = []
    params = []
    for k, v in fields.items():
        if k in allowed:
            sets.append(f"{k}=?")
            params.append(v)
    if not sets:
        return get_user_by_id(user_id)

    conn = get_conn()
    try:
        params.append(int(user_id))
        conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=?", params)
        conn.commit()
    finally:
        conn.close()
    return get_user_by_id(user_id)


def set_user_interests(user_id: int, interests: List[str]) -> None:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM user_interests WHERE user_id=?", (int(user_id),))
        for name in interests:
            if not name:
                continue
            conn.execute("INSERT OR IGNORE INTO interests(name) VALUES (?)", (name,))
            conn.execute(
                "INSERT OR IGNORE INTO user_interests(user_id,interest_name) VALUES (?,?)",
                (int(user_id), name),
            )
        conn.commit()
    finally:
        conn.close()




def get_user_public(user_id: int) -> Optional[dict]:
    u = get_user_by_id(user_id)
    if not u:
        return None
    conn = get_conn()
    try:
        ints = conn.execute(
            "SELECT interest_name FROM user_interests WHERE user_id=? ORDER BY interest_name",
            (int(user_id),),
        ).fetchall()
        u["interests"] = [r["interest_name"] for r in ints]
    finally:
        conn.close()
    return {
        "id": u["id"],
        "full_name": u.get("full_name"),
        "email": u.get("email"),
        "age": u.get("age"),
        "generation": u.get("generation"),
        "bio": u.get("bio"),
        "match_preferences": u.get("match_preferences"),
        "avatar": u.get("avatar"),
        "interests": u.get("interests", []),
        "is_admin": bool(u.get("is_admin")),
        "is_banned": bool(u.get("is_banned")),
        "show_in_matchup": bool(u.get("show_in_matchup")),
    }


# ---- Moderation gating (warnings / suspensions) ----

def _parse_iso_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    v = value.strip()
    # sqlite rows may contain 'Z' UTC suffix
    if v.endswith('Z'):
        v = v[:-1] + '+00:00'
    try:
        dt = datetime.fromisoformat(v)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def is_user_currently_suspended(user_row: dict) -> Tuple[bool, Optional[str]]:
    """Return (is_suspended, until_iso). Auto-clears if suspension expired."""
    until_raw = user_row.get("suspended_until")
    until_dt = _parse_iso_dt(until_raw)
    if not until_dt:
        return False, None

    now = datetime.now(timezone.utc)
    if until_dt > now:
        return True, until_dt.isoformat()

    # Expired: clear
    try:
        clear_user_suspension(int(user_row.get("id")))
    except Exception:
        pass
    return False, None


def set_user_suspension(user_id: int, until_iso: str) -> Optional[dict]:
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET suspended_until=? WHERE id=?", (until_iso, int(user_id)))
        conn.commit()
    finally:
        conn.close()
    return get_user_by_id(int(user_id))


def clear_user_suspension(user_id: int) -> None:
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET suspended_until=NULL WHERE id=?", (int(user_id),))
        conn.commit()
    finally:
        conn.close()


def set_user_warning(user_id: int, message: str) -> None:
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE users SET warning_message=?, warning_ack=0 WHERE id=?",
            (message, int(user_id)),
        )
        conn.commit()
    finally:
        conn.close()


def get_user_warning(user_id: int) -> Tuple[bool, Optional[str]]:
    u = get_user_by_id(int(user_id))
    if not u:
        return False, None
    msg = u.get("warning_message")
    ack = int(u.get("warning_ack") or 0)
    pending = bool(msg) and ack == 0
    return pending, msg if pending else None


def ack_user_warning(user_id: int) -> None:
    conn = get_conn()
    try:
        conn.execute(
            "UPDATE users SET warning_ack=1, warning_message=NULL WHERE id=?",
            (int(user_id),),
        )
        conn.commit()
    finally:
        conn.close()


def list_users(exclude_user_id: Optional[int] = None, *, only_matchup: bool = False) -> List[dict]:
    conn = get_conn()
    try:
        clauses = []
        params: List[Any] = []
        if exclude_user_id:
            clauses.append("id<>?")
            params.append(int(exclude_user_id))
        if only_matchup:
            clauses.append("show_in_matchup=1")

        where_sql = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        rows = conn.execute(f"SELECT id FROM users{where_sql} ORDER BY id", tuple(params)).fetchall()
        return [get_user_public(r["id"]) for r in rows if get_user_public(r["id"]) is not None]
    finally:
        conn.close()


# ---- Login events ----

def log_login_event(user_id: Optional[int], email: str, success: bool, ip: str, user_agent: str) -> dict:
    conn = get_conn()
    try:
        created_at = utcnow_iso()
        conn.execute(
            "INSERT INTO login_events(user_id,email,success,ip,user_agent,created_at) VALUES (?,?,?,?,?,?)",
            (user_id, email, 1 if success else 0, ip, user_agent, created_at),
        )
        conn.commit()
        ev_id = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return {
            "id": ev_id,
            "user_id": user_id,
            "email": email,
            "success": bool(success),
            "ip": ip,
            "user_agent": user_agent,
            "created_at": created_at,
        }
    finally:
        conn.close()


def list_login_events(limit: int = 50) -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM login_events ORDER BY id DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


# ---- Stories ----

def create_story(user_id: int, title: str, category: str, content: str, status: str = "ongoing") -> dict:
    conn = get_conn()
    try:
        created_at = utcnow_iso()
        conn.execute(
            "INSERT INTO stories(user_id,title,category,content,status,created_at) VALUES (?,?,?,?,?,?)",
            (int(user_id), title, category, content, status, created_at),
        )
        conn.commit()
        sid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return get_story(sid)
    finally:
        conn.close()


def get_story(story_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM stories WHERE id=?", (int(story_id),)).fetchone()
        if not row:
            return None
        d = _row_to_dict(row)
        d["user"] = get_user_public(d["user_id"])
        d["comments_count"] = count_story_comments(int(d["id"]))
        return d
    finally:
        conn.close()


def list_stories() -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute("SELECT id FROM stories ORDER BY id DESC").fetchall()
        out = []
        for r in rows:
            s = get_story(r["id"])
            if s:
                out.append(s)
        return out
    finally:
        conn.close()




# ---- Story Comments ----

def count_story_comments(story_id: int) -> int:
    conn = get_conn()
    try:
        row = conn.execute("SELECT COUNT(*) AS c FROM story_comments WHERE story_id=?", (int(story_id),)).fetchone()
        return int(row["c"] or 0) if row else 0
    finally:
        conn.close()


def list_story_comments(story_id: int, limit: int = 200) -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT c.*, u.full_name, u.avatar
            FROM story_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.story_id=?
            ORDER BY c.id ASC
            LIMIT ?
            """,
            (int(story_id), int(limit)),
        ).fetchall()
        out = []
        for r in rows:
            d = _row_to_dict(r)
            d["user"] = {"id": d["user_id"], "full_name": d.get("full_name"), "avatar": d.get("avatar")}
            # remove duplicated fields
            d.pop("full_name", None)
            d.pop("avatar", None)
            out.append(d)
        return out
    finally:
        conn.close()


def get_story_comment(comment_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM story_comments WHERE id=?", (int(comment_id),)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def create_story_comment(story_id: int, user_id: int, text: str) -> dict:
    conn = get_conn()
    try:
        created_at = utcnow_iso()
        conn.execute(
            "INSERT INTO story_comments(story_id,user_id,text,created_at) VALUES (?,?,?,?)",
            (int(story_id), int(user_id), text, created_at),
        )
        conn.commit()
        cid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        row = conn.execute(
            """
            SELECT c.*, u.full_name, u.avatar
            FROM story_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.id=?
            """,
            (int(cid),),
        ).fetchone()
        d = _row_to_dict(row) if row else {"id": cid, "story_id": story_id, "user_id": user_id, "text": text, "created_at": created_at}
        d["user"] = {"id": d["user_id"], "full_name": d.get("full_name"), "avatar": d.get("avatar")}
        d.pop("full_name", None)
        d.pop("avatar", None)
        return d
    finally:
        conn.close()


def delete_story_comment(story_id: int, comment_id: int) -> bool:
    """Delete a single story comment by id (scoped to a story for safety)."""
    conn = get_conn()
    try:
        cur = conn.execute(
            "DELETE FROM story_comments WHERE id=? AND story_id=?",
            (int(comment_id), int(story_id)),
        )
        conn.commit()
        return bool(cur.rowcount)
    finally:
        conn.close()


# ---- Moderation helpers (Admin) ----

def set_user_banned(user_id: int, banned: bool = True) -> Optional[dict]:
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET is_banned=? WHERE id=?", (1 if banned else 0, int(user_id)))
        conn.commit()
    finally:
        conn.close()
    return get_user_public(int(user_id))


def set_user_matchup_enabled(user_id: int, enabled: bool = True) -> Optional[dict]:
    """Mark a user as visible in Match-Up."""
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET show_in_matchup=? WHERE id=?", (1 if enabled else 0, int(user_id)))
        conn.commit()
    finally:
        conn.close()
    return get_user_public(int(user_id))


def delete_user(user_id: int) -> bool:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM users WHERE id=?", (int(user_id),))
        conn.commit()
        return True
    finally:
        conn.close()


def delete_story(story_id: int) -> bool:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM stories WHERE id=?", (int(story_id),))
        conn.commit()
        return True
    finally:
        conn.close()


def delete_skillswap_post(post_id: int) -> bool:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM skillswap_posts WHERE id=?", (int(post_id),))
        conn.commit()
        return True
    finally:
        conn.close()


# ---- SkillSwap ----

def create_skillswap_post(user_id: int, post_type: str, title: str, category: str, description: str) -> dict:
    conn = get_conn()
    try:
        created_at = utcnow_iso()
        conn.execute(
            "INSERT INTO skillswap_posts(user_id,post_type,title,category,description,created_at) VALUES (?,?,?,?,?,?)",
            (int(user_id), post_type, title, category, description, created_at),
        )
        conn.commit()
        pid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return get_skillswap_post(pid)
    finally:
        conn.close()


def get_skillswap_post(post_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM skillswap_posts WHERE id=?", (int(post_id),)).fetchone()
        if not row:
            return None
        d = _row_to_dict(row)
        d["user"] = get_user_public(d["user_id"])
        d["comments_count"] = count_story_comments(int(d["id"]))
        return d
    finally:
        conn.close()


def list_skillswap_posts() -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute("SELECT id FROM skillswap_posts ORDER BY id DESC").fetchall()
        out = []
        for r in rows:
            p = get_skillswap_post(r["id"])
            if p:
                out.append(p)
        return out
    finally:
        conn.close()


# ---- Events ----

def create_event(
    title: str,
    start_date: str,
    start_time: Optional[str] = None,
    location: str = "",
    description: str = "",
    end_date: Optional[str] = None,
    end_time: Optional[str] = None,
    link: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> dict:
    """Create a new event (admin-only at API layer).

    Dates are stored as ISO strings (YYYY-MM-DD) for easy sorting/filtering.
    Latitude and longitude are optional geocoded coordinates.
    """
    conn = get_conn()
    try:
        created_at = utcnow_iso()
        conn.execute(
            """
            INSERT INTO events(title,description,location,start_date,start_time,end_date,end_time,link,latitude,longitude,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                title,
                description or "",
                location or "",
                start_date,
                (start_time or ""),
                (end_date or ""),
                (end_time or ""),
                (link or ""),
                latitude,
                longitude,
                created_at,
            ),
        )
        conn.commit()
        eid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return get_event(int(eid))
    finally:
        conn.close()


def get_event(event_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM events WHERE id=?", (int(event_id),)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def list_events(limit: int = 50, upcoming_only: bool = True) -> List[dict]:
    conn = get_conn()
    try:
        limit = int(limit or 50)
        if limit <= 0:
            limit = 50

        if upcoming_only:
            today_str = date.today().isoformat()  # YYYY-MM-DD
            rows = conn.execute(
                """
                SELECT * FROM events
                WHERE start_date >= ?
                ORDER BY start_date ASC, COALESCE(start_time,'') ASC, id ASC
                LIMIT ?
                """,
                (today_str, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM events
                ORDER BY start_date DESC, COALESCE(start_time,'') DESC, id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        # Convert sqlite3 rows to dict
        out = [_row_to_dict(r) for r in rows if r is not None]
        return out
    finally:
        conn.close()


def delete_event(event_id: int) -> bool:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM events WHERE id=?", (int(event_id),))
        conn.commit()
        return True
    finally:
        conn.close()


# ---- Messages ----

def create_message(sender_id: int, recipient_id: int, text: str) -> dict:
    conn = get_conn()
    try:
        created_at = utcnow_iso()
        conn.execute(
            "INSERT INTO messages(sender_id,recipient_id,text,created_at,is_read) VALUES (?,?,?,?,0)",
            (int(sender_id), int(recipient_id), text, created_at),
        )
        conn.commit()
        mid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return get_message(mid)
    finally:
        conn.close()


def get_message(message_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM messages WHERE id=?", (int(message_id),)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def list_thread(user_a: int, user_b: int, limit: int = 200) -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT * FROM messages
            WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)
            ORDER BY id ASC
            LIMIT ?
            """,
            (int(user_a), int(user_b), int(user_b), int(user_a), int(limit)),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def list_contacts_for_user(user_id: int) -> List[dict]:
    # Prototype: show all other users as available contacts.
    return list_users(exclude_user_id=int(user_id))


# ---- Notifications ----

def create_notification(user_id: int, notif_type: str, icon: str, title: str, content: str, link: Optional[str] = None) -> dict:
    conn = get_conn()
    try:
        created_at = utcnow_iso()
        conn.execute(
            "INSERT INTO notifications(user_id,notif_type,icon,title,content,link,created_at,is_read) VALUES (?,?,?,?,?,?,?,0)",
            (int(user_id), notif_type, icon, title, content, link, created_at),
        )
        conn.commit()
        nid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return get_notification(nid)
    finally:
        conn.close()


def get_notification(notif_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM notifications WHERE id=?", (int(notif_id),)).fetchone()
        if not row:
            return None
        d = _row_to_dict(row)
        return {
            "id": d["id"],
            "type": d.get("notif_type"),
            "icon": d.get("icon"),
            "title": d.get("title"),
            "content": d.get("content"),
            "link": d.get("link"),
            "time": d.get("created_at"),
            "isRead": bool(d.get("is_read")),
        }
    finally:
        conn.close()


def list_notifications(user_id: int, limit: int = 50) -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT ?",
            (int(user_id), int(limit)),
        ).fetchall()
        out = []
        for r in rows:
            n = get_notification(r["id"])
            if n:
                out.append(n)
        return out
    finally:
        conn.close()


def mark_all_notifications_read(user_id: int) -> None:
    conn = get_conn()
    try:
        conn.execute("UPDATE notifications SET is_read=1 WHERE user_id=?", (int(user_id),))
        conn.commit()
    finally:
        conn.close()


def clear_notifications(user_id: int) -> None:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM notifications WHERE user_id=?", (int(user_id),))
        conn.commit()
    finally:
        conn.close()


# ---- Reports ----

def create_report(reporter_id: int, target_user_id: int, reason: str, details: str) -> dict:
    conn = get_conn()
    try:
        created_at = utcnow_iso()
        conn.execute(
            "INSERT INTO reports(reporter_id,target_user_id,reason,details,status,created_at) VALUES (?,?,?,?, 'pending', ?)",
            (int(reporter_id), int(target_user_id), reason, details, created_at),
        )
        conn.commit()
        rid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        return get_report(rid)
    finally:
        conn.close()


def get_report(report_id: int) -> Optional[dict]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM reports WHERE id=?", (int(report_id),)).fetchone()
        if not row:
            return None
        d = _row_to_dict(row)
        d["reporter"] = get_user_public(d["reporter_id"])
        d["target_user"] = get_user_public(d["target_user_id"])
        return d
    finally:
        conn.close()


def list_reports(limit: int = 100) -> List[dict]:
    conn = get_conn()
    try:
        rows = conn.execute("SELECT id FROM reports ORDER BY id DESC LIMIT ?", (int(limit),)).fetchall()
        out = []
        for r in rows:
            rep = get_report(r["id"])
            if rep:
                out.append(rep)
        return out
    finally:
        conn.close()


def update_report_status(report_id: int, status: str) -> Optional[dict]:
    conn = get_conn()
    try:
        conn.execute("UPDATE reports SET status=? WHERE id=?", (status, int(report_id)))
        conn.commit()
    finally:
        conn.close()
    return get_report(report_id)