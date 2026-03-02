import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

/**
 * ProtectedRoute - Guards dashboard routes
 * 
 * Checks:
 * 1. User is authenticated (Firebase)
 * 2. User's email is verified
 * 3. Optionally checks role-based access
 * 
 * Redirects:
 * - To /login if not authenticated
 * - To /verify if email not verified (for MFA users)
 */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const location = useLocation();

  const smsOtpDisabled = String(import.meta.env.VITE_DISABLE_SMS_OTP || '').toLowerCase() === '1'
    || String(import.meta.env.VITE_DISABLE_SMS_OTP || '').toLowerCase() === 'true';

  const { isFreshLink, sanitizedLocation } = useMemo(() => {
    try {
      const qs = new URLSearchParams(location?.search || '');
      const fresh = (qs.get('fresh') || '').trim();
      const isFresh = fresh === '1' || fresh.toLowerCase() === 'true';
      if (!isFresh) return { isFreshLink: false, sanitizedLocation: location };
      qs.delete('fresh');
      const nextSearch = qs.toString();
      return {
        isFreshLink: true,
        sanitizedLocation: { ...location, search: nextSearch ? `?${nextSearch}` : '' },
      };
    } catch {
      return { isFreshLink: false, sanitizedLocation: location };
    }
  }, [location]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch user data from Firestore
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f5f7fa'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e0e0e0',
          borderTop: '4px solid #2563eb',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    const path = String(location?.pathname || '').toLowerCase();
    const allowed = (allowedRoles || []).map((r) => String(r).toLowerCase());

    // Prefer explicit role intent when this guard is role-scoped.
    if (allowed.includes('super_admin')) {
      return <Navigate to="/super-admin/login" state={{ from: sanitizedLocation }} replace />;
    }
    if (allowed.includes('admin')) {
      return <Navigate to="/admin/login" state={{ from: sanitizedLocation }} replace />;
    }

    // Fallback: infer from URL segment (works with basenames/subpaths too).
    const isAdminPath = /(^|\/)admin(\/|$)/.test(path);
    const isSuperAdminPath = /(^|\/)super-admin(\/|$)/.test(path);
    const loginRoute = isSuperAdminPath ? '/super-admin/login' : isAdminPath ? '/admin/login' : '/login';
    return <Navigate to={loginRoute} state={{ from: sanitizedLocation }} replace />;
  }

  // Fresh-login deep link: force sign-out so the recipient must authenticate.
  // This prevents cases where a user is already logged in as a different role/account.
  if (isFreshLink) {
    try {
      // Fire-and-forget sign-out; auth state listener will update.
      signOut(auth);
    } catch {
      // ignore
    }

    const path = String(location?.pathname || '').toLowerCase();
    const allowed = (allowedRoles || []).map((r) => String(r).toLowerCase());
    if (allowed.includes('super_admin')) {
      return <Navigate to="/super-admin/login" state={{ from: sanitizedLocation }} replace />;
    }
    if (allowed.includes('admin')) {
      return <Navigate to="/admin/login" state={{ from: sanitizedLocation }} replace />;
    }
    const isAdminPath = /(^|\/)admin(\/|$)/.test(path);
    const isSuperAdminPath = /(^|\/)super-admin(\/|$)/.test(path);
    const loginRoute = isSuperAdminPath ? '/super-admin/login' : isAdminPath ? '/admin/login' : '/login';
    return <Navigate to={loginRoute} state={{ from: sanitizedLocation }} replace />;
  }

  // Email not verified - redirect to verification
  // Note: For Firebase phone auth, emailVerified might be false but phone is verified
  // We check both email verification and if user came through proper flow
  if (!smsOtpDisabled && !user.emailVerified && userData?.mfa_enabled) {
    return <Navigate to="/verify" state={{ 
      phone: userData?.phone,
      role: userData?.role,
      fromProtectedRoute: true 
    }} replace />;
  }

  // If a role-protected route is requested but the Firestore profile is missing,
  // do not render protected content.
  if (allowedRoles.length > 0 && !userData) {
    const allowed = (allowedRoles || []).map((r) => String(r).toLowerCase());
    const to = allowed.includes('super_admin') ? '/super-admin/login'
      : allowed.includes('admin') ? '/admin/login'
        : '/login';
    return <Navigate to={to} state={{ missingProfile: true, from: location }} replace />;
  }

  // Role-based access control (if allowedRoles specified)
  if (allowedRoles.length > 0 && userData) {
    const userRole = userData.role?.toLowerCase();
    const allowed = allowedRoles.map(r => r.toLowerCase());

    // Extra gate: admin accounts require super-admin approval before access.
    if (userRole === 'admin' && allowed.includes('admin') && userData?.admin_approved !== true) {
      return <Navigate to="/admin/login" state={{ pendingApproval: true }} replace />;
    }
    
    if (!allowed.includes(userRole)) {
      // Redirect to appropriate dashboard based on actual role
      const roleRedirects = {
        'carrier': '/carrier-dashboard',
        'driver': '/driver-dashboard',
        'shipper': '/shipper-dashboard',
        'admin': '/admin',
        'super_admin': '/super-admin/dashboard'
      };
      
      const correctDashboard = roleRedirects[userRole] || '/carrier-dashboard';
      return <Navigate to={correctDashboard} replace />;
    }
  }

  // All checks passed - render the protected content
  return children;
};

export default ProtectedRoute;

