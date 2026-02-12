from flask import Flask, send_from_directory, redirect
import os

app = Flask(__name__, static_folder='.', static_url_path='')

# Serve index.html at root
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Serve pages with or without .html
@app.route('/<path:path>')
def serve_page(path):
    # Check if URL ends with .html
    if path.endswith('.html'):
        # Remove .html and redirect to clean URL
        clean_path = path[:-5]  # Remove last 5 characters (.html)
        return redirect('/' + clean_path, code=301)
    
    # If path doesn't have extension, add .html
    if '.' not in path.split('/')[-1]:
        file_path = path + '.html'
    else:
        file_path = path

    # Try to serve the file
    try:
        return send_from_directory('.', file_path)
    except:
        # If file not found, redirect to error page
        if path != 'error':  # Prevent loop if error.html doesn't exist
            return redirect('/error', code=302)
        else:
            return "Page not found", 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5010, debug=True, threaded=True)
