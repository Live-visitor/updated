from flask import Flask, send_from_directory
import os

app = Flask(__name__)

# Directory where HTML files are stored
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_DIR = os.path.join(BASE_DIR, 'pages')  # put all your HTML files here

@app.route('/')
def index():
    """Serve index.html at root"""
    index_path = os.path.join(HTML_DIR, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(HTML_DIR, 'index.html')
    else:
        return send_from_directory(HTML_DIR, 'error.html')

@app.route('/<page_name>')
def serve_page(page_name):
    """
    Serve any HTML page dynamically from the pages folder.
    If the page doesn't exist, show error.html
    """
    file_name = f"{page_name}.html"
    file_path = os.path.join(HTML_DIR, file_name)

    if os.path.exists(file_path):
        return send_from_directory(HTML_DIR, file_name)
    else:
        # Serve error.html if page not found
        error_path = os.path.join(HTML_DIR, 'error.html')
        if os.path.exists(error_path):
            return send_from_directory(HTML_DIR, 'error.html')
        else:
            return "error.html not found in pages folder.", 404

if __name__ == '__main__':
    app.run(debug=True)
