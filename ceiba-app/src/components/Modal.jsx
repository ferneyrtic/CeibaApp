import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { lockBodyScroll, unlockBodyScroll, ensureScrollUnlocked } from '../utils/scrollLockManager';

/**
 * Modal renderizado via React Portal directamente en document.body.
 * Garantiza que el modal siempre aparezca centrado en el viewport,
 * sin importar el scroll ni el CSS del árbol padre.
 */
export default function Modal({ onClose, children, maxWidth = 600, zIndex = 99999 }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Gestión robusta del scroll: conteo de referencias y prevención de trancas
  useEffect(() => {
    lockBodyScroll();

    // Cerrar con ESC con referencia estable
    const onKey = (e) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      unlockBodyScroll();
      // Verificación de seguridad inmediata para evitar scroll congelado
      setTimeout(ensureScrollUnlocked, 10);
    };
  }, []);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      className="modal-portal-overlay"
      data-modal-portal="true"
      style={{
        position:        'fixed',
        top:             0,
        left:            0,
        right:           0,
        bottom:          0,
        background:      'rgba(0,0,0,0.45)',
        backdropFilter:  'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex:          zIndex,
        display:         'flex',
        alignItems:      'flex-start',
        justifyContent:  'center',
        padding:         '48px 20px 24px',
        overflowY:       'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="modal-portal-content modal"
        style={{
          background:    'var(--bg-card)',
          border:        '1px solid var(--border-light)',
          borderRadius:  'var(--radius-lg)',
          padding:       '28px 32px',
          maxWidth:      maxWidth,
          width:         '100%',
          boxShadow:     'var(--shadow-lg)',
          animation:     'modalIn 0.18s ease',
          flexShrink:    0,
          margin:        'auto 0',
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
