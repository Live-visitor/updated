import sqlite3
from flask import jsonify, request
from openai import OpenAI

class Translator:
    def __init__(self, db_path="translations.db"):

        api_key = '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'
        self.client = OpenAI(api_key=api_key)
        
        # Initialize database
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.cursor = self.conn.cursor()
        
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                modern TEXT UNIQUE,
                traditional TEXT
            )
        """)
        self.conn.commit()

    def ai_guess(self, word, direction="to_traditional"):
        """
        Uses OpenAI GPT to guess the translation of unknown slang word.
        """
        try:
            if direction == "to_traditional":
                prompt = f"Change the modern slang word '{word}' into simple, old-fashioned English (using words like 'thy'). Give only the word, with no explanations."
            else:
                prompt = f"Translate the traditional/old-fashioned word '{word}' into modern slang. Give only the translation, no explanation."
            
            # NEW OPENAI SYNTAX
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Updated model
                messages=[
                    {"role": "system", "content": "You are a slang translator between modern and traditional English."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=50,
                temperature=0.7
            )
            definition = response.choices[0].message.content.strip()
            return definition
        except Exception as e:
            print(f"AI translation error: {e}")
            return word  # Return original word if AI fails

    def register(self, app):
        """Register Flask API endpoints"""
        app.add_url_rule("/api/translator/translate", endpoint="translate", view_func=self.api_translate, methods=["POST"])
        app.add_url_rule("/api/translations", endpoint="translations_list", view_func=self.api_list_all, methods=["GET"])
        app.add_url_rule("/api/translations", endpoint="translations_create", view_func=self.api_create, methods=["POST"])
        app.add_url_rule("/api/translations/<word>", endpoint="translations_read", view_func=self.api_read, methods=["GET"])

    # Flask API endpoints
    def api_translate(self):
        """POST /api/translator/translate - Translate text"""
        try:
            data = request.get_json(silent=True) or {}
            text = (data.get("text") or "").strip()
            direction = data.get("direction", "to_traditional")
            
            if not text:
                return jsonify({"ok": False, "error": "missing_text"}), 400
            
            translated = self.translate(text, direction)
            return jsonify({"ok": True, "original": text, "translation": translated})
        except Exception as e:
            print(f"Translation API error: {e}")
            return jsonify({"ok": False, "error": str(e)}), 500

    def api_list_all(self):
        """GET /api/translations - List all translations"""
        try:
            translations = self.list_all()
            result = [{"id": t[0], "modern": t[1], "traditional": t[2]} for t in translations]
            return jsonify({"ok": True, "translations": result})
        except Exception as e:
            print(f"List translations error: {e}")
            return jsonify({"ok": False, "error": str(e)}), 500

    def api_create(self):
        """POST /api/translations - Create/update translation"""
        try:
            data = request.get_json(silent=True) or {}
            modern = (data.get("modern") or "").strip()
            traditional = (data.get("traditional") or "").strip()
            
            if not modern or not traditional:
                return jsonify({"ok": False, "error": "missing_fields"}), 400
            
            self.create_or_update(modern, traditional)
            return jsonify({"ok": True, "modern": modern, "traditional": traditional})
        except Exception as e:
            print(f"Create translation error: {e}")
            return jsonify({"ok": False, "error": str(e)}), 500

    def api_read(self, word):
        """GET /api/translations/<word> - Get translation for a word"""
        try:
            row = self.read(word)
            if row:
                return jsonify({"ok": True, "translation": {"id": row[0], "modern": row[1], "traditional": row[2]}})
            else:
                return jsonify({"ok": False, "error": "not_found"}), 404
        except Exception as e:
            print(f"Read translation error: {e}")
            return jsonify({"ok": False, "error": str(e)}), 500

    def create_or_update(self, modern, traditional):
        self.cursor.execute("""
            INSERT INTO translations(modern, traditional)
            VALUES (?, ?)
            ON CONFLICT(modern) DO UPDATE SET traditional=excluded.traditional
        """, (modern.lower(), traditional))
        self.conn.commit()

    def read(self, word):
        self.cursor.execute("""
            SELECT * FROM translations
            WHERE modern=? OR traditional=?
        """, (word.lower(), word.lower()))
        return self.cursor.fetchone()

    def list_all(self):
        self.cursor.execute("SELECT * FROM translations")
        return self.cursor.fetchall()

    def translate(self, text, direction="to_traditional"):
        """
        Translate text between modern and traditional English.
        direction: "to_traditional" or "to_modern"
        """
        words = text.split()
        translated = []

        for word in words:
            # Preserve punctuation
            clean_word = word.strip('.,!?;:()[]{}"\'-')
            prefix = word[:len(word) - len(word.lstrip('.,!?;:()[]{}"\'-'))]
            suffix = word[len(clean_word) + len(prefix):]
            
            if not clean_word:
                translated.append(word)
                continue
            
            row = self.read(clean_word)
            
            if row:
                modern, traditional = row[1], row[2]
                if direction == "to_traditional":
                    translated_word = traditional if modern.lower() == clean_word.lower() else modern
                else:  # to_modern
                    translated_word = modern if traditional.lower() == clean_word.lower() else traditional
                
                translated.append(prefix + translated_word + suffix)
            else:
                # Use AI to guess translation
                ai_translation = self.ai_guess(clean_word, direction)
                translated.append(prefix + ai_translation + suffix)
                
                # Store the new translation
                if direction == "to_traditional":
                    self.create_or_update(clean_word, ai_translation)
                else:
                    self.create_or_update(ai_translation, clean_word)

        return " ".join(translated)
    
    def __del__(self):
        """Close database connection when object is destroyed"""
        if hasattr(self, 'conn'):
            self.conn.close()