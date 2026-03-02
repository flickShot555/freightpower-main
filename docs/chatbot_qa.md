# Chatbot QA Guide

Use this harness to sanity-check the `/chat` endpoint with canned onboarding/compliance prompts.

1. Ensure the API is running locally (`uvicorn apps.api.main:app --reload`).
2. Populate documents/FAQs so the chatbot has context.
3. Run the QA script:
   ```bash
   python scripts/run_chatbot_qa.py --api-url http://localhost:8000 --qa-file data/chatbot_qa.json
   ```
4. The script prints PASS/WARN per question; adjust `data/chatbot_qa.json` to add more prompts or expected keywords.

Use WARN/FAIL outputs to refine prompts, KB chunks, or retrieval logic before demoing the assistant.
