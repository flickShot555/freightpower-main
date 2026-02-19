# 🚀 Automated Onboarding Pipeline - Complete Guide

## Overview
The FreightPower onboarding chatbot guides users through a 7-step process from initial role selection to account creation and dashboard access.

---

## 📋 Pipeline Flow

### **Stage 1: Initial Welcome**
```
User visits chatbot
Bot: "Welcome to FreightPower! First, tell me your role:"
User selects: "Carrier", "Driver", or "Shipper"
Session State: WELCOME → SELECT_ROLE
```

### **Stage 2: Identifier Collection**
```
Based on selected role:
- Carrier: Bot asks for DOT Number (6-8 digits)
- Driver: Bot asks for CDL License Number
- Shipper: Bot asks for Company Name

User enters identifier
System validates and stores in session
Session State: SELECT_ROLE → COLLECT_INFO
```

### **Stage 3: Document Upload (Optional but Recommended)**
```
Bot: "Please upload your [MC Authority / CDL Photo / W-9 Form]"
User uploads document via file picker or camera

Backend processes:
1. Document Classification (Groq AI vision)
   - Detects document type
   - Extracts key fields (company name, dates, numbers)
   
2. Document Extraction (Groq AI extraction)
   - Pulls: dates, MC number, company name, contact info
   - Stores in Firebase (document_id reference)
   
3. Compliance Scoring
   - Calculates score based on extracted fields
   - Identifies missing critical fields
   - Returns score: 0-100 (higher = more complete)

Session State: COLLECT_INFO → UPLOAD_DOC
```

### **Stage 4: Validation & Account Decision**
```
Bot displays:
"Received [filename]. Validation Score: X/100. Missing: [critical_fields]"
"Ready to create your account?"

User decision:
- Say: "continue", "yes", "proceed", "skip", "ready"
  → Proceed to Stage 5
- Say: "upload" or upload another document
  → Loop back to Stage 3

Session State: UPLOAD_DOC → CREATE_ACCOUNT
```

### **Stage 5: Account Creation Confirmation**
```
Bot: "Perfect! Redirecting you to your dashboard to complete your profile..."

Backend:
1. Creates session payload with:
   - role: "CARRIER" / "DRIVER" / "SHIPPER"
   - dot: extracted DOT number
   - company: extracted company name
   - score: compliance validation score
   
2. Sends redirect response with:
   - ui_action: "redirect_dashboard"
   - redirect_url: "/carrier-dashboard" (role-specific)
   - data_payload: pre-fill data

Frontend:
1. Receives response
2. Waits 1.5 seconds (UX pause)
3. Navigates to /carrier-dashboard
4. Passes pre-fill data via React Router state

Session State: CREATE_ACCOUNT → COMPLETED
```

### **Stage 6: Dashboard (User-Facing)**
```
User arrives at /carrier-dashboard with pre-filled fields:
- DOT Number: 1234567 (from chatbot)
- Company Name: [extracted from document]
- Compliance Score: 80/100
- Document References: [pdf document_id]

User can:
- Review AI-extracted data (verify accuracy)
- Edit fields as needed
- Add missing information:
  - MC Number
  - Insurance effective date
  - Contact information
  - Insurance provider details
  - Business hours
  - Address

User submits form:
POST /onboarding/save
{
  "role": "CARRIER",
  "data": {
    "dot_number": "1234567",
    "company_name": "ABC Trucking",
    "mc_number": "987654",
    "insurance_provider": "Great American",
    "insurance_expiry": "2025-06-30",
    ...
  }
}

Backend:
1. Validates all required fields present
2. Stores in Firebase user profile
3. Updates: onboarding_completed = true
4. Returns success message
```

### **Stage 7: Post-Onboarding**
```
User is now registered and verified:
- Can login with credentials
- Can access full dashboard
- Can manage documents
- Can view compliance status
- Can schedule coaching calls
```

---

## 🔄 Session State Machine

```
┌─────────────┐
│   WELCOME   │  Initial state
└──────┬──────┘
       │ User says role
       ▼
┌──────────────┐
│ SELECT_ROLE  │  Choose: Carrier/Driver/Shipper
└──────┬───────┘
       │ Role selected
       ▼
┌──────────────┐
│ COLLECT_INFO │  Get DOT/CDL/Company
└──────┬───────┘
       │ Identifier captured
       ▼
┌──────────────┐
│ UPLOAD_DOC   │  ◄─────┐
└──────┬───────┘        │
       │                │
       │ Doc uploaded   │ User says "upload again"
       ▼                │
┌──────────────┐        │
│CREATE_ACCOUNT│────────┘
└──────┬───────┘
       │ User says "continue"/"yes"
       ▼
┌──────────────┐
│  COMPLETED   │  ──────► Redirect to Dashboard
└──────────────┘

If COMPLETED and user tries to chat again:
Bot: "Your onboarding has been completed! The page should have redirected..."
```

---

## 🔧 Backend Endpoints

### **Chat Endpoint**
```http
POST /chat/onboarding
Content-Type: application/json

{
  "session_id": "user_abc123",
  "user_text": "carrier",
  "document_event": null
}

Response:
{
  "message": "Great! For Carriers, we need your DOT Number...",
  "next_step": "COLLECT_INFO",
  "suggestions": ["DOT 1234567"],
  "ui_action": "show_upload",
  "redirect_url": null,
  "data_payload": null
}
```

### **Document Upload**
```http
POST /documents
Content-Type: multipart/form-data

file: [binary PDF data]

Response:
{
  "document_id": "doc_xyz789",
  "filename": "MC_Authority.pdf",
  "classification": {
    "document_type": "MC_CERT",
    "confidence": 0.95,
    "fields_detected": ["Company", "MC Number", "Issue Date"]
  },
  "extraction": {
    "company_name": "ABC Trucking LLC",
    "mc_number": "987654",
    "issue_date": "2022-01-15"
  },
  "validation": {
    "total_score": 80,
    "missing_critical": ["Expiration Date"]
  }
}
```

### **Onboarding Save**
```http
POST /onboarding/save
Authorization: Bearer {token}
Content-Type: application/json

{
  "role": "CARRIER",
  "data": {
    "dot_number": "1234567",
    "company_name": "ABC Trucking",
    "mc_number": "987654",
    "insurance_provider": "Great American",
    "insurance_expiry": "2025-06-30"
  }
}

Response: { "status": "success", "message": "Profile saved" }
```

---

## 🛠️ Recent Fixes Applied

### **Fix 1: Groq API Parameter Update**
**Problem:** `Completions.create() got an unexpected keyword argument 'max_completion_tokens'`

**Solution:** Updated vision.py to use `max_tokens` (newer SDK standard)
- Classification: `max_tokens=256`
- Extraction: `max_tokens=1200`
- Text models: `max_tokens=512`

**Status:** ✅ Applied

---

### **Fix 2: Dashboard Redirect Implementation**
**Problem:** Bot was redirecting to `/signup` instead of `/carrier-dashboard`

**Solution:** Updated chat_flow.py:
1. Added dynamic dashboard routing based on user role
2. Changed `ui_action` from `redirect_signup` → `redirect_dashboard`
3. Added `redirect_url` field to ChatResponse model
4. Updated Chatbot.jsx frontend component to handle new redirect

**Status:** ✅ Applied

---

### **Fix 3: Conversation State Handling**
**Problem:** After redirect, user could still type in chat and got "I didn't understand"

**Solution:** Added COMPLETED state handler:
```python
if session.step == OnboardingStep.COMPLETED:
    return ChatResponse(
        message="Your onboarding has been completed! 🎉 The page should have redirected to your dashboard...",
        next_step=OnboardingStep.COMPLETED,
        ui_action="redirect_dashboard",
        redirect_url=redirect_url
    )
```

**Status:** ✅ Applied

---

## ✅ Current User Journey

```
1. "carrier"
   → Bot confirms role selection ✓

2. "1234567"
   → Bot extracts DOT number ✓

3. Uploads PDF
   → Bot: "Validation Score: 80/100. Missing: Date. Ready?" ✓

4. "continue"
   → Bot: "Redirecting to dashboard..." ✓
   → Frontend navigates to /carrier-dashboard ✓
   → Dashboard pre-filled with: DOT, company name, score ✓

5. User fills remaining fields on dashboard
   → Submits form
   → Profile saved to Firebase ✓

6. Onboarding complete! 🎉
```

---

## 🚨 Known Limitations & Next Steps

### **Current Behavior**
- Chatbot requires file upload (though marked "optional")
- Score calculated only from document extraction (no FMCSA API call yet)
- Pre-fill data passed via React Router state (lost on page refresh)

### **Recommended Enhancements**
1. **Persistent Session Storage**
   - Store pre-fill data in localStorage before redirect
   - Dashboard reads from localStorage instead of Router state
   - Survives page refreshes

2. **FMCSA Real-Time Verification**
   - Call FMCSA API with extracted DOT/MC number
   - Verify active authority status
   - Update compliance score based on regulatory status

3. **Document Management**
   - Allow users to re-upload documents on dashboard
   - Show AI-extracted vs manually-entered data side-by-side
   - Allow document deletion/archival

4. **Progress Tracking**
   - Save progress mid-onboarding (incomplete sessions)
   - Email link to resume interrupted sessions
   - Show estimated time to completion

---

## 📞 Support

For issues with the onboarding pipeline, check:
1. Backend logs: `python -m uvicorn api.main:app --reload --port 5000`
2. Frontend errors: Browser DevTools Console
3. Chatbot session state: Check session_id in localStorage
4. Firebase user profile: Check Firestore `users` collection

