# 🤖 Multi-Document Onboarding Bot - Flow & Enhancements

## New Automated Onboarding Flow

### **Stage 1: Role Selection**
```
Bot: "Welcome to FreightPower! First, tell me your role:"
User: "carrier"
Bot: "Great! For Carriers, we need your DOT Number..."
```

### **Stage 2: Identifier Collection**
```
User: "1234567"
Bot: "Got it (DOT 1234567). Now, please upload your MC Authority Letter or Insurance Certificate."
[Upload button appears]
```

### **Stage 3: Multi-Document Collection Loop** ⭐ NEW
```
Iteration 1:
User: [uploads MC_Authority.pdf]
Bot: ✅ Received MC_Authority.pdf
     Score: 85/100
     Missing: Expiration Date
     
     Would you like to:
     • Upload Another Document
     • Proceed to Account Creation

User: "upload another"
Bot: "Great! Please upload your next document."
[Upload button appears]

Iteration 2:
User: [uploads Insurance_Certificate.pdf]
Bot: ✅ Received Insurance_Certificate.pdf
     Score: 90/100 | Overall: 87/100
     Missing: Broker Authority
     
     Would you like to:
     • Upload Another Document
     • Proceed to Account Creation

User: "proceed"
Bot: 📋 Onboarding Summary
     Documents collected: 2
     Overall compliance score: 87/100
     
     Documents:
     1. MC_Authority.pdf - Score: 85/100
     2. Insurance_Certificate.pdf - Score: 90/100
     
     ⚠️ Still missing: Broker Authority, Expiration Date
     (You can provide these on the dashboard)
     
     Ready to create your account and access the dashboard?

User: "yes"
```

### **Stage 4: Account Creation & Redirect**
```
Bot: "Perfect! Redirecting you to your dashboard to complete your profile..."

[1.5 second pause for UX]

Frontend: Navigates to /carrier-dashboard with payload:
{
  "role": "CARRIER",
  "dot": "1234567",
  "company": "ABC Trucking",
  "score": 87,
  "documents": [
    {
      "doc_id": "doc_1",
      "filename": "MC_Authority.pdf",
      "score": 85,
      "missing": ["Expiration Date"],
      "extracted_fields": {...}
    },
    {
      "doc_id": "doc_2", 
      "filename": "Insurance_Certificate.pdf",
      "score": 90,
      "missing": ["Broker Authority"],
      "extracted_fields": {...}
    }
  ],
  "missing_fields": ["Broker Authority", "Expiration Date"]
}
```

### **Stage 5: Dashboard Review & Completion**
```
User arrives at /carrier-dashboard

Dashboard shows:
- Pre-filled fields from documents
- Compliance score: 87/100 (visual indicator)
- List of uploaded documents with individual scores
- Missing fields highlighted as "Required to Complete"
- Extracted data for review (AI-extracted vs manual entry)

User can:
✓ Review AI-extracted data
✓ Edit/correct fields
✓ Add missing information
✓ View document scores and reasons for missing points
✓ Re-upload better quality documents

User submits → Profile saved → Onboarding complete!
```

---

## 📊 Key Improvements Made

### **1. Cumulative Scoring**
- **Before:** Single document score shown
- **After:** Average score across all documents
- **Impact:** Users can upload multiple docs to improve compliance score

### **2. Aggregate Missing Fields**
- **Before:** Show missing fields for each doc separately
- **After:** Show unique missing fields across ALL documents
- **Impact:** Clear view of what's still needed

### **3. Document Tracking**
- **Before:** Just store document IDs
- **After:** Store each doc with: filename, score, missing fields, extracted data
- **Impact:** Dashboard can show document history and individual scores

### **4. Explicit User Choice**
- **Before:** Bot asks "Ready to create account?" (ambiguous)
- **After:** "Would you like to upload another document or proceed?" (clear options)
- **Impact:** Users understand they can upload multiple times

### **5. Summary Before Commitment**
- **Before:** Redirect immediately after user says "yes"
- **After:** Show summary of documents + compliance score + missing fields
- **Impact:** User sees what they're committing with

---

## 🎯 Suggested Next-Level Enhancements

### **Enhancement 1: Smart Document Recommendations**
```python
def get_document_suggestions(role: Role, missing_fields: List[str]) -> List[str]:
    """Suggest next best documents to upload based on missing fields."""
    
    if role == Role.CARRIER:
        if "Broker Authority" in missing_fields:
            return ["Broker Authority Letter", "Carrier-Broker Agreement"]
        if "Expiration Date" in missing_fields:
            return ["Insurance Certificate with renewal date"]
        if "DOT Number not verified" in missing_fields:
            return ["FMCSA SafeStat Report"]
    
    return []

# Bot response:
"To improve your score, consider uploading:
 • Broker Authority Letter
 • FMCSA SafeStat Report
 
Next document?"
```

### **Enhancement 2: FMCSA Real-Time Verification**
```python
async def verify_carrier_with_fmcsa(dot_number: str) -> Dict:
    """Check FMCSA SafeStat status in real-time."""
    
    response = await fmcsa_client.get_carrier_data(dot_number)
    
    return {
        "authority_status": "Active",  # or "Inactive", "Pending"
        "legal_name": "ABC Trucking LLC",
        "mc_number": "987654",
        "out_of_service": False,
        "safety_rating": "Satisfactory",
        "last_inspection": "2024-12-01"
    }

# Use in bot:
Bot: "DOT 1234567 - Authority Status: ✅ ACTIVE (ABC Trucking LLC)"
    "Your FMCSA SafeStat rating is Satisfactory."
```

### **Enhancement 3: Bulk Field Validation**
```python
def validate_all_fields_against_extracted_data(
    documents: List[Dict],
    required_fields: Dict[Role, List[str]]
) -> ValidationResult:
    """Check which required fields are covered by uploaded documents."""
    
    extracted_fields = {}
    for doc in documents:
        extracted_fields.update(doc["extracted_fields"])
    
    required = required_fields[role]
    found_fields = set(extracted_fields.keys())
    missing = set(required) - found_fields
    
    return {
        "completion_percentage": len(found_fields) / len(required) * 100,
        "found_fields": list(found_fields),
        "missing_fields": list(missing),
        "ready_for_account": len(missing) == 0
    }
```

### **Enhancement 4: Progressive Onboarding**
```python
# Save progress even if user leaves chat
async def save_chat_session(session_id: str, session: ChatSession):
    """Store incomplete onboarding session for later resume."""
    
    await redis.setex(
        f"chat_session:{session_id}",
        ttl=7*24*3600,  # 7 days
        value=session.model_dump_json()
    )

# Email user resume link:
"Your onboarding is 87% complete!
 Click here to continue: https://app.com/onboarding/resume?session=xyz789"
```

### **Enhancement 5: AI-Powered Field Extraction Feedback**
```python
def show_extraction_confidence(extraction: Dict) -> str:
    """Show which extracted fields are high/low confidence."""
    
    high_confidence = [
        ("Company Name", "ABC Trucking", 0.99),
        ("MC Number", "987654", 0.95),
        ("DOT Number", "1234567", 0.98)
    ]
    
    low_confidence = [
        ("Expiration Date", "Date found but format unclear", 0.45)
    ]
    
    msg = "✅ High Confidence Fields (Verified):\n"
    for field, value, conf in high_confidence:
        msg += f"   • {field}: {value} ({int(conf*100)}%)\n"
    
    msg += "\n⚠️ Needs Review:\n"
    for field, note, conf in low_confidence:
        msg += f"   • {field}: {note} - Please verify\n"
    
    return msg
```

### **Enhancement 6: Multi-Role Support**
```python
ROLE_REQUIREMENTS = {
    Role.CARRIER: {
        "required_docs": ["MC_CERT", "COI_CARRIER", "W9_CARRIER"],
        "required_fields": ["company_name", "dot_number", "mc_number", "insurance_provider"],
        "min_score_to_proceed": 70
    },
    Role.DRIVER: {
        "required_docs": ["CDL", "MVR", "MEDICAL"],
        "required_fields": ["cdl_number", "first_name", "last_name"],
        "min_score_to_proceed": 75
    },
    Role.SHIPPER: {
        "required_docs": ["W9", "BUSINESS_LICENSE"],
        "required_fields": ["company_name", "tax_id"],
        "min_score_to_proceed": 60
    }
}

# Bot can check:
if session.cumulative_score < ROLE_REQUIREMENTS[role]["min_score_to_proceed"]:
    Bot: "Your current score (65/100) is below our recommended threshold (70/100).
         Consider uploading one more document to improve your chances of quick approval."
```

### **Enhancement 7: Document Deduplication**
```python
def check_duplicate_documents(
    session: ChatSession,
    new_doc_type: str
) -> Optional[str]:
    """Warn if user uploads same document type twice."""
    
    existing_types = [d["document_type"] for d in session.documents_with_scores]
    
    if new_doc_type in existing_types:
        return f"You've already uploaded a {new_doc_type}. Upload anyway?"
    
    return None
```

---

## 🔄 Updated State Machine

```
WELCOME
   │
   ├─ User role ──► SELECT_ROLE
   │                  │
   │                  └─ Role selected ──► COLLECT_INFO
   │                                          │
   │                                          └─ Identifier captured ──► UPLOAD_DOC ◄─────┐
   │                                                                          │          │
   │                                                                          │ Loop:   │
   │                                                                          ▼ Upload│
   │                                                                   Doc processed  │
   │                                                                   Calculate score│
   │                                                                          │      │
   │                                        ┌─ "upload" ────────────────────┘      │
   │                                        │                                      │
   │                                        │ "proceed" / "create" / "yes"         │
   │                                        │                                      │
   │                                        ▼                                      │
   │                                   CREATE_ACCOUNT                             │
   │                                        │                                      │
   │              ┌────── YES──────────┬────┴─ Confirm account creation           │
   │              │                    │                                           │
   │              │                    └─ Upload another? ──► UPLOAD_DOC ─────────┘
   │              │
   │              ▼
   │         COMPLETED
   │              │
   │              └─ Redirect to dashboard
   │
   └─ reset ──────────────────────────────────────────────────────────────────────┘

```

---

## 🚀 Implementation Status

### **✅ Completed**
- [x] Multi-document upload loop
- [x] Cumulative scoring across documents
- [x] Aggregate missing fields tracking
- [x] Clear "Upload Another or Proceed?" prompts
- [x] Document list in summary before commit
- [x] Document metadata passed to dashboard

### **⏳ Ready to Implement**
- [ ] Smart document recommendations based on missing fields
- [ ] FMCSA SafeStat real-time verification
- [ ] Field extraction confidence scores
- [ ] Save incomplete sessions to Redis
- [ ] Email resume links for abandoned onboarding
- [ ] Document deduplication warnings
- [ ] Role-specific minimum score thresholds

### **📋 Dashboard Integration Needed**
- [ ] Display all documents with individual scores
- [ ] Show AI extraction confidence for each field
- [ ] Allow re-upload of specific documents
- [ ] Side-by-side AI vs manual field comparison
- [ ] Highlight low-confidence extractions for review
- [ ] Progress bar showing completion percentage

---

## 💬 Example Complete Conversation

```
Bot: Welcome to FreightPower! First, tell me your role:
You: carrier

Bot: Great! For Carriers, we need your DOT Number to auto-verify your authority. Please enter it below.
You: 1234567

Bot: Got it (DOT 1234567). Now, please upload your MC Authority Letter or Insurance Certificate.
[Upload triggered]
You: [uploads MC_Authority.pdf]

Bot: ✅ Received MC_Authority.pdf
     Score: 85/100
     Missing: Expiration Date
     
     Would you like to:
     • Upload Another Document
     • Proceed to Account Creation
You: upload another

Bot: Great! Please upload your next document.
[Upload triggered]
You: [uploads Insurance_Certificate.pdf]

Bot: ✅ Received Insurance_Certificate.pdf
     Score: 90/100 | Overall: 87/100
     Missing: Broker Authority
     
     Would you like to:
     • Upload Another Document
     • Proceed to Account Creation
You: proceed

Bot: 📋 **Onboarding Summary**
     Documents collected: 2
     Overall compliance score: 87/100
     
     Documents:
     1. MC_Authority.pdf - Score: 85/100
     2. Insurance_Certificate.pdf - Score: 90/100
     
     ⚠️ Still missing: Broker Authority, Expiration Date
     (You can provide these on the dashboard)
     
     Ready to create your account and access the dashboard?
You: yes

Bot: Perfect! Redirecting you to your dashboard to complete your profile...
[Pause 1.5 seconds]
[Navigate to /carrier-dashboard with pre-fill data including documents & scores]

Dashboard shows:
- DOT: 1234567 (extracted)
- Company: ABC Trucking (extracted)
- MC Number: 987654 (extracted)
- Compliance Score: 87/100 🟡
- Documents Uploaded: 2 ✓
- Documents: [List showing each doc score]
- Missing: Broker Authority, Expiration Date (marked as "Still needed")

User can review, edit, add more info, and submit!
```

---

## 📞 Current Implementation

**Files Modified:**
1. `apps/api/chat_flow.py` - Complete rewrite of UPLOAD_DOC state
2. `apps/api/models.py` - Extended ChatSession with document tracking
3. `apps/api/models.py` - Added `redirect_url` to ChatResponse

**Backend Status:** ✅ Ready (hot-reload active)
**Frontend Status:** ✅ Ready (Chatbot.jsx updated)

Test the new flow now! The bot should:
1. Accept document uploads in a loop
2. Ask "Upload Another or Proceed?" after each doc
3. Show cumulative score
4. Display summary before final confirmation
5. Redirect to dashboard with all document data
