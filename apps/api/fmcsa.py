from __future__ import annotations

import json
import logging
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional, Tuple

import httpx

from .settings import settings
from .utils import utcnow

logger = logging.getLogger(__name__)


@dataclass
class FmcsaProfile:
    usdot: str
    mc_number: str | None
    legal_name: str | None
    dba_name: str | None
    address: str | None
    safety_rating: str | None
    safety_date: str | None
    insurance_status: str | None
    operating_authority: str | None
    authority_status: str | None
    latest_update: str
    raw: Dict[str, Any]


class FmcsaClient:
    def __init__(self, base_url: str | None = None, api_key: str | None = None, web_key: str | None = None):
        self.base_url = (base_url or settings.FMCSA_BASE_URL).rstrip("/")
        self.api_key = api_key or settings.FMCSA_API_KEY
        self.web_key = web_key or settings.FMCSA_WEB_KEY
        if not self.base_url:
            raise RuntimeError("FMCSA_BASE_URL not configured")
        if not self.web_key:
            raise RuntimeError("FMCSA_WEB_KEY is required")

    def _headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {"Accept": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

    def _request(self, path: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}{path}"
        params = {"webKey": self.web_key}
        try:
            resp = httpx.get(url, params=params, headers=self._headers(), timeout=20.0)
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, str):
                return {"raw": data}
            return data
        except Exception as exc:
            logger.warning("FMCSA request failed %s: %s", path, exc)
            return None

    def get_carrier(self, usdot: str) -> Optional[Dict[str, Any]]:
        return self._request(f"/carriers/{usdot}")

    def get_basics(self, usdot: str) -> Optional[Dict[str, Any]]:
        return self._request(f"/carriers/{usdot}/basics")

    def get_authority(self, usdot: str) -> Optional[Dict[str, Any]]:
        return self._request(f"/carriers/{usdot}/authority")

    def get_oos(self, usdot: str) -> Optional[Dict[str, Any]]:
        return self._request(f"/carriers/{usdot}/oos")

    def get_docket(self, mc_number: str) -> Optional[Dict[str, Any]]:
        return self._request(f"/carriers/docket-number/{mc_number}")

    def fetch_profile(self, usdot: str) -> Optional[FmcsaProfile]:
        data = self.get_carrier(usdot)
        if not data:
            return None
        mc_number = data.get("mc_number") or data.get("docket_number") or data.get("mc")
        profile = FmcsaProfile(
            usdot=str(usdot),
            mc_number=str(mc_number) if mc_number else None,
            legal_name=data.get("legal_name"),
            dba_name=data.get("dba_name"),
            address=self._format_address(data),
            safety_rating=None,
            safety_date=None,
            insurance_status=None,
            operating_authority=None,
            authority_status=None,
            latest_update=utcnow().isoformat(),
            raw=data,
        )
        return profile

    def verify(self, usdot: Optional[str] = None, mc_number: Optional[str] = None) -> Dict[str, Any]:
        if not usdot and not mc_number:
            raise ValueError("Provide USDOT or MC number")

        fetched_sections: Dict[str, Any] = {}
        resolved_usdot = usdot
        resolved_mc = mc_number
        if not resolved_usdot and mc_number:
            docket = self.get_docket(mc_number)
            fetched_sections["docket"] = docket
            resolved_usdot = docket.get("usdotNumber") if docket else None

        if not resolved_usdot:
            raise ValueError("Unable to resolve USDOT for verification")

        carrier = self.get_carrier(resolved_usdot)
        basics = self.get_basics(resolved_usdot)
        authority = self.get_authority(resolved_usdot)
        oos = self.get_oos(resolved_usdot)

        fetched_sections.update({
            "carrier": carrier,
            "basics": basics,
            "authority": authority,
            "oos": oos,
        })

        result, reasons = self._evaluate(authority, oos, basics)
        verification = {
            "usdot": resolved_usdot,
            "mc_number": resolved_mc or (carrier or {}).get("mc_number"),
            "result": result,
            "reasons": reasons,
            "fetched_at": utcnow().isoformat(),
            "sections": fetched_sections,
        }
        return verification

    def _evaluate(self, authority: Optional[Dict[str, Any]], oos: Optional[Dict[str, Any]], basics: Optional[Dict[str, Any]]) -> Tuple[str, List[str]]:
        reasons: List[str] = []
        blocked = False
        warning = False

        oos_flag = (oos or {}).get("oosIndicator") or (oos or {}).get("status")
        if isinstance(oos_flag, str) and oos_flag.strip().lower() in {"y", "yes", "true"}:
            blocked = True
            reasons.append("Out-of-service flag reported by FMCSA")

        authority_status = (authority or {}).get("status") or (authority or {}).get("commonAuthorityStatus")
        if authority_status:
            normalized = str(authority_status).lower()
            if normalized in {"inactive", "revoked", "denied"}:
                blocked = True
                reasons.append(f"Operating authority status: {authority_status}")
            elif normalized not in {"active", "authorized"}:
                warning = True
                reasons.append(f"Operating authority requires review: {authority_status}")

        basics_flags = []
        if basics and isinstance(basics, dict):
            for key, value in basics.items():
                if "Deficient" in key and value is True:
                    basics_flags.append(key)
        if basics_flags:
            warning = True
            reasons.append(f"BASIC deficiency flags: {', '.join(basics_flags)}")

        if blocked:
            return "Blocked", reasons
        if warning:
            return "Warning", reasons
        return "Verified", reasons

    @staticmethod
    def _format_address(data: Dict[str, Any]) -> Optional[str]:
        parts = [
            data.get("phyStreet"),
            data.get("phyCity"),
            data.get("phyState"),
            data.get("phyZipcode")
        ]
        if any(parts):
            filtered = [p for p in parts if p]
            return ", ".join(filtered)
        return None


def profile_to_dict(profile: FmcsaProfile | None) -> Dict[str, Any]:
    if not profile:
        return {}
    data = asdict(profile)
    data["raw"] = profile.raw
    return data
