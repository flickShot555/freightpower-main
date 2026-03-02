import json
import os
from typing import Dict, Any, List, Optional


class ResponseStore:
    def __init__(self, base_dir: str = "./data"):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)
        self.path = os.path.join(self.base_dir, "response.json")
        if not os.path.exists(self.path):
            self._write({"documents": {}, "chats": [], "chunks": []})

    def _read(self) -> Dict[str, Any]:
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"documents": {}, "chats": [], "chunks": []}

    def _write(self, data: Dict[str, Any]):
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)

    def save_document(self, record: Dict[str, Any]):
        data = self._read()
        docs = data.get("documents", {})
        docs[record["id"]] = record
        data["documents"] = docs
        self._write(data)

    # Loads and carriers for matching workflows
    def save_load(self, load: Dict[str, Any]):
        data = self._read()
        loads = data.get("loads", {})
        loads[load["id" if "id" in load else "load_id"]] = load
        data["loads"] = loads
        self._write(data)

    def get_load(self, load_id: str) -> Optional[Dict[str, Any]]:
        data = self._read()
        return data.get("loads", {}).get(load_id)
    
    def update_load(self, load_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing load with partial data."""
        data = self._read()
        loads = data.get("loads", {})
        if load_id not in loads:
            return None
        loads[load_id].update(updates)
        data["loads"] = loads
        self._write(data)
        return loads[load_id]
    
    def delete_load(self, load_id: str) -> bool:
        """Delete a load from storage. Returns True if deleted, False if not found."""
        data = self._read()
        loads = data.get("loads", {})
        if load_id in loads:
            del loads[load_id]
            data["loads"] = loads
            self._write(data)
            return True
        return False

    def list_loads(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        data = self._read()
        all_loads = list(data.get("loads", {}).values())
        
        if not filters:
            return all_loads
        
        # Apply filters
        filtered = all_loads
        if "created_by" in filters:
            filtered = [l for l in filtered if l.get("created_by") == filters["created_by"]]
        if "status" in filters:
            filtered = [l for l in filtered if l.get("status") == filters["status"]]
        if "creator_role" in filters:
            # Support both string and list for creator_role filtering
            allowed_roles = filters["creator_role"]
            if isinstance(allowed_roles, list):
                filtered = [l for l in filtered if l.get("creator_role") in allowed_roles]
            else:
                filtered = [l for l in filtered if l.get("creator_role") == allowed_roles]
        if "assigned_driver" in filters:
            filtered = [l for l in filtered if l.get("assigned_driver") == filters["assigned_driver"]]
        if "assigned_carrier" in filters:
            filtered = [l for l in filtered if l.get("assigned_carrier") == filters["assigned_carrier"]]
        
        return filtered
    
    def add_status_change_log(self, load_id: str, log_entry: Dict[str, Any]) -> bool:
        """Add a status change log entry to a load."""
        data = self._read()
        loads = data.get("loads", {})
        if load_id not in loads:
            return False
        
        if "status_change_logs" not in loads[load_id]:
            loads[load_id]["status_change_logs"] = []
        
        loads[load_id]["status_change_logs"].append(log_entry)
        data["loads"] = loads
        self._write(data)
        return True

    def save_carrier(self, carrier: Dict[str, Any]):
        data = self._read()
        carriers = data.get("carriers", {})
        carriers[carrier["id"]] = carrier
        data["carriers"] = carriers
        self._write(data)

    def get_carrier(self, carrier_id: str) -> Optional[Dict[str, Any]]:
        data = self._read()
        return data.get("carriers", {}).get(carrier_id)

    def list_carriers(self) -> List[Dict[str, Any]]:
        data = self._read()
        return list(data.get("carriers", {}).values())
    
    def list_shipper_carriers(self, shipper_id: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """List carriers associated with a specific shipper."""
        data = self._read()
        relationships = data.get("shipper_carrier_relationships", [])
        
        # Filter by shipper_id
        shipper_rels = [r for r in relationships if r.get("shipper_id") == shipper_id]
        
        # Apply additional filters
        if filters:
            if "status" in filters:
                shipper_rels = [r for r in shipper_rels if r.get("status") == filters["status"]]
        
        return shipper_rels
    
    def save_shipper_carrier_relationship(self, relationship: Dict[str, Any]):
        """Save or update a shipper-carrier relationship."""
        data = self._read()
        relationships = data.get("shipper_carrier_relationships", [])
        
        # Check if relationship already exists
        for i, rel in enumerate(relationships):
            if (rel.get("shipper_id") == relationship.get("shipper_id") and 
                rel.get("carrier_id") == relationship.get("carrier_id")):
                # Update existing relationship
                relationships[i] = relationship
                data["shipper_carrier_relationships"] = relationships
                self._write(data)
                return
        
        # Add new relationship
        relationships.append(relationship)
        data["shipper_carrier_relationships"] = relationships
        self._write(data)
    
    def save_carrier_invitation(self, invitation: Dict[str, Any]):
        """Save a carrier invitation."""
        data = self._read()
        invitations = data.get("carrier_invitations", [])
        invitations.append(invitation)
        data["carrier_invitations"] = invitations
        self._write(data)
    
    def get_carrier_invitation(self, invitation_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific carrier invitation."""
        data = self._read()
        invitations = data.get("carrier_invitations", [])
        for inv in invitations:
            if inv.get("id") == invitation_id:
                return inv
        return None
    
    def list_carrier_invitations(self, shipper_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List carrier invitations for a shipper."""
        data = self._read()
        invitations = data.get("carrier_invitations", [])
        
        # Filter by shipper_id
        shipper_invs = [i for i in invitations if i.get("shipper_id") == shipper_id]
        
        # Filter by status if provided
        if status:
            shipper_invs = [i for i in shipper_invs if i.get("status") == status]
        
        return shipper_invs
    
    def list_carrier_invitations_by_carrier(self, carrier_id: str = None, carrier_email: str = None, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List invitations received by a carrier."""
        data = self._read()
        invitations = data.get("carrier_invitations", [])
        
        # Filter by carrier_id or carrier_email
        carrier_invs = []
        for i in invitations:
            if carrier_id and i.get("carrier_id") == carrier_id:
                carrier_invs.append(i)
            elif carrier_email and i.get("carrier_email") == carrier_email:
                carrier_invs.append(i)
        
        # Filter by status if provided
        if status:
            carrier_invs = [i for i in carrier_invs if i.get("status") == status]
        
        return carrier_invs
    
    def get_carrier_invitation_by_id(self, invitation_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific carrier invitation by ID."""
        data = self._read()
        invitations = data.get("carrier_invitations", [])
        for inv in invitations:
            if inv.get("id") == invitation_id:
                return inv
        return None
    
    def update_carrier_invitation(self, invitation_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a carrier invitation."""
        data = self._read()
        invitations = data.get("carrier_invitations", [])
        
        for i, inv in enumerate(invitations):
            if inv.get("id") == invitation_id:
                invitations[i].update(updates)
                data["carrier_invitations"] = invitations
                self._write(data)
                return invitations[i]
        
        return None

    def save_assignment(self, assignment: Dict[str, Any]):
        data = self._read()
        assignments = data.get("assignments", [])
        assignments.append(assignment)
        data["assignments"] = assignments
        self._write(data)

    def list_assignments(self) -> List[Dict[str, Any]]:
        data = self._read()
        return data.get("assignments", [])

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        data = self._read()
        return data.get("documents", {}).get(doc_id)

    def list_documents(self) -> List[Dict[str, Any]]:
        data = self._read()
        return list(data.get("documents", {}).values())

    def append_chat(self, chat: Dict[str, Any]):
        data = self._read()
        chats = data.get("chats", [])
        chats.append(chat)
        data["chats"] = chats
        self._write(data)

    def save_fmcsa_profile(self, profile: Dict[str, Any]):
        data = self._read()
        carrier_data = data.get("fmcsa_profiles", {})
        key = profile.get("usdot")
        if not key:
            return
        carrier_data[key] = profile
        data["fmcsa_profiles"] = carrier_data
        self._write(data)

    def get_fmcsa_profile(self, usdot: str) -> Optional[Dict[str, Any]]:
        data = self._read()
        return data.get("fmcsa_profiles", {}).get(usdot)

    def save_fmcsa_verification(self, verification: Dict[str, Any]):
        data = self._read()
        verifications = data.get("fmcsa_verifications", {})
        key = verification.get("usdot") or verification.get("mc_number")
        if not key:
            return
        verifications[key] = verification
        data["fmcsa_verifications"] = verifications
        self._write(data)

    def get_fmcsa_verification(self, key: str) -> Optional[Dict[str, Any]]:
        data = self._read()
        return data.get("fmcsa_verifications", {}).get(key)

    # Alerts
    def save_alert(self, alert: Dict[str, Any]):
        data = self._read()
        alerts = data.get("alerts", [])
        # de-dup simple: skip if identical type/message/entity exists
        for a in alerts:
            if (
                a.get("type") == alert.get("type")
                and a.get("message") == alert.get("message")
                and a.get("entity_id") == alert.get("entity_id")
            ):
                return
        alerts.append(alert)
        data["alerts"] = alerts
        self._write(data)

    def list_alerts(self, priority: Optional[str] = None) -> List[Dict[str, Any]]:
        data = self._read()
        alerts = data.get("alerts", [])
        if priority:
            alerts = [a for a in alerts if a.get("priority") == priority]
        return alerts

    def alert_summary(self) -> Dict[str, int]:
        data = self._read()
        alerts = data.get("alerts", [])
        summary: Dict[str, int] = {}
        for a in alerts:
            pr = a.get("priority") or "routine"
            summary[pr] = summary.get(pr, 0) + 1
        return summary

    def save_alert_digest(self, digest: Dict[str, Any]):
        data = self._read()
        data["alert_digest"] = digest
        self._write(data)

    def get_alert_digest(self) -> Optional[Dict[str, Any]]:
        data = self._read()
        return data.get("alert_digest")

    # Chunk/Embedding management
    def upsert_document_chunks(self, document_id: str, chunks: List[Dict[str, Any]]):
        """Replace all chunks for a document id with provided list.
        Each chunk requires: {id, document_id, chunk_index, content, embedding(list[float]), metadata}
        """
        data = self._read()
        existing = data.get("chunks", [])
        # remove old
        filtered = [c for c in existing if c.get("document_id") != document_id]
        # add new
        filtered.extend(chunks)
        data["chunks"] = filtered
        self._write(data)

    def get_all_chunks(self) -> List[Dict[str, Any]]:
        data = self._read()
        return list(data.get("chunks", []))
