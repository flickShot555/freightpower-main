from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse

from typing import Any, Dict, Optional

from pathlib import Path

from ..auth import get_current_user, require_admin
from ..settings import settings
from ..storage import ResponseStore

from .models import (
    EligibleLoadsResponse,
    FactoringSubmitRequest,
    FactoringWebhookRequest,
    FinanceForecastResponse,
    FinanceSummaryResponse,
    InvoiceActionResponse,
    InvoiceCreateRequest,
    InvoiceListResponse,
    InvoiceRecord,
    InvoiceEmailRequest,
    InvoiceDisputeRequest,
    PaymentCreateRequest,
)
from .repo import (
    build_invoice_package_zip,
    create_invoice,
    dispute_invoice,
    get_invoice,
    get_invoice_pdf_context,
    issue_invoice,
    list_eligible_loads,
    list_invoices_for_user,
    list_invoices_for_payer,
    mark_overdue_invoices,
    process_webhook_event,
    record_payment,
    resolve_dispute,
    send_invoice_with_store,
    submit_to_factoring,
    void_invoice,
)
from .service import compute_forecast, compute_summary
from .emailer import send_invoice_email, send_invoice_notification_email


router = APIRouter(prefix="", tags=["Finance"])


_STORE = ResponseStore(base_dir=str(Path(__file__).resolve().parents[3] / "data"))


def _store() -> ResponseStore:
    return _STORE


@router.get("/invoices", response_model=InvoiceListResponse)
async def invoices_list(
    limit: int = 200,
    user: Dict[str, Any] = Depends(get_current_user),
):
    items = list_invoices_for_user(user=user, limit=limit)
    return InvoiceListResponse(invoices=items, total=len(items))


@router.get("/payer/invoices", response_model=InvoiceListResponse)
async def payer_invoices_list(
    limit: int = 200,
    status: Optional[str] = None,
    date_from: Optional[float] = None,
    date_to: Optional[float] = None,
    overdue_only: bool = False,
    user: Dict[str, Any] = Depends(get_current_user),
):
    role = str(user.get("role") or "").strip().lower()
    if role not in {"shipper", "broker", "admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Only payers can list payer invoices")
    try:
        items = list_invoices_for_payer(
            user=user,
            limit=limit,
            status=status,
            date_from=date_from,
            date_to=date_to,
            overdue_only=overdue_only,
        )
        return InvoiceListResponse(invoices=items, total=len(items))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payer/invoices/{invoice_id}", response_model=InvoiceRecord)
async def payer_invoices_get(invoice_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    inv = get_invoice(invoice_id=invoice_id)
    uid = str(user.get("uid") or "")
    role = str(user.get("role") or "").strip().lower()
    if role not in {"shipper", "broker", "admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Only payers can view payer invoices")
    if role not in {"admin", "super_admin"} and uid != inv.payer_uid:
        raise HTTPException(status_code=403, detail="Not authorized")
    return inv


@router.post("/payer/invoices/{invoice_id}/dispute", response_model=InvoiceActionResponse)
async def payer_invoices_dispute(invoice_id: str, req: InvoiceDisputeRequest, user: Dict[str, Any] = Depends(get_current_user)):
    role = str(user.get("role") or "").strip().lower()
    if role not in {"shipper", "broker", "admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Only payers can dispute invoices")
    try:
        inv = dispute_invoice(invoice_id=invoice_id, user=user, reason=req.reason, message=req.message)
        return InvoiceActionResponse(invoice_id=inv.invoice_id, status=inv.status, message="Invoice disputed")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invoices/{invoice_id}", response_model=InvoiceRecord)
async def invoices_get(invoice_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    inv = get_invoice(invoice_id=invoice_id)
    uid = user["uid"]
    role = str(user.get("role") or "")
    if role not in {"admin", "super_admin"} and uid not in {inv.issuer_uid, inv.payer_uid}:
        raise HTTPException(status_code=403, detail="Not authorized")
    return inv


@router.get("/invoices/{invoice_id}/pdf-context")
async def invoices_pdf_context(invoice_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        return get_invoice_pdf_context(invoice_id=invoice_id, user=user, store=_store())
    except ValueError as e:
        # reuse 403 for authorization failures
        if "Not authorized" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices", response_model=InvoiceRecord)
async def invoices_create(req: InvoiceCreateRequest, user: Dict[str, Any] = Depends(get_current_user)):
    role = str(user.get("role") or "")
    if str(role).strip().lower() != "carrier":
        raise HTTPException(status_code=403, detail="Only carriers can create invoices")

    try:
        return create_invoice(request=req, user=user, store=_store())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/finance/eligible-loads", response_model=EligibleLoadsResponse)
async def finance_eligible_loads(
    limit: int = 200,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        loads = list_eligible_loads(user=user, store=_store(), limit=limit)
        return EligibleLoadsResponse(loads=loads, total=len(loads))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/send", response_model=InvoiceActionResponse)
async def invoices_send(invoice_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        inv = send_invoice_with_store(invoice_id=invoice_id, user=user, store=_store())

        # Optional payer portal email notification (best-effort).
        # NOTE: PDF emailing is still handled by /invoices/{invoice_id}/email (client-generated PDF).
        try:
            if getattr(settings, "ENABLE_INVOICE_EMAILS", False):
                ctx = get_invoice_pdf_context(invoice_id=invoice_id, user=user, store=_store())
                payer_email = str(((ctx.get("shipper") or {}) if isinstance(ctx.get("shipper"), dict) else {}).get("email") or "").strip()
                if payer_email:
                    link = f"{getattr(settings, 'FRONTEND_BASE_URL', '').rstrip('/')}/shipper-dashboard?nav=bills&invoice_id={invoice_id}"
                    subj = f"New invoice received: {inv.invoice_number}"
                    body = (
                        f"A new invoice has been sent in FreightPower.\n\n"
                        f"Invoice: {inv.invoice_number}\n"
                        f"Amount: {inv.amount_total} {inv.currency}\n"
                        f"Due: {inv.due_date or '—'}\n\n"
                        f"View in portal: {link}\n"
                    )
                    send_invoice_notification_email(to_email=payer_email, subject=subj, body=body)
        except Exception:
            # Never fail the send action due to notification issues.
            pass

        return InvoiceActionResponse(invoice_id=inv.invoice_id, status=inv.status, message="Invoice sent")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/dispute", response_model=InvoiceActionResponse)
async def invoices_dispute(invoice_id: str, req: InvoiceDisputeRequest, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        inv = dispute_invoice(invoice_id=invoice_id, user=user, reason=req.reason, message=req.message)
        return InvoiceActionResponse(invoice_id=inv.invoice_id, status=inv.status, message="Invoice disputed")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/dispute/resolve", response_model=InvoiceActionResponse)
async def invoices_dispute_resolve(invoice_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        inv = resolve_dispute(invoice_id=invoice_id, user=user)
        return InvoiceActionResponse(invoice_id=inv.invoice_id, status=inv.status, message="Dispute resolved")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invoices/{invoice_id}/package.zip")
async def invoices_package_zip(invoice_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        payload, filename = build_invoice_package_zip(invoice_id=invoice_id, user=user, store=_store())
    except ValueError as e:
        # authorization failures are returned as 403 in pdf-context; keep consistent-ish.
        if "Not authorized" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

    return StreamingResponse(
        iter([payload]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/invoices/{invoice_id}/issue", response_model=InvoiceActionResponse)
async def invoices_issue(invoice_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        inv = issue_invoice(invoice_id=invoice_id, user=user, store=_store())
        return InvoiceActionResponse(invoice_id=inv.invoice_id, status=inv.status, message="Invoice issued")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/void", response_model=InvoiceActionResponse)
async def invoices_void(invoice_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    try:
        inv = void_invoice(invoice_id=invoice_id, user=user)
        return InvoiceActionResponse(invoice_id=inv.invoice_id, status=inv.status, message="Invoice voided")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/submit-factoring")
async def invoices_submit_factoring(
    invoice_id: str,
    req: FactoringSubmitRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        inv, submission = submit_to_factoring(invoice_id=invoice_id, user=user, provider_name=req.provider)
        return {"invoice": inv.model_dump(mode="json"), "submission": submission.model_dump(mode="json")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/payments")
async def invoices_record_payment(
    invoice_id: str,
    req: PaymentCreateRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        inv, payment = record_payment(invoice_id=invoice_id, request=req, user=user)
        return {"invoice": inv.model_dump(mode="json"), "payment": payment.model_dump(mode="json")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invoices/{invoice_id}/email")
async def invoices_email(
    invoice_id: str,
    req: InvoiceEmailRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    inv = get_invoice(invoice_id=invoice_id)
    uid = user["uid"]
    role = str(user.get("role") or "").strip().lower()

    # For now: only issuer can email the invoice.
    if role not in {"admin", "super_admin"} and inv.issuer_uid != uid:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        send_invoice_email(
            to_email=req.to,
            subject=req.subject,
            body=req.body,
            pdf_base64=req.pdf_base64,
            filename=req.filename or (inv.invoice_number or inv.invoice_id or "invoice") + ".pdf",
        )
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/factoring/webhooks/{provider}")
async def factoring_webhook(
    provider: str,
    req: FactoringWebhookRequest,
    webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
):
    if settings.FINANCE_WEBHOOK_SECRET:
        if (webhook_secret or "") != settings.FINANCE_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")
    try:
        event = process_webhook_event(provider=provider, req=req.model_dump(mode="json"))
        return {"ok": True, "event": event.model_dump(mode="json")}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/finance/summary", response_model=FinanceSummaryResponse)
async def finance_summary(user: Dict[str, Any] = Depends(get_current_user)):
    invoices = list_invoices_for_user(user=user, limit=500)
    role_scope = str(user.get("role") or "")
    return compute_summary(invoices=invoices, role_scope=role_scope)


@router.get("/finance/forecast", response_model=FinanceForecastResponse)
async def finance_forecast(range_days: int = 30, user: Dict[str, Any] = Depends(get_current_user)):
    invoices = list_invoices_for_user(user=user, limit=500)
    role_scope = str(user.get("role") or "")
    return compute_forecast(invoices=invoices, role_scope=role_scope, range_days=range_days)


@router.post("/finance/overdue/run")
async def finance_run_overdue(user: Dict[str, Any] = Depends(require_admin)):
    updated = mark_overdue_invoices(max_docs=500)
    return {"ok": True, "updated": updated}
