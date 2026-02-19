# apps/api/chat_flow.py
import re
from typing import Dict, Any, Optional
from .models import ChatSession, OnboardingStep, Role, ChatResponse
from .storage import ResponseStore 
from .scoring import score_onboarding

# In-memory session store for MVP (Use Redis in production)
sessions: Dict[str, ChatSession] = {}

def get_or_create_session(session_id: str) -> ChatSession:
    if session_id not in sessions:
        sessions[session_id] = ChatSession(session_id=session_id)
    return sessions[session_id]

def process_onboarding_chat(
    session_id: str, 
    user_text: str, 
    doc_event: Optional[Dict] = None, 
    store: ResponseStore = None
) -> ChatResponse:
    session = get_or_create_session(session_id)
    text = user_text.lower().strip()
    
    # --- 0. CHECK IF ALREADY COMPLETED ---
    if session.step == OnboardingStep.COMPLETED:
        # Map role to dashboard URL
        dashboard_routes = {
            Role.CARRIER: "/carrier-dashboard",
            Role.DRIVER: "/driver-dashboard",
            Role.SHIPPER: "/shipper-dashboard"
        }
        redirect_url = dashboard_routes.get(session.role, "/dashboard")
        return ChatResponse(
            message="Your onboarding has been completed! 🎉 The page should have redirected to your dashboard. If not, click the link below to continue.",
            next_step=OnboardingStep.COMPLETED,
            ui_action="redirect_dashboard",
            redirect_url=redirect_url,
            suggestions=["Go to Dashboard"]
        )
    
    # --- 1. RESET / WELCOME ---
    if text in ["restart", "reset", "hi", "hello", "start"]:
        session.step = OnboardingStep.SELECT_ROLE
        session.collected_data = {}
        session.document_ids = []
        return ChatResponse(
            message="Welcome to FreightPower! I can help you get onboarded in minutes. First, tell me your role.\n\n💡 **Type or click:** 'Carrier', 'Driver', or 'Shipper'",
            next_step=OnboardingStep.SELECT_ROLE,
            suggestions=["Carrier", "Driver", "Shipper/Broker"]
        )

    # --- 2. ROLE SELECTION ---
    if session.step == OnboardingStep.SELECT_ROLE:
        if "carrier" in text:
            session.role = Role.CARRIER
            session.step = OnboardingStep.COLLECT_INFO
            return ChatResponse(
                message="Great! For Carriers, we need your **DOT Number** to auto-verify your authority.\n\n💡 **Enter a 6-8 digit DOT number** (e.g., 'DOT 1234567' or just '1234567')",
                next_step=OnboardingStep.COLLECT_INFO,
                suggestions=["DOT 1234567"]
            )
        elif "driver" in text:
            session.role = Role.DRIVER
            session.step = OnboardingStep.COLLECT_INFO
            return ChatResponse(
                message="Welcome, Driver! To start, please provide your **CDL License Number**.\n\n💡 **Type your CDL number** (alphanumeric, e.g., 'A1234567')",
                next_step=OnboardingStep.COLLECT_INFO
            )
        elif "shipper" in text or "broker" in text:
            session.role = Role.SHIPPER
            session.step = OnboardingStep.COLLECT_INFO
            return ChatResponse(
                message="Understood. Please provide your **Company Name**.\n\n💡 **Type your full company name** (e.g., 'ABC Logistics LLC')",
                next_step=OnboardingStep.COLLECT_INFO
            )
        else:
            return ChatResponse(
                message="Please select one of the following roles to continue.\n\n💡 **Type:** 'Carrier', 'Driver', or 'Shipper'",
                next_step=OnboardingStep.SELECT_ROLE,
                suggestions=["Carrier", "Driver", "Shipper"]
            )

    # --- 3. DATA CAPTURE (Regex) ---
    if session.step == OnboardingStep.COLLECT_INFO:
        if session.role == Role.CARRIER:
            # Extract 6-8 digit DOT number
            dot_match = re.search(r'\b\d{6,8}\b', text)
            if dot_match:
                session.collected_data["dot_number"] = dot_match.group()
                session.collected_data["company_name"] = "Pending Verification" # Placeholder until lookup
                session.step = OnboardingStep.UPLOAD_DOC
                return ChatResponse(
                    message=f"✅ Perfect! DOT **{session.collected_data['dot_number']}** saved.\n\n📋 **Next Step: Upload Required Documents**\n\nAs a **Carrier**, you need to upload ONE of these:\n\n📄 **Required Documents:**\n• **MC Authority Certificate** (from FMCSA)\n• **Certificate of Insurance (COI)** - Liability coverage\n• **IFTA License** (fuel tax agreement)\n\n💡 **How to continue:**\n• Click the 📤 upload button below, OR\n• Drag & drop your document here\n\n⚙️ Our AI will automatically extract expiry dates and verify your document!",
                    next_step=OnboardingStep.UPLOAD_DOC,
                    ui_action="show_upload" # Tells frontend to open upload/camera
                )
            else:
                return ChatResponse(message="⚠️ I couldn't find a valid DOT number.\n\n💡 Please enter a **6-8 digit number** (e.g., 'DOT 1234567' or just '1234567')", next_step=OnboardingStep.COLLECT_INFO)

        elif session.role == Role.DRIVER:
            # Basic CDL alphanumeric check
            if len(text) > 5:
                session.collected_data["cdl_number"] = text
                session.step = OnboardingStep.UPLOAD_DOC
                return ChatResponse(
                    message=f"✅ Excellent! CDL Number **{text}** saved.\n\n📋 **Next Step: Upload Required Documents**\n\nAs a **Driver**, you need to upload ONE of these:\n\n📄 **Required Documents:**\n• **CDL License (Class A)** - Your commercial driver's license\n• **DOT Medical Certificate** - Current medical card\n• **Motor Vehicle Record (MVR)** - Driving history\n• **Driver Registration Application** - Employment form\n\n💡 **How to continue:**\n• Click the 📤 upload button below, OR\n• Drag & drop your document here\n\n⚙️ Our AI will automatically verify your credentials and extract expiry dates!",
                    next_step=OnboardingStep.UPLOAD_DOC,
                    ui_action="show_upload"
                )
        
        elif session.role == Role.SHIPPER:
             session.collected_data["company_name"] = text
             session.step = OnboardingStep.UPLOAD_DOC
             return ChatResponse(
                 message=f"✅ Great! Company **{text}** saved.\n\n📋 **Next Step: Upload Business Verification**\n\nAs a **Shipper/Broker**, you need to upload ONE of these:\n\n📄 **Required Documents:**\n• **W-9 Tax Form** - For tax purposes\n• **Business License** - State/local business registration\n• **Certificate of Insurance** - Liability coverage\n\n💡 **How to continue:**\n• Click the 📤 upload button below, OR\n• Drag & drop your document here\n\n⚙️ Our AI will automatically verify your business information!",
                 next_step=OnboardingStep.UPLOAD_DOC,
                 ui_action="show_upload"
             )

    # --- 4. DOCUMENT CAPTURE & SCORING ---
    if session.step == OnboardingStep.UPLOAD_DOC:
        # User uploaded a file, Frontend sends attached_document_id
        if doc_event and doc_event.get("document_id"):
            doc_id = doc_event.get("document_id")
            session.document_ids.append(doc_id)
            
            # Fetch the document from your existing storage
            doc_record = store.get_document(doc_id)
            
            if doc_record:
                # --- DOCUMENT SCORING ---
                extraction = doc_record.get("extraction", {})
                validation = doc_record.get("validation", {})
                score_result = score_onboarding(extraction, validation)
                
                doc_score = score_result.get("total_score", 0)
                missing_fields = score_result.get("missing_critical", [])
                
                # Override manually entered DOT/MC with extracted values (if present)
                # This prioritizes document-extracted values over user input
                if extraction.get("usdot"):
                    session.collected_data["dot_number"] = extraction["usdot"]
                elif extraction.get("carrier_usdot"):
                    session.collected_data["dot_number"] = extraction["carrier_usdot"]
                
                if extraction.get("mc_number"):
                    session.collected_data["mc_number"] = extraction["mc_number"]
                
                if extraction.get("carrier_name"):
                    session.collected_data["company_name"] = extraction["carrier_name"]
                
                # Track this document
                session.temp_score = doc_score
                session.documents_with_scores.append({
                    "doc_id": doc_id,
                    "filename": doc_record.get("filename"),
                    "score": doc_score,
                    "missing": missing_fields,
                    "extracted_fields": extraction
                })
                
                # Calculate cumulative score and aggregate missing fields
                scores = [d["score"] for d in session.documents_with_scores]
                session.cumulative_score = sum(scores) / len(scores) if scores else 0
                
                # Aggregate missing fields (unique)
                all_missing = set()
                for doc in session.documents_with_scores:
                    all_missing.update(doc["missing"])
                session.missing_fields_across_docs = sorted(list(all_missing))
                
                # Build response message
                msg = f"✅ Received {doc_record.get('filename')}.\n"
                msg += f"   Score: {doc_score}/100"
                
                if len(session.documents_with_scores) > 1:
                    msg += f" | Overall: {int(session.cumulative_score)}/100"
                
                if missing_fields:
                    msg += f"\n   Missing: {', '.join(missing_fields[:3])}"
                
                # Ask user what to do next with clear keywords
                msg += "\n\n━━━━━━━━━━━━━━━━━━━━\n\n**What would you like to do next?**\n\n💡 **Type one of these keywords:**\n• Type **'upload'** or **'more'** → Upload another document\n• Type **'proceed'** or **'done'** → Review and create account\n\n✨ You can also click the buttons below!"
                
                return ChatResponse(
                    message=msg,
                    next_step=OnboardingStep.UPLOAD_DOC,
                    suggestions=["Upload Another Document", "Proceed to Account Creation"],
                    ui_action="show_score_animation"
                )
            else:
                 return ChatResponse(
                     message="⚠️ I received the upload but couldn't process it.\n\n💡 Please ensure you're uploading a valid document (PDF or image format) and try again.", 
                     next_step=OnboardingStep.UPLOAD_DOC,
                     ui_action="show_upload"
                 )
        
        # User responding to "Upload Another or Proceed?" question
        elif text:
            text_lower = text.lower().strip()
            
            # User wants to proceed to account creation
            if any(word in text_lower for word in ["proceed", "create", "account", "yes", "done", "finish", "ready", "continue"]):
                session.step = OnboardingStep.CREATE_ACCOUNT
                
                # Show summary and ask confirmation
                summary = f"📋 **Onboarding Summary**\n"
                summary += f"   Documents collected: {len(session.documents_with_scores)}\n"
                summary += f"   Overall compliance score: {int(session.cumulative_score)}/100\n"
                
                if session.documents_with_scores:
                    summary += f"\n   Documents:\n"
                    for i, doc in enumerate(session.documents_with_scores, 1):
                        summary += f"   {i}. {doc['filename']} - Score: {doc['score']}/100\n"
                
                if session.missing_fields_across_docs:
                    summary += f"\n   ⚠️ Still missing: {', '.join(session.missing_fields_across_docs[:3])}\n"
                    summary += f"   (You can provide these on the dashboard)\n"
                
                summary += f"\n━━━━━━━━━━━━━━━━━━━━\n\n**Ready to create your account?**\n\n💡 **Type one of these keywords:**\n• Type **'yes'** or **'create'** → Create account & go to dashboard\n• Type **'upload'** or **'back'** → Upload more documents\n\n✨ Click a button below to continue!"
                
                return ChatResponse(
                    message=summary,
                    next_step=OnboardingStep.CREATE_ACCOUNT,
                    suggestions=["Yes, Create Account", "Upload Another Document"],
                    ui_action="show_summary"
                )
            
            # User wants to upload another document
            elif any(word in text_lower for word in ["upload", "another", "more", "add", "no"]):
                # Role-specific document suggestions with detailed guidance
                doc_suggestions = ""
                if session.role == Role.CARRIER:
                    doc_suggestions = "\n\n📄 **Recommended Documents for Carriers:**\n• **MC Authority Certificate** - FMCSA operating authority\n• **Certificate of Insurance (COI)** - Liability & cargo coverage\n• **IFTA License** - International fuel tax agreement\n• **W9 Tax Form** - Business tax information"
                elif session.role == Role.DRIVER:
                    doc_suggestions = "\n\n📄 **Recommended Documents for Drivers:**\n• **CDL License (Class A)** - Commercial driver's license\n• **DOT Medical Certificate** - Current medical examination\n• **MVR (Motor Vehicle Record)** - Driving history report\n• **Driver Registration Application** - Employment form\n• **Clearinghouse Consent** - Drug & alcohol clearance"
                elif session.role == Role.SHIPPER:
                    doc_suggestions = "\n\n📄 **Recommended Documents for Shippers:**\n• **W-9 Tax Form** - Business tax information\n• **Business License** - State business registration\n• **Certificate of Insurance** - Liability coverage\n• **Broker Authority** - If applicable"
                
                return ChatResponse(
                    message=f"Perfect! Let's add another document.{doc_suggestions}\n\n💡 **How to upload:**\n• Click the 📤 upload button below, OR\n• Drag & drop your file here\n\n⚙️ After upload, type **'proceed'** when ready to continue!",
                    next_step=OnboardingStep.UPLOAD_DOC,
                    ui_action="show_upload"
                )
            
            else:
                # Unclear response - provide very clear instructions
                return ChatResponse(
                    message="🤔 I didn't understand that. Let me help you!\n\n**Please choose one option:**\n\n📤 **To upload another document:**\n   Type: **'upload'**, **'more'**, or **'add'**\n\n✅ **To review and create account:**\n   Type: **'proceed'**, **'done'**, or **'continue'**\n\n💡 Or simply click one of the buttons below!",
                    next_step=OnboardingStep.UPLOAD_DOC,
                    suggestions=["Upload Another Document", "Proceed to Account Creation"]
                )
        
        # If no document uploaded and no text response
        else:
             return ChatResponse(
                 message="⚠️ I need a document to proceed.\n\n💡 **Please click the upload button below** to attach your document (PDF or image).", 
                 next_step=OnboardingStep.UPLOAD_DOC,
                 ui_action="show_upload"
             )

    # --- 5. CREATE ACCOUNT CONFIRMATION ---
    if session.step == OnboardingStep.CREATE_ACCOUNT:
        text_lower = text.lower().strip()
        if any(word in text_lower for word in ["create", "account", "yes", "continue", "proceed", "skip", "ready"]):
            session.step = OnboardingStep.COMPLETED
            # Prepare payload to pre-fill dashboard forms and save to Firebase
            payload = {
                "role": session.role,
                "collected_data": {
                    "dot_number": session.collected_data.get("dot_number"),
                    "mc_number": session.collected_data.get("mc_number"),
                    "company_name": session.collected_data.get("company_name"),
                    "full_name": session.collected_data.get("full_name"),
                    "cdl_number": session.collected_data.get("cdl_number"),
                    "first_name": session.collected_data.get("first_name"),
                    "last_name": session.collected_data.get("last_name"),
                    "phone": session.collected_data.get("phone"),
                },
                "document_ids": session.document_ids,
                "documents": session.documents_with_scores,  # Pass all document info with scores
                "compliance_score": session.cumulative_score,
                "missing_fields": session.missing_fields_across_docs
            }
            # Route to role-specific dashboard instead of signup
            dashboard_routes = {
                Role.CARRIER: "/carrier-dashboard",
                Role.DRIVER: "/driver-dashboard",
                Role.SHIPPER: "/shipper-dashboard"
            }
            redirect_url = dashboard_routes.get(session.role, "/dashboard")
            return ChatResponse(
                message="Perfect! Redirecting you to your dashboard to complete your profile...",
                next_step=OnboardingStep.COMPLETED,
                ui_action="redirect_dashboard", 
                redirect_url=redirect_url,
                data_payload=payload
            )
        elif any(word in text_lower for word in ["upload", "another", "more", "add", "no"]):
            # User wants to upload more documents
            session.step = OnboardingStep.UPLOAD_DOC
            # Role-specific document suggestions
            doc_suggestions = ""
            if session.role == Role.CARRIER:
                doc_suggestions = "\n\n📄 **Suggested Documents:**\n• MC Authority Certificate\n• Certificate of Insurance\n• IFTA License"
            elif session.role == Role.DRIVER:
                doc_suggestions = "\n\n📄 **Suggested Documents:**\n• CDL License\n• DOT Medical Certificate\n• MVR (Motor Vehicle Record)"
            elif session.role == Role.SHIPPER:
                doc_suggestions = "\n\n📄 **Suggested Documents:**\n• W-9 Form\n• Business License\n• Certificate of Insurance"
            
            return ChatResponse(
                message=f"Great! Please upload your next document.{doc_suggestions}\n\n💡 Click the upload button or drag & drop.",
                next_step=OnboardingStep.UPLOAD_DOC,
                ui_action="show_upload"
            )
        else:
            # Unclear response, ask again with very clear keywords
            return ChatResponse(
                message="🤔 I didn't catch that. Here are your options:\n\n**To create your account now:**\n   Type: **'yes'**, **'create'**, or **'proceed'**\n\n**To upload more documents:**\n   Type: **'upload'**, **'more'**, or **'back'**\n\n💡 Or click one of the buttons below!",
                next_step=OnboardingStep.CREATE_ACCOUNT,
                suggestions=["Yes, Create Account", "Upload Another Document"]
            )

    return ChatResponse(
        message="🤔 I didn't understand that.\n\n💡 Try typing:\n• 'reset' to start over\n• 'help' for assistance\n• Or use the suggested options above", 
        next_step=session.step,
        suggestions=["Reset", "Help"]
    )