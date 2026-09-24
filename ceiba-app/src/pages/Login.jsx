import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [nombre, setNombre]         = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [role, setRole]             = useState('contadora');
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isRegister) {
        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres.');
          setLoading(false);
          return;
        }
        await signUp(email, password, { nombre, role });
        setSuccess('¡Usuario registrado con éxito! Ya puedes iniciar sesión con tus credenciales.');
        setIsRegister(false);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      console.error(err);
      if (isRegister) {
        setError(err.message || 'Error al registrar usuario. Es posible que el correo ya exista.');
      } else {
        setError('Correo o contraseña incorrectos. Verifica tus credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0f4f0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        background: 'rgba(22,163,74,0.06)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: -80, left: -80,
        width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(5,150,105,0.05)', pointerEvents: 'none',
      }} />

      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '40px 36px',
        maxWidth: 440,
        width: '100%',
        boxShadow: '0 8px 40px rgba(22,163,74,0.12), 0 2px 16px rgba(0,0,0,0.06)',
        border: '1px solid #e2ece2',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img 
            src="/logo.png" 
            alt="La Ceiba Logo" 
            style={{ 
              width: 140, 
              display: 'block', 
              margin: '0 auto 14px',
              objectFit: 'contain'
            }} 
          />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f1f0f', letterSpacing: '-0.5px', margin: 0 }}>
            {isRegister ? 'Crear Nuevo Usuario' : 'Acceso al Sistema'}
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {isRegister 
              ? 'Regístrate para acceder a la gestión contable y financiera'
              : 'Ingresa tus credenciales para continuar'}
          </p>
        </div>

        {/* Tabs Iniciar Sesión / Registrarse */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 10,
          marginBottom: 20,
          border: '1px solid #e2e8f0'
        }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); setSuccess(''); }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: !isRegister ? '#ffffff' : 'transparent',
              color: !isRegister ? '#16a34a' : '#64748b',
              boxShadow: !isRegister ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); setSuccess(''); }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: isRegister ? '#ffffff' : 'transparent',
              color: isRegister ? '#16a34a' : '#64748b',
              boxShadow: isRegister ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Alert Error */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: 12.5, color: '#991b1b',
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Alert Success */}
        {success && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: 12.5, color: '#166534',
          }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isRegister && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Nombre y Apellidos
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Laura Pérez (Contadora)"
                required
                style={{
                  background: '#f9fafb', border: '1px solid #e2ece2', borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, color: '#0f1f0f', fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contabilidad@laceiba.com"
              required
              style={{
                background: '#f9fafb', border: '1px solid #e2ece2', borderRadius: 8,
                padding: '10px 14px', fontSize: 13, color: '#0f1f0f', fontFamily: 'Inter, sans-serif',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isRegister ? 'Mínimo 6 caracteres' : '••••••••'}
                required
                style={{
                  width: '100%', background: '#f9fafb', border: '1px solid #e2ece2', borderRadius: 8,
                  padding: '10px 40px 10px 14px', fontSize: 13, color: '#0f1f0f', fontFamily: 'Inter, sans-serif',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6b7280', display: 'flex', padding: 0,
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                Rol / Cargo en el Proyecto
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{
                  background: '#f9fafb', border: '1px solid #e2ece2', borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, color: '#0f1f0f', fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                }}
              >
                <option value="contadora">Contadora / Financiero</option>
                <option value="cartera">Gestión de Cartera / Cobranzas</option>
                <option value="asesor">Asesor Comercial</option>
                <option value="propietario">Propietario / Gerencia</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              background: loading ? '#86efac' : 'linear-gradient(135deg, #16a34a, #15803d)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '12px',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 2px 12px rgba(22,163,74,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                {isRegister ? 'Creando cuenta...' : 'Ingresando...'}
              </>
            ) : (
              isRegister ? <><UserPlus size={16} /> Crear Cuenta</> : <><LogIn size={16} /> Ingresar</>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#64748b' }}>
          {isRegister ? (
            <span>
              ¿Ya tienes cuenta?{' '}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setIsRegister(false); }}
                style={{ color: '#16a34a', fontWeight: 700, textDecoration: 'none' }}
              >
                Inicia sesión aquí
              </a>
            </span>
          ) : (
            <span>
              ¿Eres nuevo en el equipo?{' '}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setIsRegister(true); }}
                style={{ color: '#16a34a', fontWeight: 700, textDecoration: 'none' }}
              >
                Crea tu cuenta aquí
              </a>
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
