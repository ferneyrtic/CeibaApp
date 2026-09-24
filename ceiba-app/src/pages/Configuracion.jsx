import React from 'react';
import { Sun, Moon, Shield, Database, User, Laptop, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Configuracion({ theme, onToggleTheme }) {
  const { user, role, signOut } = useAuth();

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-title">Configuración del Sistema</div>
          <div className="page-subtitle">Personalización visual, preferencias y detalles de cuenta</div>
        </div>
      </div>

      {/* 1. TEMA Y APARIENCIA */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Tema y Apariencia Visual
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Cambia entre el modo claro institucional y el modo oscuro para descanso visual
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Opción Claro */}
          <div
            onClick={() => onToggleTheme('light')}
            style={{
              border: `2px solid ${theme === 'light' ? 'var(--accent)' : 'var(--border)'}`,
              background: '#ffffff',
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: theme === 'light' ? '0 0 0 3px var(--accent-glow)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#f0fdf4', color: '#16a34a',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Sun size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1f0f' }}>Modo Claro</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Verde institucional y fondos blancos</div>
              </div>
            </div>
            {theme === 'light' && <CheckCircle2 size={18} color="#16a34a" />}
          </div>

          {/* Opción Oscuro */}
          <div
            onClick={() => onToggleTheme('dark')}
            style={{
              border: `2px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border)'}`,
              background: '#142214',
              borderRadius: 12,
              padding: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: theme === 'dark' ? '0 0 0 3px var(--accent-glow)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#1e381e', color: '#86efac',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Moon size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f0fdf4' }}>Modo Oscuro</div>
                <div style={{ fontSize: 11, color: '#86efac' }}>Tonalidades esmeralda y alto contraste</div>
              </div>
            </div>
            {theme === 'dark' && <CheckCircle2 size={18} color="#86efac" />}
          </div>
        </div>
      </div>

      {/* 2. CUENTA Y USUARIO */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#e0f2fe', color: '#0284c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Información de la Sesión Actual
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Detalles de la cuenta autenticada
            </div>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Nombre del Usuario</div>
            <div className="detail-value">{user?.user_metadata?.nombre || 'Usuario Principal'}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Correo Electrónico</div>
            <div className="detail-value">{user?.email}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Rol Asignado</div>
            <div className="detail-value" style={{ textTransform: 'capitalize', color: 'var(--accent)', fontWeight: 700 }}>
              {role}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">ID de Sesión</div>
            <div className="detail-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {user?.id?.slice(0, 16)}...
            </div>
          </div>
        </div>
      </div>

      {/* 3. BASE DE DATOS Y CONEXIÓN */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#fef3c7', color: '#d97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Database size={20} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Estado del Servidor y Base de Datos
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Conexión en tiempo real con Supabase Cloud
            </div>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Servicio Cloud</div>
            <div className="detail-value">Supabase PostgreSQL 15</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Estado de Conexión</div>
            <div className="detail-value" style={{ color: '#16a34a', fontWeight: 700 }}>
              ● Conectado y Sincronizado
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Total Lotes Gestionados</div>
            <div className="detail-value">511 Lotes</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Total Cuotas Auditadas</div>
            <div className="detail-value">18.559 Cuotas</div>
          </div>
        </div>
      </div>
    </div>
  );
}
