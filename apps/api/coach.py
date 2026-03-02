from __future__ import annotations

from typing import Dict, Any, List

ISSUE_ACTIONS = {
    "Valid COI (unexpired)": ("operations", "Upload a current Certificate of Insurance before activation."),
    "Complete W-9 (TIN + signature)": ("operations", "Collect a signed W-9 with TIN for payouts."),
    "Valid CDL (unexpired)": ("operations", "Request an updated CDL from the driver."),
    "Current DOT medical card": ("compliance", "Obtain a valid DOT medical certificate."),
    "MC status active": ("compliance", "Connect MC/DOT profile to verify authority automatically."),
}

DEFAULT_ACTION = ("operations", "Resolve outstanding onboarding tasks.")


def compute_coach_plan(document: Dict[str, Any], validation: Dict[str, Any], verification: Dict[str, Any] | None) -> Dict[str, Any]:
    actions: Dict[str, List[str]] = {"operations": [], "compliance": [], "sales": []}
    issues = validation.get("missing_fields") or validation.get("issues") or []

    for issue in issues:
        role, text = ISSUE_ACTIONS.get(issue, DEFAULT_ACTION)
        _add_action(actions, role, text)

    warnings = validation.get("warnings") or []
    for warn in warnings:
        _add_action(actions, "compliance", warn)

    overall = "Ready"
    if verification:
        result = verification.get("result")
        if result == "Blocked":
            overall = "Blocked"
            _add_action(actions, "compliance", "Carrier is blocked by FMCSA; pause onboarding and review.")
        elif result == "Warning":
            overall = "Warning"
            _add_action(actions, "compliance", "FMCSA returned warnings; perform manual review.")
        elif result == "Verified":
            overall = "Verified"
        for reason in verification.get("reasons", []):
            _add_action(actions, "compliance", reason)
    else:
        overall = validation.get("status", "attention").capitalize()

    summary_actions = {
        role: list(dict.fromkeys(items))[:5]
        for role, items in actions.items()
        if items
    }

    return {
        "status": overall,
        "actions": summary_actions,
    }


def _add_action(actions: Dict[str, List[str]], role: str, text: str):
    role_key = role if role in actions else "operations"
    actions[role_key].append(text)
