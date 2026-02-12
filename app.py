from flask import Flask, send_from_directory, redirect
import os

app = Flask(__name__, static_folder='.', static_url_path='')

# Serve index.html at root
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Redirect .html URLs to clean URLs
@app.route('/<path:path>.html')
def redirect_html(path):
    """Redirect /page.html to /page"""
    return redirect('/' + path, code=301)

# Serve pages with or without .html
@app.route('/<path:path>')
def serve_page(path):
    # If path doesn't have extension, add .html
    if '.' not in path.split('/')[-1]:
        file_path = path + '.html'
    else:
        file_path = path
    

        except:
            return "Page not found", 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5010, debug=True, threaded=True)


