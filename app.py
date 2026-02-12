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
    
    # Handle different file types
    if '.' in path.split('/')[-1]:
        # It's a file with extension (CSS, JS, images, etc.)
        file_path = path
    else:
        # It's a page without extension, add .html
        file_path = path + '.html'
    
    # Try to serve the file
    try:
        return send_from_directory(BASE_DIR, file_path)
    except FileNotFoundError:
        # If file not found and it's not already error page, redirect to error
        if path != 'error':
            try:
                return send_from_directory(BASE_DIR, 'error.html'), 404
            except:
                return f"404 - Page not found: {path}", 404
        else:
            return "404 - Error page not found", 404
    except Exception as e:
        return f"Error loading page: {str(e)}", 500

# Run the app
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting server on port {port}")
    print(f"Looking for files in: {BASE_DIR}")
    app.run(host="0.0.0.0", port=port, debug=False)
