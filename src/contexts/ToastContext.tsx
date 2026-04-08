import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

const TOAST_DURATION = 3000;
const EXIT_DURATION = 400;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    // Đánh dấu "exiting" để chạy animation trượt ra
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    // Xóa hẳn sau khi animation xong
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_DURATION);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
      setTimeout(() => removeToast(id), TOAST_DURATION);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="fixed top-24 right-4 md:right-6 z-[200] flex flex-col gap-2.5 pointer-events-none w-[calc(100vw-2rem)] max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              animation: toast.exiting
                ? `toastSlideOut ${EXIT_DURATION}ms cubic-bezier(0.4,0,1,1) forwards`
                : 'toastSlideIn 350ms cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl pointer-events-auto
              border backdrop-blur-sm
              ${toast.type === 'success'
                ? 'bg-[#0d9e6e] border-[#10B981]/40 text-white'
                : toast.type === 'error'
                ? 'bg-[#c2000b] border-[#E50914]/40 text-white'
                : 'bg-[#1e1e1e] border-white/10 text-white'
              }
            `}
          >
            {/* Icon */}
            <span className="flex-shrink-0">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-white" />}
              {toast.type === 'error'   && <XCircle    className="w-5 h-5 text-white" />}
              {toast.type === 'info'    && <Info        className="w-5 h-5 text-blue-400" />}
            </span>

            {/* Message */}
            <span className="font-medium text-sm flex-1 leading-snug">{toast.message}</span>

            {/* Nút đóng thủ công */}
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 rounded-full hover:bg-white/15 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/70" />
            </button>

            {/* Progress bar */}
            <span
              className="absolute bottom-0 left-0 h-[3px] rounded-b-xl bg-white/30"
              style={{ animation: `toastProgress ${TOAST_DURATION}ms linear forwards` }}
            />
          </div>
        ))}
      </div>

      {/* Keyframes nhúng inline để không phụ thuộc vào globals.css */}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(110%) scale(0.92); }
          to   { opacity: 1; transform: translateX(0%)   scale(1);    }
        }
        @keyframes toastSlideOut {
          from { opacity: 1; transform: translateX(0%)   scale(1);    }
          to   { opacity: 0; transform: translateX(110%) scale(0.92); }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%;   }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
