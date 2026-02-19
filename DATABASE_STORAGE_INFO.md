# Database Storage Information

## Current Storage Status

### ✅ NOTIFICATIONS - Stored in Firestore (Proper Database)
**Location:** Firebase Firestore Collection: `notifications`
**Status:** ✅ PERSISTENT DATABASE STORAGE

- Notifications are stored in Firestore using `db.collection("notifications").document(notification_id).set(notification_data)`
- All notifications persist across server restarts
- Can be queried, indexed, and accessed in real-time
- **Location:** Firebase Console → Firestore Database → `notifications` collection

**Code References:**
- Created in: `apps/api/main.py` lines 2865, 3000
- Retrieved from: `apps/api/main.py` lines 3081-3131

---

### ❌ INVITATIONS - Stored in JSON File (NOT Database)
**Location:** Local JSON file: `./data/response.json`
**Status:** ⚠️ FILE-BASED STORAGE (NOT PERSISTENT DATABASE)

- Invitations are stored using `ResponseStore` which writes to a local JSON file
- **Location:** `frightpowernew/apps/data/response.json` → `carrier_invitations` array
- This is NOT a database - data is stored in a file on the server
- Data persists but is not scalable or suitable for production

**Code References:**
- Saved via: `store.save_carrier_invitation()` in `apps/api/storage.py` line 160
- Stored in: `apps/api/storage.py` line 163-166 (appends to JSON file)

---

### ❌ RELATIONSHIPS - Stored in JSON File (NOT Database)
**Location:** Local JSON file: `./data/response.json`
**Status:** ⚠️ FILE-BASED STORAGE (NOT PERSISTENT DATABASE)

- Shipper-Carrier relationships are stored using `ResponseStore` which writes to a local JSON file
- **Location:** `frightpowernew/apps/data/response.json` → `shipper_carrier_relationships` array
- This is NOT a database - data is stored in a file on the server
- Data persists but is not scalable or suitable for production

**Code References:**
- Saved via: `store.save_shipper_carrier_relationship()` in `apps/api/storage.py` line 140
- Stored in: `apps/api/storage.py` line 142-158 (appends/updates JSON file)

---

## Recommendations

### For Production Deployment:

1. **Migrate Invitations to Firestore:**
   - Create a `carrier_invitations` collection in Firestore
   - Update `save_carrier_invitation()` to use Firestore
   - Benefits: Real-time sync, better querying, scalability

2. **Migrate Relationships to Firestore:**
   - Create a `shipper_carrier_relationships` collection in Firestore
   - Update `save_shipper_carrier_relationship()` to use Firestore
   - Benefits: Real-time sync, better querying, scalability

3. **Alternative: Use SQL Database (PostgreSQL/MySQL)**
   - If you need complex queries and transactions
   - Better for relational data
   - More control over indexing and performance

---

## Current Data Locations

### In Firestore (Database):
- ✅ `notifications` collection - All user notifications
- ✅ `users` collection - User profiles
- ✅ `audit_logs` collection - Action logs

### In JSON File (`./data/response.json`):
- ❌ `carrier_invitations` array - Invitation records
- ❌ `shipper_carrier_relationships` array - Accepted partnerships
- ❌ `loads` object - Load records
- ❌ `documents` object - Document metadata

---

## Quick Check Commands

### To View Firestore Data:
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Check `notifications` collection for notification records

### To View JSON File Data:
1. Navigate to `frightpowernew/apps/data/response.json`
2. Check `carrier_invitations` array for invitations
3. Check `shipper_carrier_relationships` array for relationships

