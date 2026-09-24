import { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * Modal renderizado via React Portal directamente en document.body.
 * Garantiza que el modal siempre aparezca centrado en el viewport,
 * sin importar el scroll ni el CSS del árbol padre.
 */
export default function Modal({ onClose, children, maxWidth = 600 }) {
  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Cerrar con ESC
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position:        'fixed',
        top:             0,
        left:            0,
        right:           0,
        bottom:          0,
        background:      'rgba(0,0,0,0.45)',
        backdropFilter:  'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex:          99999,
        display:         'flex',
        alignItems:      'flex-start',
        justifyContent:  'center',
        padding:         '48px 20px 24px',
        overflowY:       'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
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
