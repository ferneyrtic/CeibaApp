import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error global capturado en GlobalErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: 24,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '36px 32px',
            maxWidth: 520,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #fee2e2'
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertTriangle size={32} color="#dc2626" />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#991b1b', marginBottom: 8 }}>
              Se produjo un error inesperado
            </h2>

            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
              Ocurrió un problema temporal al renderizar la vista. Tus datos y registros están seguros en el servidor.
            </p>

            {this.state.error?.message && (
              <div style={{
                background: '#f1f5f9',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 11.5,
                color: '#475569',
                fontFamily: 'monospace',
                textAlign: 'left',
                marginBottom: 24,
                overflowX: 'auto',
                border: '1px solid #e2e8f0'
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                }}
              >
                <RefreshCw size={15} /> Recargar Sistema
              </button>

              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                style={{
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Home size={15} /> Ir al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
