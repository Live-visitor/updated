from flask import Flask, send_from_directory, redirect
import os

app = Flask(__name__)

# Get the directory where files are located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Serve index.html at root
@app.route('/')
def index():
    try:
        return send_from_directory(BASE_DIR, 'index.html')
    except:
        return "index.html not found. Please make sure it's in the same folder as app.py", 404

# Serve pages with or without .html
@app.route('/<path:path>')
def serve_page(path):
    # Check if URL ends with .html
    if path.endswith('.html'):
        # Remove .html and redirect to clean URL
        clean_path = path[:-5]
        return redirect('/' + clean_path, code=301)
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8080))
    )
