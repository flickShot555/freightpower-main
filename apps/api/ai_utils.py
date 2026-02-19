# File: apps/api/ai_utils.py
"""
AI utilities for freight calculations using GROQ API.
"""
import json
import re
from typing import Dict, Any, Optional
from groq import Groq
from .settings import settings


def _client() -> Groq:
    """Get GROQ client instance."""
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set")
    return Groq(api_key=settings.GROQ_API_KEY)


def _parse_json(text: str) -> Dict[str, Any]:
    """Parse JSON from AI response, handling markdown code blocks."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
        cleaned = cleaned.strip()
    
    # Extract JSON object
    match = re.search(r"\{[\s\S]*\}", cleaned)
    raw = match.group(0) if match else cleaned
    return json.loads(raw)


def calculate_freight_distance(origin: str, destination: str, truck_type: str = "dry van") -> Dict[str, Any]:
    """
    Calculate distance and estimated transit time between two locations for freight trucks.
    
    Args:
        origin: Starting location (e.g., "Chicago, IL" or "60601")
        destination: Ending location (e.g., "Atlanta, GA" or "30301")
        truck_type: Type of truck (dry van, reefer, flatbed, stepdeck, poweronly)
    
    Returns:
        Dict with keys: distance_miles, estimated_hours, estimated_days, confidence, notes
    """
    client = _client()
    
    prompt = f"""You are a freight routing assistant for US trucking logistics.

Task:
Calculate the truck-legal road distance between the given pickup and delivery locations in the United States.

Inputs:
- Pickup location: {origin}
- Delivery location: {destination}
- Truck type: {truck_type}
  (one of: dry van, reefer, flatbed, stepdeck, poweronly)

Routing rules:
- Use truck-legal roads only
- Prefer major interstate highways
- Avoid non-truck routes, restricted roads, and passenger-only roads
- Assume standard long-haul routing (no local shortcuts)
- Do not assume oversize permits unless explicitly stated

Vehicle assumptions:
- Standard US commercial vehicle for the given truck type
- Average driving speed: 50–55 mph
- Ignore traffic, weather, toll cost, and construction
- Driving time only (no mandatory rest breaks)

Output requirements:
Return the result strictly in valid JSON with the following fields:
- distance_miles (number)
- estimated_hours (number, driving time)
- estimated_days (integer, freight convention)
- confidence (number between 0 and 1 reflecting routing certainty)
- notes (explicit highway sequence, e.g., "I-10 → I-5 → US-101")

Constraints:
- The highway sequence must be complete and technically correct
- Distance and route must align
- Confidence must be realistic (do not exceed 0.95 unless trivial route)

Do not include explanations or extra text outside the JSON response."""

    messages = [
        {
            "role": "system",
            "content": "You are a freight logistics expert. Calculate accurate truck route distances and transit times. Respond ONLY with valid JSON."
        },
        {
            "role": "user",
            "content": prompt
        }
    ]
    
    try:
        response = client.chat.completions.create(
            model=settings.GROQ_TEXT_MODEL,
            messages=messages,
            temperature=0.1,  # Low temperature for consistency
            max_tokens=512,
        )
        
        text = response.choices[0].message.content or ""
        print(f"🤖 AI DISTANCE CALC OUTPUT: {text}")
        
        result = _parse_json(text)
        
        # Validate required fields
        required_fields = ["distance_miles", "estimated_hours", "estimated_days"]
        for field in required_fields:
            if field not in result:
                result[field] = 0
        
        # Ensure confidence is set
        if "confidence" not in result:
            result["confidence"] = 0.8
        
        return result
        
    except Exception as e:
        print(f"❌ DISTANCE CALCULATION FAILED: {e}")
        return {
            "distance_miles": 0,
            "estimated_hours": 0,
            "estimated_days": 0,
            "confidence": 0.0,
            "notes": f"Calculation failed: {str(e)}",
            "error": str(e)
        }


def calculate_load_cost(distance_miles: float, rate_per_mile: float, additional_charges: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """
    Calculate total load cost based on distance and rates.
    
    Args:
        distance_miles: Distance in miles
        rate_per_mile: Rate per mile (e.g., 2.50)
        additional_charges: Dict of additional charges (e.g., {"fuel_surcharge": 150, "detention": 100})
    
    Returns:
        Dict with cost breakdown
    """
    linehaul = distance_miles * rate_per_mile
    
    charges = additional_charges or {}
    additional_total = sum(charges.values())
    
    total = linehaul + additional_total
    
    return {
        "distance_miles": distance_miles,
        "rate_per_mile": rate_per_mile,
        "linehaul": round(linehaul, 2),
        "additional_charges": charges,
        "additional_total": round(additional_total, 2),
        "total_cost": round(total, 2)
    }


def estimate_pickup_delivery_window(origin: str, destination: str, pickup_date: str) -> Dict[str, Any]:
    """
    Estimate delivery date based on pickup date and route.
    
    Args:
        origin: Starting location
        destination: Ending location
        pickup_date: Pickup date in ISO format (YYYY-MM-DD)
    
    Returns:
        Dict with delivery estimates
    """
    # First calculate distance and transit time
    distance_data = calculate_freight_distance(origin, destination)
    
    if distance_data.get("error"):
        return {
            "pickup_date": pickup_date,
            "estimated_delivery_date": None,
            "transit_days": 0,
            "error": distance_data["error"]
        }
    
    transit_days = distance_data.get("estimated_days", 1)
    
    # Parse pickup date and add transit days
    from datetime import datetime, timedelta
    try:
        pickup_dt = datetime.fromisoformat(pickup_date)
        delivery_dt = pickup_dt + timedelta(days=transit_days)
        
        return {
            "pickup_date": pickup_date,
            "estimated_delivery_date": delivery_dt.isoformat().split('T')[0],
            "transit_days": transit_days,
            "transit_hours": distance_data.get("estimated_hours", 0),
            "distance_miles": distance_data.get("distance_miles", 0),
            "confidence": distance_data.get("confidence", 0.8)
        }
    except Exception as e:
        return {
            "pickup_date": pickup_date,
            "estimated_delivery_date": None,
            "transit_days": transit_days,
            "error": str(e)
        }
