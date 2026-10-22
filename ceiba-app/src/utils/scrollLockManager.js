/**
 * CeibaApp Global Scroll Lock Manager
 * Garantiza de forma 100% infalible que el scroll de la aplicación NUNCA se tranque,
 * incluso al abrir múltiples modales anidados, cambiar de pestaña o cerrar ventanas.
 */

let activeModalCount = 0;

/**
 * Bloquea el scroll del fondo cuando un modal se abre.
 * Maneja conteo de referencias para modales anidados.
 */
export function lockBodyScroll() {
  activeModalCount++;
  if (typeof document !== 'undefined') {
    if (activeModalCount === 1) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }
}

/**
 * Desbloquea el scroll del fondo cuando un modal se cierra.
 * Si no quedan modales abiertos, limpia totalmente los estilos de overflow.
 */
export function unlockBodyScroll(force = false) {
  if (force) {
    activeModalCount = 0;
  } else {
    activeModalCount = Math.max(0, activeModalCount - 1);
  }

  if (activeModalCount === 0 || force) {
    activeModalCount = 0;
    if (typeof document !== 'undefined') {
      try {
        document.body.style.removeProperty('overflow');
        document.documentElement.style.removeProperty('overflow');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      } catch (e) {
        // Fallback defensivo
        if (document.body) document.body.style.overflow = '';
        if (document.documentElement) document.documentElement.style.overflow = '';
      }
    }
  }
}

/**
 * Comprueba en el DOM real si queda algún modal visible.
 * Si no hay ningún modal en pantalla, fuerza el desbloqueo del scroll.
 */
export function ensureScrollUnlocked() {
  if (typeof document === 'undefined') return;
  try {
    const activeModals = document.querySelectorAll('.modal-portal-overlay, [data-modal-portal="true"]');
    if (!activeModals || activeModals.length === 0) {
      unlockBodyScroll(true);
    }
  } catch (e) {
    unlockBodyScroll(true);
  }
}

// ── PROTECCIÓN PROACTIVA EN TIEMPO REAL ──
if (typeof window !== 'undefined') {
  // 1. Al detectar intento de scroll (rueda o touch) en la página:
  // Si el body o html tiene overflow hidden pero NO hay modales en el DOM, desbloquear de inmediato.
  const handleUserScrollIntent = () => {
    if (
      document.body?.style?.overflow === 'hidden' ||
      document.documentElement?.style?.overflow === 'hidden'
    ) {
      const modal = document.querySelector('.modal-portal-overlay, [data-modal-portal="true"]');
      if (!modal) {
        unlockBodyScroll(true);
      }
    }
  };

  window.addEventListener('wheel', handleUserScrollIntent, { passive: true });
  window.addEventListener('touchmove', handleUserScrollIntent, { passive: true });
  window.addEventListener('focus', ensureScrollUnlocked, { passive: true });
  window.addEventListener('popstate', ensureScrollUnlocked, { passive: true });

  // 2. Al cambiar visibilidad de pestaña
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ensureScrollUnlocked();
    }
  });

  // 3. Al presionar Escape, rechequear en el siguiente ciclo
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setTimeout(ensureScrollUnlocked, 100);
    }
  }, { passive: true });
}
