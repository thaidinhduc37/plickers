/**
 * src/components/Toast.jsx
 * Component hiển thị toast notification chuyên nghiệp
 */
import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const toastStyles = {
  success: {
    bg: '#ecfdf5',
    border: '#d1fae5',
    text: '#065f46',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  error: {
    bg: '#fef2f2',
    border: '#fee2e2',
    text: '#991b1b',
    icon: <AlertCircle className="w-5 h-5" />,
  },
  info: {
    bg: '#eff6ff',
    border: '#dbeafe',
    text: '#0c2d6b',
    icon: <Info className="w-5 h-5" />,
  },
};

export function Toast({ type = 'info', message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const style = toastStyles[type] || toastStyles.info;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{
        backgroundColor: style.bg,
        borderLeftWidth: '4px',
        borderLeftColor: Object.values(style)[3]
          ? '#10509F'
          : style.text,
      }}
    >
      <div className="px-5 py-4 flex items-center gap-3">
        <div style={{ color: style.text }}>{style.icon}</div>
        <p style={{ color: style.text }} className="text-sm font-medium">
          {message}
        </p>
        <button
          onClick={onClose}
          className="ml-2 p-1 hover:bg-black/5 rounded-md transition-colors"
        >
          <X className="w-4 h-4" style={{ color: style.text }} />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer({ toast, onClose }) {
  if (!toast) return null;
  return <Toast type={toast.type} message={toast.message} onClose={onClose} />;
}
