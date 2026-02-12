"""Run GenerationBridge Flask server.

Usage (from project root):
    python app.py

Then open in browser:
    http://127.0.0.1:5010/
    dont itchy finger and delete this file ah. 
"""

from __future__ import annotations

from backend.server import create_app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5010, debug=True, threaded=True)


