"""Chatbot API using OpenAI GPT for elderly-youth conversation support."""
from __future__ import annotations
import json
import os
from typing import Optional
from flask import Flask, jsonify, request, session
from openai import OpenAI
from backend.utils.guards import Guards

class ChatbotAPI:
    """AI-powered chatbot for conversation suggestions and assistance."""
    
    def __init__(self):
        
        api_key = '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'
        self.client = OpenAI(api_key=api_key)
    
    def register(self, app: Flask) -> None:
        """Register chatbot routes with the Flask app."""
        
        # THIS IS THE MISSING ENDPOINT YOUR JS IS CALLING
        @app.post("/api/chatbot/message")
        @Guards.require_login
        def chatbot_message():
            """Handle user messages and generate AI responses."""
            try:
                data = request.get_json()
                if not data or 'message' not in data:
                    return jsonify({"error": "Message is required"}), 400
                
                user_message = data['message'].strip()
                if not user_message:
                    return jsonify({"error": "Message cannot be empty"}), 400
                
                # Get or initialize conversation history
                if 'chat_history' not in session:
                    session['chat_history'] = []
                
                chat_history = session['chat_history']
                
                # Build messages for OpenAI
                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful assistant for GenerationBridge, a platform connecting "
                            "elderly and young people. Your role is to:\n"
                            "1. Help users find conversation topics across generations\n"
                            "2. Provide advice on intergenerational communication\n"
                            "3. Suggest activities for elderly-youth connections\n"
                            "4. Be warm, respectful, and encouraging\n"
                            "5. Keep responses concise (2-3 paragraphs max)\n"
                            "Always consider both elderly and youth perspectives."
                        )
                    }
                ]
                
                # Add recent conversation history (last 10 exchanges)
                messages.extend(chat_history[-20:])
                
                # Add current user message
                messages.append({"role": "user", "content": user_message})
                
                # Call OpenAI API
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.7,
                    max_tokens=300
                )
                
                bot_response = response.choices[0].message.content.strip()
                
                # Update conversation history
                chat_history.append({"role": "user", "content": user_message})
                chat_history.append({"role": "assistant", "content": bot_response})
                session['chat_history'] = chat_history
                
                return jsonify({"response": bot_response})
                
            except Exception as e:
                print(f"Chatbot error: {str(e)}")
                return jsonify({"error": "Sorry, something went wrong. Please try again."}), 500
        
        @app.post("/api/chatbot/suggest")
        @Guards.require_login
        def chatbot_suggest():
            """Generate conversation topic suggestions."""
            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "Generate 5 interesting conversation topics or activities "
                                "for elderly and youth users to connect over on GenerationBridge. "
                                "Topics should encourage intergenerational learning and sharing. "
                                "Return ONLY a valid JSON array of strings, no other text. "
                                "Example: [\"Share your favorite childhood memory\", \"Teach each other a skill\"]"
                            )
                        }
                    ],
                    temperature=0.9,
                    max_tokens=150
                )

                text = response.choices[0].message.content.strip()
                
                # Remove markdown code blocks if GPT adds them
                if text.startswith("```"):
                    lines = text.split("\n")
                    text = "\n".join(lines[1:-1])
                
                topics = json.loads(text)
                
                return jsonify({"topics": topics[:5]})
                
            except Exception as e:
                print(f"Suggest error: {str(e)}")
                # Return fallback topics if API fails
                return jsonify({
                    "topics": [
                        "Share a favorite recipe and cook it together",
                        "Tell stories about historical events you've experienced",
                        "Teach each other a skill (tech or traditional crafts)",
                        "Discuss how your neighborhood has changed",
                        "Share music from different eras"
                    ]
                })
        
        @app.post("/api/chatbot/clear")
        @Guards.require_login
        def chatbot_clear():
            """Clear conversation history."""
            session.pop('chat_history', None)
            return jsonify({"message": "Conversation cleared"})