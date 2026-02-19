# 🎬 Visual User Journey - Multi-Document Onboarding

## Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  USER LANDS ON CHATBOT                                          │
│  (landing_page/Chatbot.jsx)                                     │
│                                                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [STATE: SELECT_ROLE]                                           │
│  Bot: "Welcome to FreightPower! Tell me your role:"             │
│  Suggestions: ["Carrier", "Driver", "Shipper"]                  │
│                                                                 │
│  USER INPUT: "carrier"                                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [STATE: COLLECT_INFO]                                          │
│  Bot: "For Carriers, we need your DOT Number"                   │
│  Suggestions: ["DOT 1234567"]                                   │
│  UI Action: None                                                │
│                                                                 │
│  USER INPUT: "1234567"                                          │
│                                                                 │
│  SESSION DATA:                                                  │
│  ├─ collected_data.dot_number = "1234567"                       │
│  └─ collected_data.company_name = "Pending Verification"        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [STATE: UPLOAD_DOC] ⭐ MULTI-DOCUMENT LOOP STARTS              │
│  Bot: "Upload your MC Authority Letter or Insurance Certificate"│
│  UI Action: "show_upload"                                       │
│                                                                 │
│  USER ACTION: [UPLOADS MC_Authority.pdf]                        │
│                                                                 │
│  ╔═══════════════════════════════════════════════════════════╗ │
│  ║  BACKEND PROCESSING:                                      ║ │
│  ║  1. Document classification (Groq Vision)                 ║ │
│  ║     → document_type: "MC_CERT"                            ║ │
│  ║     → confidence: 0.95                                    ║ │
│  ║                                                           ║ │
│  ║  2. Field extraction (Groq extraction)                    ║ │
│  ║     → company_name: "ABC Trucking"                        ║ │
│  ║     → mc_number: "987654"                                 ║ │
│  ║     → authority_date: "2022-01-15"                        ║ │
│  ║                                                           ║ │
│  ║  3. Compliance scoring                                    ║ │
│  ║     → total_score: 85/100                                 ║ │
│  ║     → missing_critical: ["Expiration Date"]               ║ │
│  ║                                                           ║ │
│  ║  4. SESSION UPDATE:                                       ║ │
│  ║     ├─ document_ids.append("doc_1")                       ║ │
│  ║     ├─ documents_with_scores += {                         ║ │
│  ║     │    doc_id: "doc_1",                                 ║ │
│  ║     │    filename: "MC_Authority.pdf",                    ║ │
│  ║     │    score: 85,                                       ║ │
│  ║     │    missing: ["Expiration Date"],                    ║ │
│  ║     │    extracted_fields: {...}                          ║ │
│  ║     │  }                                                  ║ │
│  ║     ├─ temp_score = 85                                    ║ │
│  ║     ├─ cumulative_score = 85  (avg: 85/1)                 ║ │
│  ║     └─ missing_fields_across_docs = ["Expiration Date"]   ║ │
│  ╚═══════════════════════════════════════════════════════════╝ │
│                                                                 │
│  Bot: ✅ Received MC_Authority.pdf                              │
│       Score: 85/100                                             │
│       Missing: Expiration Date                                  │
│                                                                 │
│       Would you like to:                                        │
│  Suggestions: ["Upload Another Document", "Proceed"]            │
│  UI Action: "show_score_animation"                              │
│                                                                 │
│  USER CHOICE: "upload another"                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼ (LOOP BACK TO UPLOAD_DOC)
┌─────────────────────────────────────────────────────────────────┐
│  [STATE: UPLOAD_DOC] ⭐ SECOND DOCUMENT                         │
│  Bot: "Great! Please upload your next document."                │
│  UI Action: "show_upload"                                       │
│                                                                 │
│  USER ACTION: [UPLOADS Insurance_Certificate.pdf]               │
│                                                                 │
│  ╔═══════════════════════════════════════════════════════════╗ │
│  ║  BACKEND PROCESSING:                                      ║ │
│  ║  1. Document classification → "COI_CARRIER" (0.92)        ║ │
│  ║  2. Field extraction:                                     ║ │
│  ║     → insurance_provider: "Great American"                ║ │
│  ║     → policy_number: "GP-123456"                          ║ │
│  ║     → coverage_amount: "1000000"                          ║ │
│  ║  3. Scoring → 90/100                                      ║ │
│  ║     → missing_critical: ["Broker Authority"]              ║ │
│  ║                                                           ║ │
│  ║  4. SESSION UPDATE:                                       ║ │
│  ║     ├─ documents_with_scores now has 2 items              ║ │
│  ║     ├─ temp_score = 90                                    ║ │
│  ║     ├─ cumulative_score = 87.5  (avg: (85+90)/2)          ║ │
│  ║     └─ missing_fields_across_docs = [                     ║ │
│  ║          "Broker Authority",                              ║ │
│  ║          "Expiration Date"                                ║ │
│  ║        ]                                                  ║ │
│  ╚═══════════════════════════════════════════════════════════╝ │
│                                                                 │
│  Bot: ✅ Received Insurance_Certificate.pdf                     │
│       Score: 90/100 | Overall: 87/100  ⭐ CUMULATIVE SHOWN    │
│       Missing: Broker Authority                                 │
│                                                                 │
│       Would you like to:                                        │
│  Suggestions: ["Upload Another Document", "Proceed"]            │
│  UI Action: "show_score_animation"                              │
│                                                                 │
│  USER CHOICE: "proceed"                                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼ (TRANSITION TO CREATE_ACCOUNT)
┌─────────────────────────────────────────────────────────────────┐
│  [STATE: CREATE_ACCOUNT]                                        │
│                                                                 │
│  Bot: 📋 **Onboarding Summary**                                  │
│       Documents collected: 2                                    │
│       Overall compliance score: 87/100                          │
│                                                                 │
│       Documents:                                                │
│       1. MC_Authority.pdf - Score: 85/100                       │
│       2. Insurance_Certificate.pdf - Score: 90/100              │
│                                                                 │
│       ⚠️ Still missing: Broker Authority, Expiration Date       │
│       (You can provide these on the dashboard)                  │
│                                                                 │
│       Ready to create your account and access the dashboard?   │
│                                                                 │
│  Suggestions: ["Yes, Create Account", "Upload Another Document"]│
│  UI Action: "show_summary"                                      │
│                                                                 │
│  USER CHOICE: "yes"                                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼ (TRANSITION TO COMPLETED)
┌─────────────────────────────────────────────────────────────────┐
│  [STATE: COMPLETED]                                             │
│                                                                 │
│  ╔═══════════════════════════════════════════════════════════╗ │
│  ║  PREPARE DASHBOARD PAYLOAD:                               ║ │
│  ║  {                                                        ║ │
│  ║    "role": "CARRIER",                                     ║ │
│  ║    "dot": "1234567",                                      ║ │
│  ║    "company": "ABC Trucking",                             ║ │
│  ║    "cdl": null,                                           ║ │
│  ║    "score": 87.5,                                         ║ │
│  ║    "documents": [                                         ║ │
│  ║      {                                                    ║ │
│  ║        "doc_id": "doc_1",                                 ║ │
│  ║        "filename": "MC_Authority.pdf",                    ║ │
│  ║        "score": 85,                                       ║ │
│  ║        "missing": ["Expiration Date"],                    ║ │
│  ║        "extracted_fields": {...}                          ║ │
│  ║      },                                                   ║ │
│  ║      {                                                    ║ │
│  ║        "doc_id": "doc_2",                                 ║ │
│  ║        "filename": "Insurance_Certificate.pdf",           ║ │
│  ║        "score": 90,                                       ║ │
│  ║        "missing": ["Broker Authority"],                   ║ │
│  ║        "extracted_fields": {...}                          ║ │
│  ║      }                                                    ║ │
│  ║    ],                                                     ║ │
│  ║    "missing_fields": ["Broker Authority", "Expiration"]   ║ │
│  ║  }                                                        ║ │
│  ╚═══════════════════════════════════════════════════════════╝ │
│                                                                 │
│  ChatResponse:                                                  │
│  ├─ message: "Perfect! Redirecting you to your dashboard..."   │
│  ├─ next_step: COMPLETED                                       │
│  ├─ ui_action: "redirect_dashboard"                            │
│  ├─ redirect_url: "/carrier-dashboard"  ⭐ ROLE-SPECIFIC      │
│  └─ data_payload: { ...payload above... }                      │
│                                                                 │
│  Frontend receives response                                     │
│  → Detects ui_action = "redirect_dashboard"                    │
│  → Waits 1.5 seconds (UX pause)                                │
│  → navigate("/carrier-dashboard", {                            │
│      state: { prefill: data_payload }                          │
│    })                                                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  DASHBOARD LOADS (/carrier-dashboard)                           │
│  Component: src/components/carrier/CarrierDashboard.jsx        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 📄 DOCUMENTS UPLOADED                                     │ │
│  │                                                           │ │
│  │ Compliance Score: 87/100  🟡                              │ │
│  │ ████████░ 87%                                            │ │
│  │                                                           │ │
│  │ 1. MC_Authority.pdf                     Score: 85/100    │ │
│  │    Company: ABC Trucking                Missing: ...     │ │
│  │    [View Details]  [Replace Document]                    │ │
│  │                                                           │ │
│  │ 2. Insurance_Certificate.pdf              Score: 90/100   │ │
│  │    Provider: Great American              Missing: ...     │ │
│  │    [View Details]  [Replace Document]                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ✅ EXTRACTED INFORMATION                                  │ │
│  │                                                           │ │
│  │ Company Name:  ABC Trucking  (from document)             │ │
│  │ DOT Number:    1234567       (from user input)           │ │
│  │ MC Number:     987654        (from document)             │ │
│  │ Insurance:     Great American (from document)            │ │
│  │ Coverage:      $1,000,000    (from document)             │ │
│  │ Expiration:    [EMPTY]       ⚠️ STILL NEEDED             │ │
│  │ Broker Auth:   [EMPTY]       ⚠️ STILL NEEDED             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 📋 COMPLETE YOUR PROFILE                                 │ │
│  │                                                           │ │
│  │ Fields with ⚠️ must be filled to complete onboarding      │ │
│  │                                                           │ │
│  │ Contact Person:  [________]                              │ │
│  │ Phone:           [________]                              │ │
│  │ Expiration Date: [________] ⚠️                            │ │
│  │ Broker Auth:     [________] ⚠️                            │ │
│  │                                                           │ │
│  │ [+ Upload Another Document]  (to improve score)          │ │
│  │ [Continue Profile] [Save & Exit]                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  USER FILLS IN REMAINING FIELDS...                             │
│  USER SUBMITS FORM                                             │
│                                                                 │
│  Dashboard calls: POST /onboarding/save                        │
│  {                                                             │
│    "role": "CARRIER",                                          │
│    "data": {                                                   │
│      "dot_number": "1234567",                                  │
│      "company_name": "ABC Trucking",                           │
│      "mc_number": "987654",                                    │
│      "insurance_provider": "Great American",                   │
│      "expiration_date": "2025-12-31",                          │
│      "broker_authority": "[document_upload]"                   │
│    }                                                           │
│  }                                                             │
│                                                                 │
│  Backend: Saves to Firebase Firestore                          │
│  ├─ Updates user profile                                       │
│  ├─ Sets onboarding_completed = true                           │
│  ├─ Stores onboarding_step = "COMPLETED"                       │
│  └─ Saves all extracted + manual fields                        │
│                                                                 │
│  Dashboard: Shows success message                              │
│  "🎉 Onboarding Complete! You can now access all features."    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

```
USER INPUTS
    │
    ├─ Chat Messages: "carrier", "1234567", "proceed", "yes"
    │
    └─ Document Uploads: [PDF 1], [PDF 2], ...
                    │
                    ▼
        BACKEND PROCESSING
        ├─ Chat state machine (UPLOAD_DOC loop)
        ├─ Document classification (Groq Vision)
        ├─ Field extraction (Groq extraction)
        ├─ Compliance scoring
        └─ Session tracking (ChatSession)
                    │
                    ▼
        SESSION DATA
        ├─ documents_with_scores: [{doc1}, {doc2}, ...]
        ├─ cumulative_score: 87.5
        ├─ missing_fields_across_docs: [field1, field2]
        └─ collected_data: {dot, company, ...}
                    │
                    ▼
        RESPONSE TO FRONTEND
        ├─ message: Bot response
        ├─ next_step: OnboardingStep
        ├─ ui_action: "redirect_dashboard"
        ├─ redirect_url: "/carrier-dashboard"
        └─ data_payload: {all document data}
                    │
                    ▼
        FRONTEND PROCESSING
        ├─ React Router state: {prefill: payload}
        ├─ Navigate: /carrier-dashboard
        └─ Pass data to dashboard component
                    │
                    ▼
        DASHBOARD DISPLAY
        ├─ Show pre-filled fields
        ├─ Display document scores
        ├─ List missing fields
        └─ Enable user to complete profile
                    │
                    ▼
        FINAL SUBMISSION
        ├─ User completes form
        ├─ POST /onboarding/save
        ├─ Backend saves to Firebase
        └─ Onboarding complete! 🎉
```

---

## 🔄 State Transitions

```
START
  ↓
[WELCOME] ← "reset" / "hi" / "hello"
  ↓
[SELECT_ROLE] ← User says role
  │         ↑
  │         └─ Invalid input
  ↓
[COLLECT_INFO] ← Role selected
  │          ↑
  │          └─ Invalid input
  ↓
[UPLOAD_DOC] ← Identifier captured ⭐ MULTI-DOCUMENT LOOP
  │        ↑↓
  │        ├─ "Upload another" ← [Loop back] ⭐ NEW
  │        │     ↓
  │        ├─ Process new document
  │        │     ↓
  │        └─ Ask again: "Upload or proceed?"
  │
  │ "Proceed to account creation"
  ↓
[CREATE_ACCOUNT] ← User ready to create account
  │           ↑
  │           └─ "Upload another" ← [Can go back] ⭐ NEW
  │                ↓
  │            [Back to UPLOAD_DOC]
  │
  │ "Yes, create account"
  ↓
[COMPLETED] ← Account creation confirmed
  │       ↓
  │    Redirect to dashboard
  │       ↓
  │    Dashboard with pre-fill data
  │
  └─ Conversation ends, user on dashboard
```

---

## 🎯 Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Documents per session | 1 | Unlimited |
| Score calculation | Single | Cumulative |
| User prompts | 1 question | Multiple clear options |
| Loop capability | No | Yes |
| Dashboard data | Basic | Complete with metadata |
| State clarity | Ambiguous | Explicit |
| User control | Limited | Full |

---

## ✨ This Journey Shows

✅ Complete multi-document flow  
✅ Automatic processing at each step  
✅ Clear user decision points  
✅ Cumulative scoring  
✅ Data persistence through redirect  
✅ Dashboard pre-population  
✅ User can complete remaining fields  
✅ Final onboarding completion  

**Everything works together seamlessly!** 🚀
