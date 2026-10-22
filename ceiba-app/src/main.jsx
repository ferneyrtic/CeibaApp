import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import './index.css';
import App from './App.jsx';

// Parche defensivo para extensiones de navegador y Google Translate (React issue #11538)
// Evita el error fatal: "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node"
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Protección DOM CeibaApp: removeChild interceptado (nodo huérfano o modificado por traducción/extensión)', this, child);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Protección DOM CeibaApp: insertBefore interceptado (referencia no coincide con padre)', this, referenceNode);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
);
