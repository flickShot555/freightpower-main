import { Link } from 'react-router-dom';
import '../../styles/landing_page/Footer.css';

function scrollToId(e, id) {
  e.preventDefault();
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function Footer() {
  return (
    <footer className="footer-section">
      {/* Top section with links */}
      <div className="footer-top">
        <div className="footer-container">
          <div className="footer-grid">
            {/* Brand section */}
            <div className="footer-brand">
              <h2 className="footer-brand-name">FreightPower</h2>
              <p className="footer-brand-description">
                Smarter Freight Management for Carriers, Drivers & Shippers
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="footer-section-title">Quick Links</h3>
              <ul className="footer-links">
                <li><a href="#features" onClick={(e) => scrollToId(e, 'features')} className="footer-link">Features</a></li>
                <li><a href="#how-it-works" onClick={(e) => scrollToId(e, 'how-it-works')} className="footer-link">How it Works</a></li>
                <li><a href="#about" onClick={(e) => scrollToId(e, 'about')} className="footer-link">Marketplace</a></li>
                <li><a href="#pricing" onClick={(e) => scrollToId(e, 'pricing')} className="footer-link">Pricing</a></li>
              </ul>
            </div>

            {/* Solutions */}
            <div>
              <h3 className="footer-section-title">Solutions</h3>
              <ul className="footer-links">
                <li><a href="#" className="footer-link">Freight Management</a></li>
                <li><a href="#" className="footer-link">Order Tracking</a></li>
                <li><a href="#" className="footer-link">Carrier Integration</a></li>
                <li><a href="#" className="footer-link">Analytics Dashboard</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="footer-section-title">Resources</h3>
              <ul className="footer-links">
                <li><Link to="/help-center" className="footer-link">Help Center</Link></li>
                <li><Link to="/faq" className="footer-link">FAQs</Link></li>
                <li><a href="#" className="footer-link">Terms of Service</a></li>
                <li><a href="#" className="footer-link">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section with copyright and social */}
      <div className="footer-bottom">
        <div className="footer-container">
          <div className="footer-bottom-content">
            <div className="footer-copyright">
              ©2025<span className="footer-brand-highlight">FreightBot</span> All Rights Reserved.
            </div>
            
            <div className="footer-social-container">
              <div className="footer-social">
                {/* X (Twitter) */}
                <a href="#" className="footer-social-link" aria-label="X (Twitter)">
                  <svg className="footer-social-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                
                {/* Instagram */}
                <a href="#" className="footer-social-link" aria-label="Instagram">
                  <svg className="footer-social-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987c6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM8.449 16.988c-1.297 0-2.348-1.051-2.348-2.348s1.051-2.348 2.348-2.348c1.297 0 2.348 1.051 2.348 2.348S9.746 16.988 8.449 16.988zM12.017 7.729c-2.35 0-4.258 1.908-4.258 4.258c0 2.35 1.908 4.258 4.258 4.258c2.35 0 4.258-1.908 4.258-4.258C16.275 9.637 14.367 7.729 12.017 7.729zM15.585 16.988c-1.297 0-2.348-1.051-2.348-2.348s1.051-2.348 2.348-2.348c1.297 0 2.348 1.051 2.348 2.348S16.882 16.988 15.585 16.988z"/>
                  </svg>
                </a>
                
                {/* LinkedIn */}
                <a href="#" className="footer-social-link" aria-label="LinkedIn">
                  <svg className="footer-social-icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
              </div>
            </div>
            
            <div className="footer-terms-section">
              <a href="#" className="footer-terms-link">Terms & Condition</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}