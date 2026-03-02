# Quick Start: Running the ./apps Backend

## Prerequisites
- Python 3.8+
- `serviceAccountKey.json` in the `apps` directory
- Environment variables configured

## Step 1: Install Dependencies
```bash
cd apps
pip install -r requirements.txt
```

## Step 2: Start the Backend
```bash
python -m uvicorn api.main:app --reload --port 5000
```

## Step 3: Verify It's Running
Open your browser and navigate to:
```
http://localhost:5000/docs
```

You should see the FastAPI Swagger documentation with all endpoints.

---

## Available Endpoints

### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/login` - Login
- `GET /auth/me` - Current user

### Onboarding (Manual Path)
- `GET /onboarding/status` - Current status
- `GET /onboarding/data` - User profile + DOT/MC
- `POST /onboarding/save` - Submit form

### Onboarding (Chatbot Path)
- `POST /onboarding/create-from-chatbot` - Quick account creation

### Chat & Documents
- `POST /chat/onboarding` - Chatbot messages
- `POST /documents` - Upload documents

---

## Testing the Backend

### 1. Test Signup
```bash
curl -X POST "http://localhost:5000/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "name": "Test User",
    "phone": "+1234567890",
    "role": "carrier",
    "company_name": "Test Company"
  }'
```

### 2. Test Login
```bash
curl -X POST "http://localhost:5000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### 3. Test Get Current User (with token)
```bash
curl -X GET "http://localhost:5000/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Test Onboarding Status
```bash
curl -X GET "http://localhost:5000/onboarding/status" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Key Differences from ./backend

| Feature | ./backend | ./apps |
|---|---|---|
| Database | PostgreSQL | Firebase Firestore |
| Auth Provider | Custom JWT | Firebase Authentication |
| ORM | SQLAlchemy | Firestore Python SDK |
| Port | 8000 | 5000 |
| Startup | `uvicorn backend.app.main:app` | `uvicorn api.main:app` |

---

## Environment Variables Required

Make sure your `.env` file includes:
```
GROQ_API_KEY=your_groq_api_key
FIREBASE_PROJECT_ID=your_firebase_project
FIREBASE_PRIVATE_KEY=your_firebase_private_key
# ... other configs
```

---

## Troubleshooting

### Port 5000 Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5000   # Windows (then taskkill /PID)
```

### Import Errors
```bash
# Reinstall dependencies
pip install --force-reinstall -r requirements.txt
```

### Firebase Connection Issues
- Verify `serviceAccountKey.json` exists in `apps/` directory
- Check `FIREBASE_PROJECT_ID` matches your project
- Verify Firestore is enabled in Firebase Console

### Chatbot Not Working
- Verify `GROQ_API_KEY` is set
- Check `chat_flow.py` hasn't been modified (it shouldn't have been)
- Review logs for AI service errors

---

## Switching from ./backend to ./apps

### If Currently Running ./backend:

1. **Stop ./backend**
   ```bash
   # Press Ctrl+C in the terminal running backend
   ```

2. **Start ./apps**
   ```bash
   cd apps
   python -m uvicorn api.main:app --reload --port 5000
   ```

3. **Frontend Will Auto-Switch**
   - Frontend calls `http://localhost:5000`
   - No frontend changes needed

---

## What's New in ./apps

### ✅ Onboarding
- Manual form submission at `/onboarding/save`
- Quick account creation from chatbot at `/onboarding/create-from-chatbot`
- Real-time status tracking at `/onboarding/status`
- User profile queries at `/onboarding/data`

### ✅ RBAC
- Role-based access control with decorators
- `require_role()` decorator for custom roles
- `require_admin()` dependency for admin-only endpoints
- `require_super_admin()` dependency for super admin access

### ✅ Firebase Schema
- Complete user document with 20+ fields
- Onboarding progress tracking
- DOT/MC number storage
- Role management (CARRIER, DRIVER, SHIPPER, BROKER, ADMIN, SUPER_ADMIN)

---

## Performance Tips

1. **Enable Redis Caching** (optional)
   ```python
   # In database.py - implement caching for frequently accessed data
   ```

2. **Monitor Firestore Usage**
   - Check Firebase Console for read/write patterns
   - Optimize queries if needed

3. **Database Indexing**
   - Firestore auto-creates indexes
   - Monitor slow queries in Firebase Console

---

## Production Deployment

### Before Going Live:

1. **Update CORS Settings**
   - Change `allow_origins` in `main.py` line 42
   - Add your production domain
   - Remove `localhost` origins

2. **Set Up Environment Variables**
   - Store secrets in environment (not `.env`)
   - Use managed secrets service

3. **Enable HTTPS**
   - Use SSL/TLS certificates
   - Update frontend URLs to HTTPS

4. **Database Backups**
   - Enable Firestore automated backups
   - Test restore procedures

5. **Monitoring & Logging**
   - Set up Cloud Logging
   - Configure error alerts
   - Monitor API response times

---

## Support

For issues or questions:
1. Check the logs: `MIGRATION_COMPLETE.md`
2. Review endpoint documentation: `http://localhost:5000/docs`
3. Verify Firebase configuration
4. Check environment variables

---

**Status**: ✅ Ready to Deploy
**Date**: December 2025
**Version**: 1.0.0
