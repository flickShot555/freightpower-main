import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../config'; 

export default function DocumentScanner({ onScanComplete }) {
  const { currentUser } = useAuth();
  const [file, setFile] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError('');
    setScanResult(null);
  };

  const handleScan = async () => {
    if (!file) return setError("Please select a PDF or Image first.");
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // 1. Get Firebase Token for Security
      const token = await currentUser.getIdToken();

      // 2. Call Python Backend (OCR + Classification + Scoring)
      const response = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}` 
        },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Scan failed");
      }

      const data = await response.json();
      setScanResult(data);
      if (onScanComplete) onScanComplete(data); // Update parent component if needed

    } catch (err) {
      console.error(err);
      setError("Failed to scan document. Ensure the backend is running.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>📄</span> Smart Document Upload
      </h2>

      {/* Upload Area */}
      <div className="mb-6 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center hover:bg-gray-100 transition-colors">
        <input 
          type="file" 
          accept=".pdf,image/*" 
          onChange={handleFileChange}
          className="hidden" 
          id="doc-upload"
        />
        <label htmlFor="doc-upload" className="cursor-pointer block">
          <div className="text-4xl mb-2">☁️</div>
          <div className="font-semibold text-gray-700">Click to upload (PDF/Image)</div>
          <div className="text-xs text-gray-500 mt-1">Supports COI, CDL, W-9, Authority</div>
        </label>
        {file && <div className="mt-3 text-sm font-bold text-blue-600">Selected: {file.name}</div>}
      </div>

      {/* Scan Button */}
      <button
        onClick={handleScan}
        disabled={!file || loading}
        className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
      >
        {loading ? "Analyzing with AI..." : "Scan & Verify"}
      </button>

      {error && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}

      {/* --- AI RESULTS DISPLAY --- */}
      {scanResult && (
        <div className="mt-8 border-t pt-6 animate-fade-in">
          
          {/* Header: Type & Score */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Detected Type</p>
              <h3 className="text-2xl font-bold text-slate-800">{scanResult.doc_type}</h3>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                Confidence: {(scanResult.confidence * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Onboarding Score</p>
              <div className={`text-4xl font-bold ${
                scanResult.score.total >= 80 ? 'text-green-600' : 
                scanResult.score.total >= 50 ? 'text-amber-500' : 'text-red-500'
              }`}>
                {scanResult.score.total}
              </div>
            </div>
          </div>

          {/* Validation Issues */}
          {scanResult.validation?.issues?.length > 0 ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <h4 className="font-bold text-red-700 text-sm mb-2">⚠️ Compliance Issues:</h4>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                {scanResult.validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 text-green-700 text-sm font-medium flex items-center gap-2">
              <span>✅</span> Document is valid and compliant.
            </div>
          )}

          {/* Extracted Data Fields */}
          <div>
            <h4 className="font-bold text-gray-700 mb-3 text-sm">Extracted Data</h4>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
              {Object.entries(scanResult.extraction).map(([key, value]) => {
                // Filter out complex objects, show only simple fields
                if (typeof value === 'object' || !value) return null;
                return (
                  <div key={key} className="overflow-hidden">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm font-medium text-gray-800 truncate" title={value}>{value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}