import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../styles/carrier/CarrierSignup.css';
import '../styles/carrier/CarrierLogin.css';
import carrier_ob_1 from '../assets/carrier_ob_1.png';
import carrier_ob_2 from '../assets/carrier_ob_2.jpg';
import carrier_ob_3 from '../assets/carrier_ob_3.jpg';
import pattern_bg_signup from '../assets/pattern_bg_signup.svg';

const Login = () => {
  const { login } = useAuth(); 
  const navigate = useNavigate();
  const location = useLocation();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Visuals (Carousel)
  const images = [carrier_ob_1, carrier_ob_2, carrier_ob_3];
  const [currentImg, setCurrentImg] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImg((p) => (p + 1) % images.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Authenticate & Check MFA Status
      // The updated login() function now returns { user, mfaRequired, phone }
      const res = await login(email, password);

      // If an admin/super-admin attempts to use the public login page, send them to the correct login.
      if (res?.redirectTo) {
        navigate(res.redirectTo, {
          replace: true,
          state: { from: location?.state?.from || null, reason: res?.reason || null },
        });
        return;
      }
      
      // 2. MFA Enforcement Logic
      if (res.mfaRequired) {
        // Redirect to Verification Page for SMS Code
        navigate('/verify', { 
            state: { 
                phone: res.phone, 
                fromLogin: true, // Flag to tell verify page "This is a login MFA check"
                from: location?.state?.from || null,
            } 
        });
        return; // Stop here, don't go to dashboard yet
      }

      // 3. If No MFA, Fetch Role & Redirect
      const userDocRef = doc(db, "users", res.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error("User data not found. Please contact support.");
      }

      const userData = userDoc.data();
      const role = userData.role || 'carrier';

      // If user attempted to access a protected route (e.g. deep link from email), honor it.
      const from = location?.state?.from;
      const fromPath = from?.pathname ? `${from.pathname}${from.search || ''}` : '';
      if (fromPath && !String(fromPath).startsWith('/login')) {
        navigate(fromPath, { replace: true });
        return;
      }

      // 4. Role-Based Redirect
      if (role === 'super_admin') navigate('/super-admin/dashboard');
      else if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'driver') navigate('/driver-dashboard');
      else if (role === 'shipper' || role === 'broker') navigate('/shipper-dashboard');
      else navigate('/carrier-dashboard');

    } catch (err) {
      console.error(err);
      setError("Failed to log in. Please check your email and password.");
    }

    setLoading(false);
  };

  return (
    <div className="carrier-signup-container carrier-login-page">
      {/* Invisible Recaptcha for SMS (Required if MFA triggers) */}
      <div id="recaptcha-container"></div>

      {/* Left Side: Login Form */}
      <div className="carrier-signup-left">
        <img src={pattern_bg_signup} alt="Pattern" className="carrier-signup-pattern-bg" />
        <div className="carrier-signup-form-bg">
          <h1 className="carrier-signup-title">Log in to FreightPower AI</h1>
          <p className="carrier-signup-subtitle">Manage, move, and monitor freight smarter</p>

          {error && (
            <div style={{
              backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', 
              borderRadius: '8px', marginBottom: '16px', fontSize: '14px', border: '1px solid #fecaca'
            }}>
              {error}
            </div>
          )}

          <form className="carrier-signup-form" onSubmit={handleSubmit}>
            {/* Email */}
            <div className="carrier-signup-field input-with-icon">
              <label>Email Address</label>
              <div className="input-icon-wrap">
                <i className="fa-solid fa-envelope" aria-hidden="true" />
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="email@company.com" 
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="carrier-signup-field input-with-icon">
              <label>Password</label>
              <div className="input-icon-wrap">
                <i className="fa-solid fa-lock" aria-hidden="true" />
                <input 
                  id="password-field" 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Enter your password" 
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="carrier-signup-bottom-actions">
              <div className="remember-row">
                <label className="remember-ctrl"><input type="checkbox" /> Remember me</label>
                <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
              </div>

              <div className="carrier-signup-login-actions">
                <button type="submit" className="carrier-signup-btn" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </button>
              </div>

              <div className="divider"><span>Or continue with</span></div>

              <button type="button" className="google-signin">
                <i className="fa-brands fa-google google-icon" aria-hidden="true" />
                Sign In with Google
              </button>

              <div className="carrier-signup-login-text">
                Don't have an account? <Link to="/select-role" className="signup-link">Sign Up</Link>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Right Side: Visuals */}
      <div className="carrier-signup-right-bg-simple">
        <img src={'/src/assets/blue_bg_signup.svg'} alt="Blue Background" className="carrier-signup-bg-svg" />
        <div className="carrier-signup-img-block">
          <img src={images[currentImg]} alt="Onboarding" className="carrier-signup-img-top-simple" />
        </div>
        <div className="carrier-signup-info-bottom">
          <div className="carrier-signup-img-indicators" style={{ background: 'transparent', minHeight: '24px', marginBottom: '0', marginTop: '0' }}>
            {images.map((_, idx) => (
              <span
                key={idx}
                onClick={() => setCurrentImg(idx)}
                className={ idx === currentImg ? "carrier-signup-dot-active" : "carrier-signup-dot" }
                style={{ display: 'inline-block', verticalAlign: 'middle', cursor: 'pointer' }}
              />
            ))}
          </div>
          <div className="carrier-signup-info-simple">
            <h2>Onboard Faster,<br/>Manage Smarter with AI</h2>
            <ul>
              <li>Connect instantly, automate your documents, and move freight smarter in one intelligent digital marketplace.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;