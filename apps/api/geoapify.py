"""
Geoapify Places API Integration
"""
import requests
from typing import Dict, Any, List, Optional
from .settings import settings


class GeoapifyClient:
    """Client for Geoapify Places API"""
    
    BASE_URL = "https://api.geoapify.com/v2/places"
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize Geoapify client"""
        self.api_key = api_key or settings.GEOAPIFY_API_KEY
        if not self.api_key:
            print("⚠️ GEOAPIFY_API_KEY not configured")
    
    def search_nearby_places(
        self,
        latitude: float,
        longitude: float,
        radius: int = 5000,
        categories: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search for nearby places using Geoapify Places API.
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            radius: Search radius in meters (default 5000 = 5km)
            categories: List of category IDs
            limit: Maximum number of results
            
        Returns:
            List of place dictionaries with name, address, coordinates, contact info
        """
        try:
            # Map common categories to Geoapify format
            # Geoapify uses broader categories - check their documentation
            category_mapping = {
                "fuel-station": "service.vehicle.fuel",
                "petrol-station": "service.vehicle.fuel",
                "parking-facility": "parking",
                "parking-garage": "parking",
                "repair-facility": "service.vehicle.repair",
                "vehicle-repair": "service.vehicle.repair",
                "legal-services": "service.professional",
                "attorney": "service.professional",
                "education-facility": "education",
                "training-center": "education",
                "electronics-store": "commercial.electronics",
                "technology": "commercial.electronics"
            }
            
            # Convert categories if needed
            if categories:
                geoapify_categories = []
                for cat in categories:
                    mapped = category_mapping.get(cat, cat)
                    if mapped not in geoapify_categories:
                        geoapify_categories.append(mapped)
                categories_str = ",".join(geoapify_categories)
            else:
                # Default to fuel, parking, repair
                categories_str = "service.vehicle.fuel,parking,service.vehicle.repair"
            
            # Geoapify uses bias parameter with circle for location-based search
            params = {
                "categories": categories_str,
                "bias": f"proximity:{longitude},{latitude}",
                "limit": limit,
                "apiKey": self.api_key
            }
            
            # Add radius filter if within reasonable bounds (Geoapify max is 50km = 50000m)
            if radius and radius <= 50000:
                params["filter"] = f"circle:{longitude},{latitude},{radius}"
            
            headers = {
                "Accept": "application/json"
            }
            
            response = requests.get(self.BASE_URL, params=params, headers=headers, timeout=10)
            
            if response.status_code == 401:
                print(f"❌ Geoapify API returned 401 Unauthorized - check API key")
                return []
            
            if response.status_code == 403:
                print(f"❌ Geoapify API returned 403 Forbidden - check API key permissions")
                return []
            
            response.raise_for_status()
            data = response.json()
            
            places = []
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                coords = feature.get("geometry", {}).get("coordinates", [])
                
                # Geoapify returns [longitude, latitude]
                place_lng = coords[0] if len(coords) > 0 else None
                place_lat = coords[1] if len(coords) > 1 else None
                
                # Extract place info
                place = {
                    "id": props.get("place_id", ""),
                    "name": props.get("name") or props.get("address_line1", "Unknown Place"),
                    "address": props.get("formatted", ""),
                    "latitude": place_lat,
                    "longitude": place_lng,
                    "distance": props.get("distance", 0),
                    "categories": props.get("categories", []),
                }
                
                # Extract contact info
                if "datasource" in props:
                    raw_data = props["datasource"].get("raw", {})
                    if "phone" in raw_data:
                        place["phone"] = raw_data["phone"]
                    if "website" in raw_data:
                        place["website"] = raw_data["website"]
                    if "email" in raw_data:
                        place["email"] = raw_data["email"]
                
                # Add contact from top-level properties
                if "contact" in props:
                    contact = props["contact"]
                    if "phone" in contact:
                        place["phone"] = contact["phone"]
                    if "website" in contact:
                        place["website"] = contact["website"]
                    if "email" in contact:
                        place["email"] = contact["email"]
                
                places.append(place)
            
            print(f"✅ Found {len(places)} places from Geoapify API")
            return places
            
        except requests.exceptions.Timeout:
            print(f"⚠️ Geoapify API timeout")
            return []
        except requests.exceptions.RequestException as e:
            print(f"❌ Geoapify API error: {e}")
            return []
        except Exception as e:
            print(f"❌ Unexpected error in Geoapify search_nearby_places: {e}")
            return []


# Global client instance
_geoapify_client: Optional[GeoapifyClient] = None


def get_geoapify_client() -> GeoapifyClient:
    """Get or create Geoapify client instance."""
    global _geoapify_client
    if _geoapify_client is None:
        _geoapify_client = GeoapifyClient()
    return _geoapify_client
