import React from 'react';
import { useApp } from '../context/AppContext';
import { X } from 'lucide-react';

export default function ToastContainer() {
  const { state, dispatch } = useApp();

  if (state.toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {state.toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.itemType || 'info'}`}>
          <span className="toast-icon">{toast.icon}</span>
          <span className="toast-message">{toast.message}</span>
          <button
            className="toast-close"
            onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: toast.id })}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
