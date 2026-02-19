import React from 'react';
import '../../styles/shipper/RateConfirmationPanel.css';

export default function RateConfirmationPanel({ onClose = () => {} }) {
  return (
    <div className="fp_rc-overlay" onClick={onClose}>
      <aside className="fp_rc-panel" onClick={(e) => e.stopPropagation()}>
        <header className="fp_rc-header">
          <div>
            <h3>Generate Rate Confirmation</h3>
            <div className="fp_rc-sub">Create and send a digital RC linked to a load and carrier</div>
          </div>
          <button className="fp_rc-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="fp_rc-body">
          <section className="fp_rc-card">
            <h4 className="fp_rc-card-title">Load &amp; Carrier Details</h4>
            <div className="fp_rc-grid">
              <label>
                <div className="fp_rc-label">Load #</div>
                <input className="fp_rc-input" defaultValue="8429" />
              </label>
              <label>
                <div className="fp_rc-label">Carrier</div>
                <select className="fp_rc-input">
                  <option>Prime Logistics</option>
                  <option>FedEx Logistics</option>
                </select>
              </label>
              <label>
                <div className="fp_rc-label">MC Number</div>
                <input className="fp_rc-input" defaultValue="MC-785421" />
              </label>
              <label>
                <div className="fp_rc-label">DOT Number</div>
                <input className="fp_rc-input" defaultValue="DOT-2145789" />
              </label>
            </div>
          </section>

          <section className="fp_rc-card">
            <h4 className="fp_rc-card-title">Route &amp; Pricing</h4>
            <div className="fp_rc-grid-col">
              <label>
                <div className="fp_rc-label">Pickup Location</div>
                <input className="fp_rc-input" defaultValue="Chicago, IL - ABC Manufacturing" />
              </label>
              <label>
                <div className="fp_rc-label">Delivery Location</div>
                <input className="fp_rc-input" defaultValue="Dallas, TX - XYZ Distribution" />
              </label>
            </div>
            <div className="fp_rc-row">
              <label>
                <div className="fp_rc-label">Base Rate</div>
                <input className="fp_rc-input" defaultValue="$3,500" />
              </label>
              <label>
                <div className="fp_rc-label">Accessorials</div>
                <input className="fp_rc-input" defaultValue="$630" />
              </label>
            </div>
          </section>

          <section className="fp_rc-summary fp_rc-card">
            <h4 className="fp_rc-card-title">Rate Confirmation Summary</h4>
            <div className="fp_rc-summary-inner">
              <div className="fp_rc-summary-left">
                <div className="fp_rc-small">Load #:</div>
                <div className="fp_rc-strong">8429</div>
              </div>
              <div className="fp_rc-summary-left">
                <div className="fp_rc-small">Carrier:</div>
                <div className="fp_rc-strong">Prime Logistics</div>
              </div>
              <div className="fp_rc-summary-left">
                <div className="fp_rc-small">Total:</div>
                <div className="fp_rc-total">$4,130</div>
              </div>
              <div className="fp_rc-summary-left">
                <div className="fp_rc-small">Terms:</div>
                <div className="fp_rc-strong">Net 14</div>
              </div>
              <div className="fp_rc-factoring">Factoring: Apex Financial</div>
            </div>
          </section>

          <div className="fp_rc-actions">
            <button className="btn small ghost-cd">Preview PDF</button>
            <button className="btn small-cd">Generate &amp; Send</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
