import React, { useState } from 'react';
import '../../styles/shipper/CreateInvoice.css';
import InvoicePreview from './InvoicePreview';

export default function CreateInvoice({ onClose }) {
  const [showPreview, setShowPreview] = useState(false);

  function openPreview() {
    setShowPreview(true);
  }

  function closePreview() {
    setShowPreview(false);
  }

  return (
    <div className="create-invoice-overlay" onClick={onClose}>
      <div className="create-invoice-modal" onClick={(e) => e.stopPropagation()}>
        <button className="create-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="create-invoice-page">
          <div className="create-invoice-main">
            <div className="create-invoice-left card">
          <div className="create-header">
            <div>
              <h2 className='create-header-heading'>Create Invoice</h2>
              <div className="create-subtitle">Generate and send an invoice linked to a load and supporting documents</div>
            </div>
            <div className="create-actions">
              <button className="btn small ghost-cd" onClick={(e) => { e.stopPropagation(); openPreview(); }}>Preview PDF</button>
              <button className="btn small ghost-cd">Save Draft</button>
              <button className="btn small-cd">Create & Send Invoice</button>
            </div>
          </div>

          <div className="ai-suggestion ai-suggestion-teal">
            <div className="ai-left">
              <div>
                <div className="muted-ai-sugg">AI Suggestion</div>
                <div className="ai-box-small">Load #8237 (FedEx Logistics) delivered yesterday with POD attached. Create invoice?</div>
              </div>
            </div>
            <div>
              <button className="btn small ghost-cd dd-btn">Yes</button>
            </div>
          </div>

          <section className="form-section">
            <h4 className='sub-heading-create'>Load & Partner Information</h4>
            <div className="grid-2">
              <div>
                <label>Load #</label>
                <input className="search-input" placeholder="Search loads..." />
              </div>
              <div>
                <label>Partner</label>
                <input className="partner-input" placeholder="Partner name" />
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label>Invoice #</label>
                <input defaultValue="INV-2101" />
              </div>
              <div>
                <label>Invoice Date</label>
                <input type="date" />
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label>Due Date</label>
                <input type="date" />
              </div>
              <div>
                <label>Payment Terms</label>
                <select>
                  <option>Net 30</option>
                  <option>Net 15</option>
                </select>
              </div>
            </div>

            <div style={{marginTop:8}}>
              <label className='heading-pay'>Payment Method</label>
              <div className="payment-method">
                <label><input type="radio" name="payment" defaultChecked /> ACH</label>
                <label><input type="radio" name="payment" /> Factoring</label>
                <label><input type="radio" name="payment" /> Check</label>
                <label><input type="radio" name="payment" /> Manual</label>
              </div>
            </div>

            <h4 className='sub-heading-create'>Line Items & Charges</h4>

            <div className="line-items-grid">
              <div className="line-items-left">
                <div className="line-headers-left">Line Item</div>
                <div className="line-left-row"><input placeholder="Line Haul" /></div>
                <div className="line-left-row"><input placeholder="Fuel Surcharge" /></div>
                <div className="add-line">+ Add Line Item</div>
              </div>

              <div className="line-items-right">
                <div className="amount-heading">Amount</div>
                <div className="line-right-row"><input className="amount-input" placeholder="$3,600.00" /></div>
                <div className="line-right-row"><input className="amount-input" placeholder="$380.00" /></div>
              </div>
            </div>

            <h4 className='sub-heading-create'>Attach Documents</h4>
            <div className="attach-cards">
              <div className="doc-card">
                <div className="doc-left">
                  <div className="doc-title">POD</div>
                  <div className="doc-meta">Document Vault</div>
                  <a href="#" className="doc-action">View</a>
                </div>
                <div className="doc-right">
                  <div className="int-status-badge Verified">Verified</div>
                </div>
              </div>

              <div className="doc-card">
                <div className="doc-left">
                  <div className="doc-title">Rate Confirmation</div>
                  <div className="doc-meta">Document Vault</div>
                  <a href="#" className="doc-action">View</a>
                </div>
                <div className="doc-right">
                  <div className="int-status-badge active">Linked</div>
                </div>
              </div>

              <div className="doc-card">
                <div className="doc-left">
                  <div className="doc-title">BOL</div>
                  <div className="doc-meta">—</div>
                  <a href="#" className="doc-action">Upload</a>
                </div>
                <div className="doc-right">
                  <div className="int-status-badge warning">Missing</div>
                </div>
              </div>
            </div>

            <div className="vault-row">
              <a href="#" className="vault-link">Open Folder in Vault</a>
              <label className="auto-link"><input type="checkbox" defaultChecked/><span>Auto-link by Load #</span></label>
            </div>

            <h4 className='sub-heading-create'>Notes & Terms</h4>
            <textarea className="notes-textarea" placeholder="Add optional message (e.g., Thank you for your business)"></textarea>

            <div className="small-muted">Internal Tags (Optional)</div>
            <input className="internal-tags" placeholder="e.g., Accounting Batch #" />
          </section>
        </div>

        <aside className="create-invoice-right">
          <div className="card invoice-summary">
            <h4 className='sub-heading-create'>Invoice Summary</h4>
            <div className="summary-row"><div className="muted">Partner</div><div>FedEx Logistics</div></div>
            <div className="summary-row"><div className="muted">Load #</div><div>8237</div></div>
            <div className="summary-row"><div className="muted">Subtotal</div><div>$3,600.00</div></div>
            <div className="summary-row"><div className="muted">Accessorials</div><div>$380.00</div></div>
            <div className="summary-total"><div>Total</div><div className="total-amount">$3,980.00</div></div>

            <div className="muted small">Payment Terms</div>
            <div className="muted small">Due Date: Nov 7, 2025</div>

            <div className="checkbox-row">
              <label className="checkbox-inline"><input type="checkbox" defaultChecked /><span>Auto-Save Copy to Vault</span></label>
              <label className="checkbox-inline"><input type="checkbox" defaultChecked /><span>Auto-Send to Factoring Partner (Apex)</span></label>
              <label className="checkbox-inline"><input type="checkbox" defaultChecked /><span>Auto-Sync to QuickBooks</span></label>
            </div>

            <div className="send-settings">
              <div className="muted">Send Settings</div>
              <label><input type="radio" name="send" /> Send Via Email</label>
              <label><input type="radio" name="send" /> In-App Delivery</label>
              <label><input type="radio" name="send" defaultChecked /> Both</label>
            </div>

            <div className="recipient">
              <div className="muted">Recipient</div>
              <input className="recipient-input" defaultValue="logistics@fedex.com" />
            </div>

            <div className="recipient">
              <div className="muted">Email Subject</div>
              <input className="recipient-input" defaultValue={`Invoice INV-2101 from FreightPower AI`} />
            </div>

            <div className="green-box success">
              <div className="success-inner">
                <div>
                  <div className="success-title">All required fields complete</div>
                  <div className="success-body">POD verified. Rate Confirmation attached. Ready to send to Apex Factoring.</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
          </div>
          {showPreview && <InvoicePreview invoice={{}} onClose={closePreview} />}
        </div>
      </div>
    </div>
  );
}
