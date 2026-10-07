import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, { tone = 'default', duration = 3500 } = {}) => {
      const id = ++counter.current
      setToasts((list) => [...list, { id, message, tone }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              'w-full max-w-md rounded-[var(--radius-md)] px-4 py-3.5 text-sm font-semibold shadow-[0_10px_28px_rgba(28,25,23,0.18)] ' +
              (t.tone === 'error'
                ? 'bg-danger-600 text-white'
                : t.tone === 'warn'
                  ? 'bg-warn-500 text-white'
                  : t.tone === 'success'
                    ? 'bg-ok-600 text-white'
                    : 'bg-slate-900 text-white')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
