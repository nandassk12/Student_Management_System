import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ─── Close (X) icon ───────────────────────────────────────────────────────────
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

// ─── Size map ─────────────────────────────────────────────────────────────────
const SIZE_MAP = {
  sm:  '400px',
  md:  '520px',
  lg:  '680px',
  xl:  '860px',
  full:'95vw',
}

// ─── Modal ────────────────────────────────────────────────────────────────────
/**
 * Props:
 *  - isOpen      {boolean}   — controls visibility
 *  - onClose     {function}  — called when backdrop or X is clicked
 *  - title       {string}    — modal header title
 *  - description {string}    — optional subtitle below title
 *  - children    {ReactNode} — modal body content
 *  - footer      {ReactNode} — optional footer (action buttons etc.)
 *  - size        {'sm'|'md'|'lg'|'xl'|'full'} — default 'md'
 *  - closable    {boolean}   — show close button, default true
 *  - closeOnBackdrop {boolean} — default true
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size          = 'md',
  closable      = true,
  closeOnBackdrop = true,
}) {
  const overlayRef = useRef(null)
  const contentRef = useRef(null)

  // ── Close on Escape key ────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closable) onClose?.()
  }, [closable, onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll while modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  // ── Focus trap: focus first focusable element on open ─────────────────────
  useEffect(() => {
    if (isOpen && contentRef.current) {
      const focusable = contentRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length) focusable[0].focus()
    }
  }, [isOpen])

  // ── Backdrop click ────────────────────────────────────────────────────────
  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === overlayRef.current) {
      onClose?.()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'modal-backdrop-in 150ms ease-out both',
      }}
    >
      {/* ── Modal card ── */}
      <div
        ref={contentRef}
        style={{
          background: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 20px 60px -10px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.12)',
          width: '100%',
          maxWidth: SIZE_MAP[size] ?? SIZE_MAP.md,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modal-card-in 150ms ease-out both',
          fontFamily: "'Inter', system-ui, sans-serif",
          overflow: 'hidden',
        }}
      >

        {/* ── Header ── */}
        {(title || closable) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1.375rem 1.5rem 1.125rem',
              borderBottom: children ? '1px solid #f1f5f9' : 'none',
              flexShrink: 0,
            }}
          >
            <div>
              {title && (
                <h2
                  id="modal-title"
                  style={{
                    margin: 0,
                    fontSize: '1.0625rem',
                    fontWeight: '700',
                    color: '#0f172a',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.25,
                  }}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontSize: '0.875rem',
                    color: '#64748b',
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </p>
              )}
            </div>

            {/* Close button */}
            {closable && (
              <button
                id="modal-close"
                onClick={onClose}
                aria-label="Close modal"
                style={{
                  flexShrink: 0,
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'background 150ms, color 150ms, border-color 150ms',
                  marginTop: '-2px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background   = '#fee2e2'
                  e.currentTarget.style.color        = '#dc2626'
                  e.currentTarget.style.borderColor  = '#fecaca'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background  = '#f8fafc'
                  e.currentTarget.style.color       = '#64748b'
                  e.currentTarget.style.borderColor = '#e2e8f0'
                }}
              >
                <CloseIcon />
              </button>
            )}
          </div>
        )}

        {/* ── Body ── */}
        {children && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem 1.5rem',
              scrollbarWidth: 'thin',
            }}
          >
            {children}
          </div>
        )}

        {/* ── Footer ── */}
        {footer && (
          <div
            style={{
              padding: '1rem 1.5rem 1.25rem',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.625rem',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            {footer}
          </div>
        )}
      </div>

      {/* ── Animation keyframes injected once ── */}
      <style>{`
        @keyframes modal-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modal-card-in {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>,
    document.body
  )
}

// ─── Confirm Modal convenience wrapper ───────────────────────────────────────
/**
 * Usage:
 *   <ConfirmModal
 *     isOpen={showConfirm}
 *     onClose={() => setShowConfirm(false)}
 *     onConfirm={handleDelete}
 *     title="Delete Student"
 *     message="Are you sure? This action cannot be undone."
 *     confirmLabel="Delete"
 *     danger
 *   />
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title        = 'Are you sure?',
  message      = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  danger       = false,
  loading      = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            id="confirm-modal-cancel"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.5rem 1.125rem',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: 'background 150ms',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#f8fafc' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff' }}
          >
            {cancelLabel}
          </button>

          <button
            id="confirm-modal-confirm"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '0.5rem 1.125rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: danger ? '#dc2626' : '#1e3a5f',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: 'background 150ms, transform 0.1s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = danger ? '#b91c1c' : '#0f172a' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = danger ? '#dc2626' : '#1e3a5f' }}
            onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.97)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: '0.9375rem', color: '#475569', lineHeight: 1.6 }}>
        {message}
      </p>
    </Modal>
  )
}
