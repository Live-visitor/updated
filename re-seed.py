import os
from db import init_db
from app import app


if os.path.exists("app.db"):
    os.remove("app.db")

# Recreate database + seed
with app.app_context():
    init_db(app)

print("Database re-seeded successfully!")
