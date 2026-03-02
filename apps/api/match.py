from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, List, Tuple


LANE_WEIGHT = 5.0
EQUIPMENT_WEIGHT = 3.0
COMPLIANCE_WEIGHT = 2.0
FMCSSA_WEIGHT = 5.0


@dataclass
class MatchResult:
    carrier_id: str
    score: float
    reasons: List[str]
    carrier: Dict[str, Any]


def _normalize(s: Any) -> str:
    return str(s or "").strip().lower()


def _lane_score(load: Dict[str, Any], carrier: Dict[str, Any], reasons: List[str]) -> float:
    load_origin = _normalize(load.get("origin_state") or load.get("origin"))
    load_dest = _normalize(load.get("destination_state") or load.get("destination"))
    carrier_lanes = carrier.get("lanes") or []
    for lane in carrier_lanes:
        lane_o = _normalize(lane.get("origin") or lane.get("origin_state"))
        lane_d = _normalize(lane.get("destination") or lane.get("destination_state"))
        if lane_o == load_origin and lane_d == load_dest:
            reasons.append(f"Lane match {lane_o}->{lane_d}")
            return LANE_WEIGHT
    if load_origin and load_dest and not carrier_lanes:
        reasons.append("Carrier has no lanes listed")
    if carrier_lanes and (load_origin or load_dest):
        reasons.append("No lane match")
    return 0.0


def _equipment_score(load: Dict[str, Any], carrier: Dict[str, Any], reasons: List[str]) -> float:
    load_equip = _normalize(load.get("equipment"))
    carrier_equipment = carrier.get("equipment") or carrier.get("equipment_types") or []
    if isinstance(carrier_equipment, str):
        carrier_equipment = [carrier_equipment]
    carrier_norm = {_normalize(e) for e in carrier_equipment}
    if load_equip and load_equip in carrier_norm:
        reasons.append(f"Equipment match: {load_equip}")
        return EQUIPMENT_WEIGHT
    if load_equip:
        reasons.append(f"No equipment match for {load_equip}")
    return 0.0


def _compliance_score(carrier: Dict[str, Any], reasons: List[str]) -> float:
    compliance = carrier.get("compliance_score")
    if compliance is None:
        return 0.0
    score = min(max(float(compliance), 0.0), 100.0) / 100.0 * COMPLIANCE_WEIGHT
    reasons.append(f"Compliance score applied: {compliance}")
    return score


def _fmcsa_score(carrier: Dict[str, Any], reasons: List[str]) -> Tuple[float, bool]:
    verification = carrier.get("fmcsa_verification") or {}
    result = _normalize(verification.get("result"))
    if result == "blocked":
        reasons.append("FMCSA blocked")
        return 0.0, True
    if result == "warning":
        reasons.append("FMCSA warning")
        return FMCSSA_WEIGHT * 0.5, False
    if result == "verified":
        reasons.append("FMCSA verified")
        return FMCSSA_WEIGHT, False
    if verification:
        reasons.append("FMCSA status unknown")
    return 0.0, False


def score_match(load: Dict[str, Any], carrier: Dict[str, Any]) -> MatchResult | None:
    reasons: List[str] = []
    lane = _lane_score(load, carrier, reasons)
    equip = _equipment_score(load, carrier, reasons)
    comp = _compliance_score(carrier, reasons)
    fmcsa, blocked = _fmcsa_score(carrier, reasons)

    if blocked:
        return None

    total = lane + equip + comp + fmcsa
    if total == 0:
        reasons.append("No strong signals matched")
    carrier_id = carrier.get("id") or carrier.get("carrier_id") or carrier.get("name") or "unknown"
    return MatchResult(carrier_id=str(carrier_id), score=round(total, 3), reasons=reasons, carrier=carrier)


def match_load(load: Dict[str, Any], carriers: List[Dict[str, Any]], top_n: int = 5, min_compliance: float | None = None, require_fmcsa: bool = False) -> List[MatchResult]:
    matches: List[MatchResult] = []
    for carrier in carriers:
        if min_compliance is not None:
            compliance = carrier.get("compliance_score")
            if compliance is None or float(compliance) < min_compliance:
                continue
        if require_fmcsa and not carrier.get("fmcsa_verification"):
            continue
        res = score_match(load, carrier)
        if res:
            matches.append(res)
    matches.sort(key=lambda m: m.score, reverse=True)
    return matches[:top_n]
