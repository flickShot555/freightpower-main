import React from 'react';
import '../../styles/admin/DocumentVault.css';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config';

export default function AdminDocumentVault() {
  const { currentUser } = useAuth();
  const fileInputRef = React.useRef(null);

  const handleUploadClick = () => {
    if (!currentUser) {
      alert('Please sign in to upload documents.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_URL}/documents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          alert(`Document "${file.name}" uploaded successfully!`);
        } else {
          let errorDetail = 'Unknown error';
          try {
            const error = await response.json();
            errorDetail = error?.detail || error?.message || errorDetail;
          } catch (_) {
            // ignore
          }
          alert(`Failed to upload "${file.name}": ${errorDetail}`);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="dv-root admin-dv">
      <header className="fp-header">
        <div className="fp-header-titles">
          <h2>Documents</h2>
        </div>
      </header>

      <div className="dv-top-row">
        <div className="dv-controls">
          <div className="dv-search">
            <input placeholder="Search documents (OCR-enabled)" />
          </div>
          <button className="btn small ghost-cd">Filters</button>
          <button className="btn small ghost-cd">Auto-Organize</button>
          <button className="btn small-cd" type="button" onClick={handleUploadClick}>+ Upload</button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileUpload}
        aria-label="Upload documents"
      />

      <div className="dv-table-wrap">
        <table className="dv-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Tenant</th>
              <th>Type</th>
              <th>Status</th>
              <th>Expiry</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><i className="fa-regular fa-file-pdf file-ic pdf" /> <strong>insurance_certificate.pdf</strong></td>
              <td>Alpha Freight</td>
              <td>Carrier Insurance</td>
              <td><span className="int-status-badge active">Verified</span></td>
              <td>2025-11-01</td>
              <td><i className='fa-solid fa-ellipsis-h'></i></td>
            </tr>

            <tr>
              <td><i className="fa-regular fa-file-pdf file-ic pdf" /> <strong>mvr_report.pdf</strong></td>
              <td>John Doe</td>
              <td>Driver MVR</td>
              <td><span className="int-status-badge warning">Expiring</span></td>
              <td>2025-10-20</td>
              <td><i className='fa-solid fa-ellipsis-h'></i></td>
            </tr>

            <tr>
              <td><i className="fa-regular fa-file-word file-ic doc" /> <strong>broker_contract.docx</strong></td>
              <td>Midwest Logistics</td>
              <td>Agreement</td>
              <td><span className="int-status-badge pending">Pending</span></td>
              <td>—</td>
              <td><i className='fa-solid fa-ellipsis-h'></i></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
