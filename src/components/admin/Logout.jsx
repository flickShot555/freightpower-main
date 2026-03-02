import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import '../../styles/admin/Logout.css';

export default function Logout(){
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSignOut(){
    setLoading(true);
    try {
      await signOut(auth);
    } finally {
      setLoading(false);
      navigate('/admin/login', { replace: true });
    }
  }

  return (
    <div className="logout-root">
      <div className="logout-card card">
        <div className="logout-icon"> <i className="fa-solid fa-right-from-bracket" /></div>
        <h3>Sign out of FreightPower Admin?</h3>
        <p className="muted">You will be returned to the admin sign-in screen. If you want to remain signed in on this device, choose Cancel.</p>
        <div className="logout-actions">
          <button
            className="btn small ghost-cd"
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn small-cd"
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            style={{background: "red"}}
          >
            {loading ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
