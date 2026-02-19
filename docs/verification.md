# Week 2–3 Verification Guide

1. **Document upload sanity check**
   - Run `uvicorn apps.api.main:app --reload`.
   - `curl -F "file=@sample.pdf" http://localhost:8000/documents`.
   - Response should include `classification`, `validation.status`, and `score`.

2. **Validation behavior**
   - Upload an expired COI and confirm `validation.issues` contains “COI is expired”.
   - Upload a W-9 without signature; expect “Signature not detected”.

3. **Onboarding score endpoint**
   - Call `GET /onboarding/score/{document_id}` for each document.
   - Verify the score aligns with validation (COI=40, W-9=20, CDL=20 when valid).

4. **Chatbot knowledge base**
   - With no user documents, hit `POST /chat` with `{"query":"What docs are required?"}`.
   - Response should cite KB chunks (document IDs prefixed with `kb::`).

5. **Data files**
   - `data/kb/*.md` contains the seeded FAQ/playbook text; edits there are reindexed on restart.
6. **Document-specific prompts**
   - Inspect stored record (`GET /documents/{id}`) and confirm `_debug.preextract` plus `detection.reason` reflect the classification pass.
   - Verify COI/W-9/CDL uploads return the expanded schemas (policy numbers, CDL class, etc.) populated by the new prompt templates.
7. **Document registry**
   - Review `apps/api/documents.py` to see the required fields/validation notes for every document type referenced in the upload responses.
8. **FMCSA/SAFER lookup**
   - Call `GET /fmcsa/{usdot}` with a valid USDOT number after setting `FMCSA_BASE_URL`/`FMCSA_API_KEY`; confirm the response is cached under `data/response.json -> fmcsa_profiles`.
9. **FMCSA verification & refresh (Week 3)**
   - `POST /fmcsa/verify` with `{ "usdot": "123456" }` (or an MC number) after setting `FMCSA_WEB_KEY`. The response should include `result` (`Verified/Warning/Blocked`) and we persist it under `data/response.json -> fmcsa_verifications`.
   - Optionally run `POST /fmcsa/refresh-all` to re-verify every stored carrier/broker; inspect the summary response and confirm new entries in `data/response.json`.
10. **Onboarding coach (Week 3)**
    - Upload a document, note its `document_id`, and call `GET /onboarding/coach/{document_id}`. Verify the response contains role-specific actions and matches the validation/FMCSA state.
