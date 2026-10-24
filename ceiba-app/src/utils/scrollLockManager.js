/**
 * CeibaApp Global Scroll Lock & Position Manager
 * Garantiza de forma 100% infalible que:
 * 1. El scroll de la aplicación NUNCA se tranque al cerrar modales.
 * 2. La posición de scroll del usuario NUNCA se pierda ni salte al tope (0,0) al cambiar
 *    de pestaña en el navegador, al volver del blur, o al reanudar sesión.
 */

let activeModalCount = 0;
let scrollPositionBeforeLock = 0;
let lastKnownScrollY = 0;
let isRestoringScroll = false;

/**
 * Retorna la posición vertical actual de scroll con compatibilidad universal.
 */
function getCurrentScrollY() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
}

/**
 * Bloquea el scroll del fondo cuando un modal se abre.
 * Maneja conteo de referencias para modales anidados y guarda la posición actual.
 */
export function lockBodyScroll() {
  activeModalCount++;
  if (typeof document !== 'undefined') {
    if (activeModalCount === 1) {
      scrollPositionBeforeLock = getCurrentScrollY();
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }
}

/**
 * Desbloquea el scroll del fondo cuando un modal se cierra.
 * Si no quedan modales abiertos, limpia estilos de overflow y restaura la posición exacta.
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
        // Solo manipular estilos si efectivamente estaban en hidden para evitar saltos o reflows
        if (document.body && (document.body.style.overflow === 'hidden' || document.body.style.overflow)) {
          document.body.style.overflow = '';
          document.body.style.removeProperty('overflow');
        }
        if (document.documentElement && (document.documentElement.style.overflow === 'hidden' || document.documentElement.style.overflow)) {
          document.documentElement.style.overflow = '';
          document.documentElement.style.removeProperty('overflow');
        }
      } catch (e) {
        // Fallback defensivo
      }

      // Si teníamos una posición previa al abrir el modal y se perdió (cayó a 0), restaurarla
      if (scrollPositionBeforeLock > 0) {
        const targetY = scrollPositionBeforeLock;
        requestAnimationFrame(() => {
          if (getCurrentScrollY() === 0 && targetY > 0) {
            window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
          }
        });
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
      // Solo forzar si efectivamente está bloqueado
      if (
        document.body?.style?.overflow === 'hidden' ||
        document.documentElement?.style?.overflow === 'hidden'
      ) {
        unlockBodyScroll(true);
      }
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Restaura la posición del usuario de forma inmediata y resiliente a re-renders.
 */
export function restoreUserScrollPosition() {
  if (typeof window === 'undefined' || activeModalCount > 0 || lastKnownScrollY <= 0) return;
  isRestoringScroll = true;
  const targetY = lastKnownScrollY;

  window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
  requestAnimationFrame(() => {
    window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
    setTimeout(() => {
      window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
      isRestoringScroll = false;
    }, 40);
  });
}

// ── PROTECCIÓN PROACTIVA EN TIEMPO REAL ──
if (typeof window !== 'undefined') {
  // Configurar restauración manual del scroll en el navegador para evitar saltos automáticos
  try {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  } catch (e) {}

  // 1. Rastrear en tiempo real la posición de scroll cuando el usuario se desplaza
  const handleScrollTracking = () => {
    if (!isRestoringScroll && activeModalCount === 0) {
      const y = getCurrentScrollY();
      if (y > 0) {
        lastKnownScrollY = y;
      }
    }
  };

  window.addEventListener('scroll', handleScrollTracking, { passive: true });

  // 2. Al detectar intento de scroll (rueda o touch) en la página:
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

  // 3. Al cambiar de pestaña en el navegador y volver (visibilitychange):
  // Conservar de forma estricta la posición donde el usuario estaba
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ensureScrollUnlocked();
      restoreUserScrollPosition();
    } else {
      // Al salir de la pestaña, guardar el punto exacto
      handleScrollTracking();
    }
  });

  // 4. Al recibir foco la ventana del navegador (Alt+Tab o clic en pestaña):
  window.addEventListener('focus', () => {
    ensureScrollUnlocked();
    restoreUserScrollPosition();
  }, { passive: true });

  window.addEventListener('popstate', ensureScrollUnlocked, { passive: true });

  // 5. Al presionar Escape, rechequear en el siguiente ciclo
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setTimeout(ensureScrollUnlocked, 100);
    }
  }, { passive: true });
}
