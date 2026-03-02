import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import '../styles/carrier/CarrierSignup.css'; // Reusing your existing styles

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      setMessage('');
      setError('');
      setLoading(true);
      await resetPassword(email);
      setMessage('Check your inbox for password reset instructions.');
    } catch (err) {
      setError('Failed to reset password. Please check the email address.');
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="carrier-signup-container" style={{justifyContent:'center', alignItems:'center'}}>
      <div className="carrier-signup-form-bg" style={{maxWidth: '450px', margin: 'auto'}}>
        <h2 className="carrier-signup-title">Password Reset</h2>
        <p className="carrier-signup-subtitle">Enter your email to receive reset instructions</p>
        
        {error && <div style={{color:'red', marginBottom:10}}>{error}</div>}
        {message && <div style={{color:'green', marginBottom:10}}>{message}</div>}

        <form className="carrier-signup-form" onSubmit={handleSubmit}>
          <div className="carrier-signup-field input-with-icon">
            <label>Email</label>
            <div className="input-icon-wrap">
              <i className="fa-solid fa-envelope" aria-hidden="true" />
              <input 
                type="email" 
                placeholder="name@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="carrier-signup-login-actions">
            <button 
              type="submit" 
              className="carrier-signup-btn"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Reset Password'}
            </button>
          </div>

          <div className="carrier-signup-login-text" style={{marginTop: 20}}>
            <Link to="/login">Back to Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}