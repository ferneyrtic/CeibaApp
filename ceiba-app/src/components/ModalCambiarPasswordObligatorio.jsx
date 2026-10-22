import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export default function ModalCambiarPasswordObligatorio({ user, onSuccess }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nombreUsuario = user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Usuario';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword.toLowerCase().trim() === 'ceiba123') {
      setError('Por seguridad, debes elegir una contraseña personal diferente a la contraseña temporal "ceiba123".');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          must_change_password: false,
          password_updated_at: new Date().toISOString()
        }
      });

      if (updateErr) throw updateErr;

      if (onSuccess) {
        onSuccess(data.user);
      }
    } catch (err) {
      console.error('Error al actualizar contraseña:', err);
      setError(err.message || 'Ocurrió un error al actualizar la contraseña. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999999,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        maxWidth: 460,
        width: '100%',
        padding: '36px 30px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Header con Icono */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: '#ecfdf5',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            border: '2px solid #a7f3d0'
          }}>
            <ShieldCheck size={28} />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
            Actualización de Contraseña
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
            Hola, <strong style={{ color: '#0f172a' }}>{nombreUsuario}</strong>. Por seguridad de la plataforma, debes asignar tu contraseña personal antes de ingresar a los datos del sistema.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 18,
            fontSize: 12.5,
            color: '#b91c1c'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Nueva Contraseña */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
              Nueva Contraseña Personal: *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw1 ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 13.5,
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#f8fafc',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
              />
              <button
                type="button"
                onClick={() => setShowPw1(!showPw1)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  padding: 0
                }}
              >
                {showPw1 ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar Contraseña */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
              Confirmar Nueva Contraseña: *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw2 ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 13.5,
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#f8fafc',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
              />
              <button
                type="button"
                onClick={() => setShowPw2(!showPw2)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  padding: 0
                }}
              >
                {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{
            fontSize: 11.5,
            color: '#64748b',
            background: '#f1f5f9',
            padding: '8px 12px',
            borderRadius: 8,
            marginTop: 2
          }}>
            💡 Una vez confirmada, esta será tu contraseña fija para acceder al sistema.
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 10,
              background: loading ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '12px',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 2px 10px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 16,
                  height: 16,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                Guardando Contraseña...
              </>
            ) : (
              <>
                <Lock size={16} /> Guardar Contraseña y Continuar
              </>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: 12,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Cerrar sesión e ingresar más tarde
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
