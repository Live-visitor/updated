from flask import Flask, render_template
import os

app = Flask(__name__)

# ============================================
# USER-FACING PAGES
# ============================================

@app.route("/")
def home():
    """Home page - index.html"""
    return render_template("index.html")

@app.route("/settings")
def settings():
    """User settings page"""
    return render_template("settings.html")

@app.route("/signup")
def signup():
    """User signup page"""
    return render_template("signup.html")

@app.route("/login")
def login():
    """User login page"""
    return render_template("login.html")

@app.route("/skillswap")
def skillswap():
    """SkillSwap main page"""
    return render_template("skillswap.html")

@app.route("/skillswapform")
def skillswapform():
    """Create new SkillSwap post"""
    return render_template("skillswapform.html")

@app.route("/stories")
def stories():
    """Stories/Challenges main page"""
    return render_template("stories.html")

@app.route("/storiesform")
def storiesform():
    """Create new story/challenge"""
    return render_template("storiesform.html")

@app.route("/translator")
def translator():
    """Language translator page"""
    return render_template("translator.html")

@app.route("/chatbot")
def chatbot():
    """AI Chatbot page"""
    return render_template("chatbot.html")

@app.route("/match")
def match():
    """Match-Up page"""
    return render_template("match.html")

@app.route("/events")
def events():
    """Events page"""
    return render_template("events.html")

@app.route("/eventsform")
def eventsform():
    """Create new event"""
    return render_template("eventsform.html")

@app.route("/messages")
def messages():
    """Messages page"""
    return render_template("messages.html")

@app.route("/profile")
def profile():
    """User profile page"""
    return render_template("profile.html")

@app.route("/error")
def error():
    """Error page"""
    return render_template("error.html")

# ============================================
# ADMIN PAGES
# ============================================

@app.route("/admin")
@app.route("/adminhome")
def admin_home():
    """Admin dashboard"""
    return render_template("adminhome.html")

@app.route("/adminlog")
def admin_login():
    """Admin login page"""
    return render_template("adminlog.html")

@app.route("/adminmatch")
def admin_match():
    """Admin manage users page"""
    return render_template("adminmatch.html")

@app.route("/adminsettings")
def admin_settings():
    """Admin settings page"""
    return render_template("adminsettings.html")

@app.route("/adminskillswap")
def admin_skillswap():
    """Admin manage SkillSwap posts"""
    return render_template("adminskillswap.html")

@app.route("/adminstories")
def admin_stories():
    """Admin manage stories"""
    return render_template("adminstories.html")

@app.route("/adminevents")
def admin_events():
    """Admin manage events"""
    return render_template("adminevents.html")

# ============================================
# ERROR HANDLERS
# ============================================

@app.errorhandler(404)
def page_not_found(e):
    """Handle 404 errors"""
    return render_template("404.html"), 404 if os.path.exists("templates/404.html") else ("Page not found", 404)

@app.errorhandler(500)
def internal_server_error(e):
    """Handle 500 errors"""
    return "Internal server error", 500

# ============================================
# RUN APP
# ============================================


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5010, debug=True, threaded=True)


