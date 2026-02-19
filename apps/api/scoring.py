# File: apps/api/scoring.py
from typing import Dict, Any, List

def score_onboarding(extraction: Dict[str, Any], validation: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    Calculates a provisional score (0-100) based on the presence of key fields
    in the extraction data and generates Next Best Actions (NBA) coaching tips.
    """
    score = 0
    missing_critical = []
    next_best_actions = [] # <--- NEW LIST FOR COACHING TIPS
    
    # Ensure validation is a dict if None passed
    validation = validation or {}

    # 1. BASELINE: Did we detect a valid document type? (Max 20 pts)
    doc_type = extraction.get("document_type", "OTHER")
    if doc_type and doc_type != "OTHER":
        score += 20
    else:
        missing_critical.append("Valid Document Type")

    # 2. IDENTITY: Do we have a Name or Company? (Max 30 pts)
    name_fields = ["driver_name", "company_name", "insured_name", "carrier_name", "legal_name", "business_name"]
    if any(extraction.get(k) for k in name_fields):
        score += 30
    else:
        missing_critical.append("Name/Identity")

    # 3. ID NUMBERS: Do we have a License, DOT, or Policy Number? (Max 30 pts)
    id_keys = ["license_number", "usdot", "mc_number", "policy_number", "cdl_number", "ein", "vin"]
    if any(extraction.get(k) for k in id_keys):
        score += 30
    else:
        missing_critical.append("ID Number")

    # 4. DATES: Do we have an Expiration or Issue Date? (Max 20 pts)
    date_keys = ["expiry_date", "expiration_date", "effective_date", "issue_date", "date"]
    if any(extraction.get(k) for k in date_keys):
        score += 20
    else:
        missing_critical.append("Date")

    # 5. VALIDATION PENALTY: Cap score if validation explicitly failed
    if validation.get("status") == "FAIL":
        score = min(score, 40) # Cap at 40 to indicate "Read but Invalid"
        missing_critical.extend(validation.get("issues", []))

    # Clean up missing list
    missing_critical = list(set(missing_critical))


    # --- COACHING LOGIC: GENERATE NEXT BEST ACTIONS (NBA) ---
    
    if score < 100:
        if "Valid Document Type" in missing_critical:
            next_best_actions.append("Upload a high-quality PDF or JPG of a required document (e.g., CDL, W-9).")

        if "Name/Identity" in missing_critical:
            next_best_actions.append("Ensure the full name or legal company name is clearly legible in the document.")

        if "ID Number" in missing_critical:
            if doc_type == "CDL":
                next_best_actions.append("Verify your CDL license number is captured correctly.")
            elif doc_type in ("MC_CERT", "COI_CARRIER"):
                next_best_actions.append("Ensure your USDOT or MC Number is visible and correct.")
            else:
                next_best_actions.append("Upload a core registration document containing a key identifier.")

        if "Date" in missing_critical:
            next_best_actions.append("Ensure the document has clear effective and expiration dates.")

        if validation.get("status") == "FAIL":
            # Add the first specific validation issue as an action
            first_issue = validation.get('issues', ["check document details"])[0]
            next_best_actions.append(f"Validation failed: Review '{first_issue}' and re-upload the corrected document.")
    
    else:
        next_best_actions.append("Profile readiness is 100%! Proceed to the Dashboard to access the Marketplace.")

    # --- FINAL RETURN ---
    return {
        "document_type": doc_type,
        "total_score": score,
        "missing_critical": missing_critical, 
        "next_best_actions": next_best_actions, # <--- NEW FIELD
        "validation": validation
    }