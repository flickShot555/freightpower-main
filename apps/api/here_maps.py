"""
HERE Maps API integration for geocoding, routing, distance calculation, and map snapshots.
"""
import requests
from typing import Dict, Any, List, Optional, Tuple
from .settings import settings


class HereMapsClient:
    """Client for HERE Maps REST API services."""
    
    BASE_URL = "https://router.hereapi.com/v8"
    GEOCODE_URL = "https://geocode.search.hereapi.com/v1/geocode"
    ROUTING_URL = "https://router.hereapi.com/v8/routes"
    MATRIX_URL = "https://matrix.router.hereapi.com/v8/matrix"
    SNAPSHOT_URL = "https://image.maps.ls.hereapi.com/mia/1.6/mapview"
    DISCOVER_URL = "https://discover.search.hereapi.com/v1/discover"
    BROWSE_URL = "https://browse.search.hereapi.com/v1/browse"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.HERE_API_KEY_BACKEND
        if not self.api_key:
            raise ValueError("HERE API key is required")
    
    def geocode(self, address: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Geocode an address to get latitude/longitude coordinates.
        
        Args:
            address: Address string (e.g., "Chicago, IL" or "1600 Amphitheatre Parkway, Mountain View, CA")
            limit: Maximum number of results to return
            
        Returns:
            List of geocoding results with lat, lng, label, etc.
        """
        try:
            params = {
                "q": address,
                "apiKey": self.api_key,
                "limit": limit
            }
            response = requests.get(self.GEOCODE_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("items", []):
                position = item.get("position", {})
                results.append({
                    "lat": position.get("lat"),
                    "lng": position.get("lng"),
                    "label": item.get("title", address),
                    "address": item.get("address", {}),
                    "relevance": item.get("scoring", {}).get("relevance", 0)
                })
            return results
        except Exception as e:
            print(f"Error geocoding address '{address}': {e}")
            return []
    
    def reverse_geocode(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """
        Reverse geocode coordinates to get address.
        
        Args:
            lat: Latitude
            lng: Longitude
            
        Returns:
            Address information or None
        """
        try:
            params = {
                "at": f"{lat},{lng}",
                "apiKey": self.api_key,
                "limit": 1
            }
            response = requests.get(self.GEOCODE_URL, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("items"):
                item = data["items"][0]
                return {
                    "lat": lat,
                    "lng": lng,
                    "label": item.get("title", ""),
                    "address": item.get("address", {})
                }
            return None
        except Exception as e:
            print(f"Error reverse geocoding ({lat}, {lng}): {e}")
            return None
    
    def calculate_route(
        self,
        origin: str,
        destination: str,
        waypoints: Optional[List[str]] = None,
        transport_mode: str = "truck",
        truck_type: Optional[str] = None,
        height: Optional[float] = None,
        width: Optional[float] = None,
        length: Optional[float] = None,
        weight: Optional[float] = None,
        hazmat: bool = False,
        return_polyline: bool = True
    ) -> Dict[str, Any]:
        """
        Calculate route between origin and destination with truck-specific parameters.
        
        Args:
            origin: Origin address or "lat,lng"
            destination: Destination address or "lat,lng"
            waypoints: Optional list of waypoint addresses
            transport_mode: "truck", "car", etc.
            truck_type: Truck type hint.
                NOTE: The frontend currently sends equipment-style values (e.g. "dryVan", "reefer", "flatbed").
                Those are not valid HERE Routing v8 truckType values, so they are ignored unless they match
                a supported HERE value.
            height: Truck height in meters
            width: Truck width in meters
            length: Truck length in meters
            weight: Truck weight in tons
            hazmat: Whether truck carries hazardous materials
            return_polyline: Whether to return route polyline
            
        Returns:
            Dict with distance, duration, polyline, and route information
        """
        try:
            # Geocode origin and destination if they're addresses
            origin_coords = self._parse_coordinates(origin)
            if not origin_coords:
                geocode_result = self.geocode(origin, limit=1)
                if not geocode_result:
                    raise ValueError(f"Could not geocode origin: {origin}")
                origin_coords = f"{geocode_result[0]['lat']},{geocode_result[0]['lng']}"
            
            dest_coords = self._parse_coordinates(destination)
            if not dest_coords:
                geocode_result = self.geocode(destination, limit=1)
                if not geocode_result:
                    raise ValueError(f"Could not geocode destination: {destination}")
                dest_coords = f"{geocode_result[0]['lat']},{geocode_result[0]['lng']}"
            
            # Build waypoints
            waypoint_coords = []
            if waypoints:
                for waypoint in waypoints:
                    wp_coords = self._parse_coordinates(waypoint)
                    if not wp_coords:
                        geocode_result = self.geocode(waypoint, limit=1)
                        if geocode_result:
                            wp_coords = f"{geocode_result[0]['lat']},{geocode_result[0]['lng']}"
                    if wp_coords:
                        waypoint_coords.append(wp_coords)
            
            # HERE Routing v8 is most reliable via GET query parameters.
            # Using JSON POST bodies can lead to 400 Bad Request depending on the schema.
            params: List[Tuple[str, str]] = [
                ("apiKey", self.api_key),
                ("origin", origin_coords),
                ("destination", dest_coords),
                ("transportMode", transport_mode),
                ("return", "polyline,summary,actions,instructions" if return_polyline else "summary"),
            ]

            # Add intermediate via points (repeatable param)
            for wp in waypoint_coords:
                params.append(("via", wp))

            # Truck-specific parameters (query param form)
            if transport_mode == "truck":
                normalized_truck_type = self._normalize_here_truck_type(truck_type)
                if normalized_truck_type:
                    params.append(("truck[truckType]", normalized_truck_type))
                if height is not None:
                    params.append(("truck[height]", str(height)))
                if width is not None:
                    params.append(("truck[width]", str(width)))
                if length is not None:
                    params.append(("truck[length]", str(length)))
                if weight is not None:
                    # Keep existing convention: weight is provided in tons; HERE expects kg.
                    params.append(("truck[weight]", str(weight * 1000)))
                if hazmat:
                    params.append(("truck[shippedHazardousGoods]", "explosive"))

            response = requests.get(self.ROUTING_URL, params=params, timeout=30)
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError as e:
                # Surface HERE's response body for easier debugging
                print(f"HERE routing error status={response.status_code}: {response.text}")
                raise e

            data = response.json()
            
            if not data.get("routes"):
                return {
                    "distance_miles": 0,
                    "distance_meters": 0,
                    "duration_seconds": 0,
                    "duration_hours": 0,
                    "polyline": None,
                    "error": "No route found"
                }
            
            route = data["routes"][0]
            section = route["sections"][0]
            summary = section.get("summary", {})
            
            distance_meters = summary.get("length", 0)
            distance_miles = distance_meters / 1609.34  # Convert to miles
            duration_seconds = summary.get("duration", 0)
            duration_hours = duration_seconds / 3600
            
            result = {
                "distance_miles": round(distance_miles, 2),
                "distance_meters": distance_meters,
                "duration_seconds": duration_seconds,
                "duration_hours": round(duration_hours, 2),
                "estimated_days": max(1, int(round(duration_hours / 24))),
                "polyline": section.get("polyline") if return_polyline else None,
                "waypoints": waypoint_coords,
                "origin": origin_coords,
                "destination": dest_coords
            }
            
            return result
            
        except Exception as e:
            print(f"Error calculating route: {e}")
            return {
                "distance_miles": 0,
                "distance_meters": 0,
                "duration_seconds": 0,
                "duration_hours": 0,
                "estimated_days": 0,
                "polyline": None,
                "error": str(e)
            }

    @staticmethod
    def _normalize_here_truck_type(truck_type: Optional[str]) -> Optional[str]:
        """Normalize truck type to HERE Routing v8 supported values.

        The product uses equipment strings like "dryVan"/"reefer"/"flatbed" in multiple places.
        Those are not vehicle truckType values for HERE routing; sending them can trigger 400s.
        """
        if not truck_type:
            return None

        raw = str(truck_type).strip()
        if not raw:
            return None

        # Known HERE Routing v8 values (keep list tight; unknown values are ignored)
        allowed = {"straightTruck", "tractorTruck"}
        if raw in allowed:
            return raw

        key = raw.lower().replace("-", "").replace("_", "").replace(" ", "")
        aliases = {
            "straight": "straightTruck",
            "straighttruck": "straightTruck",
            "boxtruck": "straightTruck",
            "tractor": "tractorTruck",
            "tractortrailer": "tractorTruck",
            "tractortruck": "tractorTruck",
            "semi": "tractorTruck",
        }
        return aliases.get(key)
    
    def calculate_distance(
        self,
        origin: str,
        destination: str,
        truck_type: Optional[str] = None,
        weight: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Calculate distance and transit time between two locations (simplified version for distance calculation).
        
        Args:
            origin: Origin address
            destination: Destination address
            truck_type: Type of truck (dryVan, reefer, flatbed, etc.)
            weight: Truck weight in tons
            
        Returns:
            Dict with distance_miles, estimated_hours, estimated_days, confidence, notes
        """
        route_result = self.calculate_route(
            origin=origin,
            destination=destination,
            transport_mode="truck",
            truck_type=truck_type,
            weight=weight,
            return_polyline=False
        )
        
        if route_result.get("error"):
            return {
                "distance_miles": 0,
                "estimated_hours": 0,
                "estimated_days": 0,
                "confidence": 0.0,
                "notes": route_result.get("error", "Route calculation failed")
            }
        
        # Calculate estimated hours (assuming average truck speed of 50 mph)
        distance_miles = route_result["distance_miles"]
        estimated_hours = route_result["duration_hours"]
        estimated_days = route_result["estimated_days"]
        
        # Confidence based on successful route calculation
        confidence = 0.95 if distance_miles > 0 else 0.0
        
        return {
            "distance_miles": distance_miles,
            "estimated_hours": round(estimated_hours, 2),
            "estimated_days": estimated_days,
            "confidence": confidence,
            "notes": f"Route calculated via HERE Maps API"
        }
    
    def calculate_matrix(
        self,
        origins: List[str],
        destinations: List[str],
        transport_mode: str = "truck"
    ) -> Dict[str, Any]:
        """
        Calculate distance matrix between multiple origins and destinations.
        
        Args:
            origins: List of origin addresses or coordinates
            destinations: List of destination addresses or coordinates
            transport_mode: "truck", "car", etc.
            
        Returns:
            Matrix with distances and durations
        """
        try:
            # Geocode all origins and destinations
            origin_coords = []
            for origin in origins:
                coords = self._parse_coordinates(origin)
                if not coords:
                    geocode_result = self.geocode(origin, limit=1)
                    if geocode_result:
                        coords = f"{geocode_result[0]['lat']},{geocode_result[0]['lng']}"
                if coords:
                    lat, lng = coords.split(",")
                    origin_coords.append({"lat": float(lat), "lng": float(lng)})
            
            dest_coords = []
            for dest in destinations:
                coords = self._parse_coordinates(dest)
                if not coords:
                    geocode_result = self.geocode(dest, limit=1)
                    if geocode_result:
                        coords = f"{geocode_result[0]['lat']},{geocode_result[0]['lng']}"
                if coords:
                    lat, lng = coords.split(",")
                    dest_coords.append({"lat": float(lat), "lng": float(lng)})
            
            if not origin_coords or not dest_coords:
                return {"error": "Could not geocode all origins/destinations"}
            
            # Build matrix request
            matrix_params = {
                "origins": origin_coords,
                "destinations": dest_coords,
                "regionDefinition": {
                    "type": "world"
                }
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                self.MATRIX_URL,
                json=matrix_params,
                headers=headers,
                params={"apiKey": self.api_key, "transportMode": transport_mode},
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            return {
                "matrix": data.get("matrix", []),
                "origins": origin_coords,
                "destinations": dest_coords
            }
            
        except Exception as e:
            print(f"Error calculating matrix: {e}")
            return {"error": str(e)}
    
    def generate_snapshot(
        self,
        center: Tuple[float, float],
        zoom: int = 12,
        width: int = 800,
        height: int = 600,
        markers: Optional[List[Dict[str, Any]]] = None,
        polyline: Optional[str] = None
    ) -> str:
        """
        Generate static map snapshot URL.
        
        Args:
            center: (lat, lng) tuple for map center
            zoom: Zoom level (1-20)
            width: Image width in pixels
            height: Image height in pixels
            markers: List of marker dicts with 'lat', 'lng', 'label'
            polyline: Encoded polyline string for route
            
        Returns:
            URL to static map image
        """
        try:
            lat, lng = center
            params = {
                "c": f"{lat},{lng}",
                "z": zoom,
                "w": width,
                "h": height,
                "apiKey": self.api_key
            }
            
            # Add markers
            if markers:
                marker_params = []
                for i, marker in enumerate(markers):
                    marker_lat = marker.get("lat")
                    marker_lng = marker.get("lng")
                    marker_label = marker.get("label", str(i + 1))
                    marker_params.append(f"{marker_lat},{marker_lng};{marker_label}")
                params["poi"] = "|".join(marker_params)
            
            # Add polyline if provided
            if polyline:
                params["l"] = polyline
            
            # Build URL
            url = f"{self.SNAPSHOT_URL}?" + "&".join([f"{k}={v}" for k, v in params.items()])
            return url
            
        except Exception as e:
            print(f"Error generating snapshot: {e}")
            return ""
    
    def _parse_coordinates(self, location: str) -> Optional[str]:
        """
        Check if location string is already in "lat,lng" format.
        
        Args:
            location: Location string
            
        Returns:
            "lat,lng" string if valid coordinates, None otherwise
        """
        try:
            parts = location.split(",")
            if len(parts) == 2:
                lat = float(parts[0].strip())
                lng = float(parts[1].strip())
                if -90 <= lat <= 90 and -180 <= lng <= 180:
                    return f"{lat},{lng}"
        except:
            pass
        return None
    
    def search_nearby_places(
        self,
        latitude: float,
        longitude: float,
        radius: int = 5000,
        categories: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search for nearby places using HERE Places API.
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            radius: Search radius in meters (default 5000 = 5km)
            categories: List of category IDs (fuel-station, parking, repair-facility, etc.)
            limit: Maximum number of results
            
        Returns:
            List of place dictionaries with name, address, coordinates, contact info
        """
        try:
            # Default categories if none provided
            if categories is None:
                categories = ["fuel-station", "parking-facility", "repair-facility"]
            
            params = {
                "at": f"{latitude},{longitude}",
                "limit": limit,
                "apiKey": self.api_key
            }
            
            # Add radius if specified
            if radius:
                params["in"] = f"circle:{latitude},{longitude};r={radius}"
            
            # Add categories
            if categories:
                params["q"] = ",".join(categories)
            
            response = requests.get(self.DISCOVER_URL, params=params, timeout=10)
            
            if response.status_code == 403:
                print(f"⚠️ HERE Maps API returned 403 Forbidden - check API key permissions")
                return []
            
            response.raise_for_status()
            data = response.json()
            
            places = []
            for item in data.get("items", []):
                place = {
                    "id": item.get("id", ""),
                    "name": item.get("title", "Unknown Place"),
                    "address": item.get("address", {}).get("label", ""),
                    "latitude": item.get("position", {}).get("lat"),
                    "longitude": item.get("position", {}).get("lng"),
                    "distance": item.get("distance", 0),
                    "categories": [cat.get("name", "") for cat in item.get("categories", [])],
                }
                
                # Extract contact info if available
                contacts = item.get("contacts", [{}])[0] if item.get("contacts") else {}
                if contacts:
                    if "phone" in contacts:
                        place["phone"] = contacts["phone"][0].get("value", "") if contacts["phone"] else ""
                    if "www" in contacts:
                        place["website"] = contacts["www"][0].get("value", "") if contacts["www"] else ""
                    if "email" in contacts:
                        place["email"] = contacts["email"][0].get("value", "") if contacts["email"] else ""
                
                places.append(place)
            
            print(f"✅ Found {len(places)} places from HERE Maps API")
            return places
            
        except requests.exceptions.Timeout:
            print(f"⚠️ HERE Maps API timeout")
            return []
        except requests.exceptions.RequestException as e:
            print(f"❌ HERE Maps API error: {e}")
            return []
        except Exception as e:
            print(f"❌ Unexpected error in search_nearby_places: {e}")
            return []


# Global client instance
_here_client: Optional[HereMapsClient] = None


def get_here_client() -> HereMapsClient:
    """Get or create HERE Maps client instance."""
    global _here_client
    if _here_client is None:
        _here_client = HereMapsClient()
    return _here_client

