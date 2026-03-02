import React, { useEffect } from 'react';

export default function Toast({ message, type = 'info', durationMs = 2500, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onClose]);

  if (!message) return null;

  const bg = type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#e0f2fe';
  const border = type === 'error' ? '#fecaca' : type === 'success' ? '#bbf7d0' : '#bae6fd';
  const color = type === 'error' ? '#991b1b' : type === 'success' ? '#166534' : '#075985';

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        background: bg,
        border: `1px solid ${border}`,
        color,
        padding: '10px 14px',
        borderRadius: 10,
        boxShadow: '0 10px 25px rgba(16,24,40,0.12)',
        minWidth: 260,
        textAlign: 'center',
        fontWeight: 600,
      }}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
