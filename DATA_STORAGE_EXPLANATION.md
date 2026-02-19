# Data Storage Explanation

## Where Data is Stored

### 1. **Notifications** ✅ (Stored in Firestore - Real Database)
- **Location**: Firestore `notifications` collection
- **Code**: `db.collection("notifications").document(notification_id).set(notification_data)`
- **Persistence**: ✅ Permanent - stored in Google Cloud Firestore
- **Retrieval**: `GET /notifications` endpoint fetches from Firestore

### 2. **Invitations** ⚠️ (Stored in Local JSON File - NOT a Real Database)
- **Location**: `./data/response.json` file (local file system)
- **Code**: `store.save_carrier_invitation(invitation_record)`
- **Persistence**: ⚠️ **Temporary** - Lost if server restarts or file is deleted
- **Storage Class**: `ResponseStore` class in `apps/api/storage.py`
- **Issue**: This is NOT suitable for production

### 3. **Shipper-Carrier Relationships** ⚠️ (Stored in Local JSON File - NOT a Real Database)
- **Location**: `./data/response.json` file (local file system)
- **Code**: `store.save_shipper_carrier_relationship(relationship)`
- **Persistence**: ⚠️ **Temporary** - Lost if server restarts or file is deleted
- **Storage Class**: `ResponseStore` class in `apps/api/storage.py`
- **Issue**: This is NOT suitable for production

## Current Issues

### Problem:
- **Invitations and Relationships** are stored in a local JSON file (`./data/response.json`)
- This means:
  - Data is lost when the server restarts
  - Data is not shared across multiple server instances
  - Not suitable for production use
  - No backup or recovery mechanism

### Solution Needed:
To make this production-ready, invitations and relationships should be stored in **Firestore** like notifications.

## Migration Path to Firestore

### For Invitations:
```python
# Instead of:
store.save_carrier_invitation(invitation_record)

# Should be:
db.collection("carrier_invitations").document(invitation_id).set(invitation_record)
```

### For Relationships:
```python
# Instead of:
store.save_shipper_carrier_relationship(relationship)

# Should be:
db.collection("shipper_carrier_relationships").document(relationship_id).set(relationship)
```

## Current Status Summary

| Data Type | Storage Location | Persistence | Production Ready? |
|-----------|-----------------|-------------|-------------------|
| Notifications | Firestore | ✅ Permanent | ✅ Yes |
| Invitations | Local JSON file | ⚠️ Temporary | ❌ No |
| Relationships | Local JSON file | ⚠️ Temporary | ❌ No |

## Recommendations

1. **Short Term**: Current implementation works for testing, but data will be lost on server restart
2. **Production**: Migrate invitations and relationships to Firestore for permanent storage

