import React from 'react';
import '../../styles/landing_page/TrustSection.css';
import trustImage from '../../assets/trust.svg';

export default function TrustSection() {
  return (
    <section id="testimonials" className="trust-section">
      <div className="trust-container">
        {/* Centered Header */}
        <div className="trust-header">
          <h2 className="trust-title">
            Trusted. Compliant. Protected.
          </h2>
          <p className="trust-subtitle">
            Secure, regulation-ready platform with encryption, compliance tools, and safety monitoring.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="trust-content">
          {/* Left Content with Features */}
          <div className="trust-content-left">
            <div className="trust-features">
              {/* Ask questions instantly */}
              <div className="trust-feature">
                <div className="trust-feature-content">
                  <h3>Ask questions instantly</h3>
                  <p>Get immediate answers from your AI co-pilot without searching through menus.</p>
                </div>
              </div>

              {/* Get AI-powered load suggestions */}
              <div className="trust-feature">
                <div className="trust-feature-content">
                  <h3>Get AI-powered load suggestions</h3>
                  <p>Receive smart recommendations for loads tailored to your role and capacity.</p>
                </div>
              </div>

              {/* Check compliance status in real time */}
              <div className="trust-feature">
                <div className="trust-feature-content">
                  <h3>Check compliance status in real time</h3>
                  <p>View up-to-date compliance information anytime to avoid delays.</p>
                </div>
              </div>

              {/* Supports both voice and text commands */}
              <div className="trust-feature">
                <div className="trust-feature-content">
                  <h3>Supports both voice and text commands</h3>
                  <p>Interact hands-free or by typing, whichever suits your workflow.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Dashboard */}
          <div className="trust-dashboard">
            <img 
              src={trustImage} 
              alt="FreightPower Dashboard - Trusted, Compliant, Protected platform"
              className="trust-dashboard-image"
            />
          </div>
        </div>
      </div>
    </section>
  );
}