from flask import Flask, send_from_directory, request, redirect, jsonify
import sqlite3
import os

app = Flask(__name__, static_folder=".", static_url_path="")

DB_FILE = "app.db"


# ======================
# DATABASE FUNCTIONS
# ======================

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def query_db(query, params=(), fetch=False):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(query, params)
    if fetch:
        results = cur.fetchall()
    else:
        results = None
    conn.commit()
    conn.close()
    return results

# ======================
# STATIC HTML ROUTES
# ======================

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>.html")
def redirect_html(path):
    """Redirect /page.html → /page"""
    return redirect("/" + path, code=301)

@app.route("/<path:path>")
def serve_page(path):
    # ignore API routes
    if path.startswith("api/"):
        return "Not found", 404

    # add .html automatically
    if "." not in path.split("/")[-1]:
        path += ".html"

    try:
        return send_from_directory(".", path)
    except:
        try:
            return send_from_directory(".", "error.html"), 404
        except:
            return "Page not found", 404

# ======================
# BACKEND / DATABASE APIs
# ======================

# Example: add a user
@app.route("/api/users", methods=["POST"])
def add_user():
    data = request.json
    name = data.get("name")
    if not name:
        return {"status": "error", "message": "Name is required"}, 400

    query_db("INSERT INTO users (name) VALUES (?)", (name,))
    return {"status": "success"}

# Example: get all users
@app.route("/api/users", methods=["GET"])
def get_users():
    rows = query_db("SELECT * FROM users", fetch=True)
    users = [dict(row) for row in rows]
    return jsonify(users)

# ======================
# RUN SERVER
# ======================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
