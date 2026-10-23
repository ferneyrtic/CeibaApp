import React, { useState, useEffect } from 'react';
import {
  Sun, Moon, Shield, Database, User, CheckCircle2, XCircle,
  Lock, Save, RotateCcw, AlertTriangle, Sparkles, Check, Key
} from 'lucide-react';
import { useAuth, ROLE_PERMISSIONS } from '../context/AuthContext';
import { PERMISSION_CATALOG } from '../lib/api/permisosApi';

export default function Configuracion({ theme, onToggleTheme }) {
  const {
    user,
    role,
    roleInfo,
    permissions,
    customPermissions,
    updatePermissionsForRole,
    resetPermissionsForRole,
    canManagePermissions,
    isAdmin,
    isContadora
  } = useAuth();

  // Roles seleccionables para gestionar permisos
  const selectableRoles = isAdmin
    ? ['secretaria', 'soporte', 'contadora', 'propietario']
    : ['secretaria', 'soporte'];

  const [selectedRoleToEdit, setSelectedRoleToEdit] = useState(selectableRoles[0] || 'secretaria');
  const [rolePermissionsState, setRolePermissionsState] = useState({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [feedbackType, setFeedbackType] = useState('success');

  // Cargar permisos del rol seleccionado
  useEffect(() => {
    const base = ROLE_PERMISSIONS[selectedRoleToEdit] || {};
    const custom = customPermissions[selectedRoleToEdit] || {};
    setRolePermissionsState({
      ...base,
      ...custom
    });
  }, [selectedRoleToEdit, customPermissions]);

  const handleTogglePermission = (key) => {
    // Si es contadora y el rol objetivo no está permitido, no hacer nada
    if (!isAdmin && (selectedRoleToEdit === 'admin' || selectedRoleToEdit === 'propietario')) {
      return;
    }

    setRolePermissionsState(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    setFeedbackMsg(null);
    try {
      await updatePermissionsForRole(selectedRoleToEdit, rolePermissionsState);
      setFeedbackType('success');
      setFeedbackMsg(`¡Permisos para el rol ${ROLE_PERMISSIONS[selectedRoleToEdit]?.label || selectedRoleToEdit} guardados con éxito!`);
      setTimeout(() => setFeedbackMsg(null), 4500);
    } catch (err) {
      console.error('Error guardando permisos:', err);
      setFeedbackType('error');
      setFeedbackMsg('Error al guardar los permisos: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPermissions = async () => {
    if (!window.confirm(`¿Deseas restablecer los permisos del rol ${ROLE_PERMISSIONS[selectedRoleToEdit]?.label} a sus valores predeterminados de fábrica?`)) {
      return;
    }
    setResetting(true);
    setFeedbackMsg(null);
    try {
      await resetPermissionsForRole(selectedRoleToEdit);
      const base = ROLE_PERMISSIONS[selectedRoleToEdit] || {};
      setRolePermissionsState({ ...base });
      setFeedbackType('success');
      setFeedbackMsg(`Permisos de ${ROLE_PERMISSIONS[selectedRoleToEdit]?.label} restablecidos a los valores por defecto.`);
      setTimeout(() => setFeedbackMsg(null), 4500);
    } catch (err) {
      console.error('Error restableciendo permisos:', err);
      setFeedbackType('error');
      setFeedbackMsg('Error al restablecer: ' + (err.message || err));
    } finally {
      setResetting(false);
    }
  };

  // Contar activos para el rol que se está editando
  const allCatalogKeys = PERMISSION_CATALOG.flatMap(c => c.items.map(i => i.key));
  const activeCount = allCatalogKeys.filter(k => Boolean(rolePermissionsState[k])).length;
  const isTargetProtected = !isAdmin && (selectedRoleToEdit === 'admin' || selectedRoleToEdit === 'propietario');

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-title">Configuración del Sistema</div>
          <div className="page-subtitle">Personalización visual, perfil de usuario y control de permisos por rol</div>
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
              background: 'var(--card-bg, #ffffff)',
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
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Modo Claro</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verde institucional y fondos blancos</div>
              </div>
            </div>
            {theme === 'light' && <CheckCircle2 size={18} color="#16a34a" />}
          </div>

          {/* Opción Oscuro */}
          <div
            onClick={() => onToggleTheme('dark')}
            style={{
              border: `2px solid ${theme === 'dark' ? 'var(--accent)' : 'var(--border)'}`,
              background: 'var(--card-bg, #142214)',
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
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Modo Oscuro</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tonalidades esmeralda y alto contraste</div>
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
              Detalles de la cuenta autenticada y perfil operativo
            </div>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <div className="detail-label">Nombre del Usuario</div>
            <div className="detail-value" style={{ fontWeight: 700 }}>
              {user?.user_metadata?.nombre || (role === 'secretaria' ? 'Secretaría' : (role === 'soporte' ? 'Diana (Soporte)' : (role === 'contadora' ? 'Contadora' : 'Usuario Principal')))}
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Correo Electrónico</div>
            <div className="detail-value">{user?.email}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Rol Asignado</div>
            <div className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                background: roleInfo?.badgeBg || '#eff6ff',
                color: roleInfo?.badgeColor || '#1d4ed8',
                border: `1px solid ${roleInfo?.badgeBorder || '#bfdbfe'}`,
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 800
              }}>
                {roleInfo?.label || role}
              </span>
            </div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Nivel de Acceso</div>
            <div className="detail-value" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {roleInfo?.description || 'Acceso estándar al sistema'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MIS PERMISOS ACTIVOS (Visible para TODOS los usuarios: Secretaría, Soporte, etc.) */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#f0fdf4', color: '#16a34a',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Mis Permisos Asignados
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Capacidades y acciones habilitadas para tu rol actual ({roleInfo?.label})
              </div>
            </div>
          </div>

          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
            background: 'var(--accent-soft)', color: 'var(--accent)'
          }}>
            {allCatalogKeys.filter(k => Boolean(permissions?.[k])).length} de {allCatalogKeys.length} activos
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {PERMISSION_CATALOG.flatMap(cat => cat.items).map(item => {
            const hasPermission = Boolean(permissions?.[item.key]);
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${hasPermission ? 'var(--border)' : 'var(--border-light, #e2e8f0)'}`,
                  background: hasPermission ? 'var(--bg-card, #ffffff)' : 'var(--bg-secondary, #f8fafc)',
                  opacity: hasPermission ? 1 : 0.6
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: hasPermission ? '#dcfce7' : '#fee2e2',
                  color: hasPermission ? '#16a34a' : '#ef4444',
                  flexShrink: 0
                }}>
                  {hasPermission ? <Check size={14} /> : <XCircle size={14} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: hasPermission ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MÓDULO DE GESTIÓN DE PERMISOS (Solo para ADMIN y CONTADORA) */}
      {canManagePermissions && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid var(--accent-soft, #bbf7d0)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#eff6ff', color: '#1d4ed8',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Key size={22} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Panel de Control de Permisos por Rol
                  {isContadora && (
                    <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                      Control Contable Activo
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {isAdmin
                    ? 'Como Administrador puedes activar o desactivar permisos para todos los roles del sistema.'
                    : 'Como Contadora puedes gestionar y ajustar los permisos operativos para Secretaría y Soporte Mora.'}
                </div>
              </div>
            </div>

            {/* Selector de Rol a Gestionar */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectableRoles.map(rKey => {
                const isSelected = selectedRoleToEdit === rKey;
                const rInfo = ROLE_PERMISSIONS[rKey];
                return (
                  <button
                    key={rKey}
                    onClick={() => setSelectedRoleToEdit(rKey)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 8,
                      border: `1.5px solid ${isSelected ? rInfo?.badgeColor || 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? rInfo?.badgeBg || 'var(--accent-soft)' : 'transparent',
                      color: isSelected ? rInfo?.badgeColor || 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>{rInfo?.label || rKey}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner si el rol está protegido para Contadora */}
          {isTargetProtected && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 12.5, color: '#92400e'
            }}>
              <Lock size={16} color="#d97706" />
              <span><strong>Rol Protegido:</strong> Solo los administradores tienen autorización para modificar permisos directivos.</span>
            </div>
          )}

          {/* Feedback Toast Message */}
          {feedbackMsg && (
            <div style={{
              background: feedbackType === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${feedbackType === 'success' ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              fontWeight: 700,
              color: feedbackType === 'success' ? '#166534' : '#991b1b'
            }}>
              {feedbackType === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Encabezado del rol activo que se está configurando */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'var(--bg-secondary, #f8fafc)',
            borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Configurando permisos para:
              </span>
              <span style={{
                background: ROLE_PERMISSIONS[selectedRoleToEdit]?.badgeBg || '#eff6ff',
                color: ROLE_PERMISSIONS[selectedRoleToEdit]?.badgeColor || '#1d4ed8',
                border: `1px solid ${ROLE_PERMISSIONS[selectedRoleToEdit]?.badgeBorder || '#bfdbfe'}`,
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 800
              }}>
                {ROLE_PERMISSIONS[selectedRoleToEdit]?.label}
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <strong>{activeCount}</strong> de {allCatalogKeys.length} permisos habilitados
            </div>
          </div>

          {/* Lista de Permisos por Categoría con Toggle Switches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PERMISSION_CATALOG.map(cat => (
              <div key={cat.category} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {cat.category}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  {cat.items.map(item => {
                    const isChecked = Boolean(rolePermissionsState[item.key]);
                    return (
                      <div
                        key={item.key}
                        onClick={() => !isTargetProtected && handleTogglePermission(item.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: isChecked ? 'var(--card-bg, #ffffff)' : 'var(--bg-secondary, #f8fafc)',
                          border: `1px solid ${isChecked ? 'var(--border)' : 'var(--border-light, #e2e8f0)'}`,
                          cursor: isTargetProtected ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ paddingRight: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isChecked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                            {item.desc}
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div style={{
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          background: isChecked ? '#16a34a' : '#cbd5e1',
                          position: 'relative',
                          transition: 'background 0.2s',
                          flexShrink: 0
                        }}>
                          <div style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#ffffff',
                            position: 'absolute',
                            top: 3,
                            left: isChecked ? 23 : 3,
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Botones de Acción */}
          {!isTargetProtected && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResetPermissions}
                disabled={resetting || saving}
                style={{ fontSize: 12.5, gap: 6, color: '#dc2626' }}
                title="Volver a los permisos originales definidos por el sistema"
              >
                <RotateCcw size={14} /> Restablecer a Valores de Fábrica
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePermissions}
                disabled={saving || resetting}
                style={{ fontSize: 13, padding: '9px 20px', gap: 8, fontWeight: 800 }}
              >
                <Save size={16} /> {saving ? 'Guardando...' : `Guardar Cambios para ${ROLE_PERMISSIONS[selectedRoleToEdit]?.label}`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. BASE DE DATOS Y CONEXIÓN */}
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
