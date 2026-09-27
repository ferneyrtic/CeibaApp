import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const ROLE_PERMISSIONS = {
  admin: {
    canViewCierre: true,
    canViewConfig: true,
    canViewComisiones: true,
    canDisburseCommissions: true,
    canManageRecibos: true,
    canDeleteRecibos: true,
    canEditContrato: true,
    canDeleteCasosEspeciales: true,
    canManageUsers: true,
    label: 'Administrador',
    badgeColor: '#7c3aed',
    badgeBg: '#f5f3ff',
    badgeBorder: '#ddd6fe',
    description: 'Acceso total y configuración del sistema'
  },
  propietario: {
    canViewCierre: true,
    canViewConfig: true,
    canViewComisiones: true,
    canDisburseCommissions: true,
    canManageRecibos: true,
    canDeleteRecibos: true,
    canEditContrato: true,
    canDeleteCasosEspeciales: true,
    canManageUsers: false,
    label: 'Propietario',
    badgeColor: '#b45309',
    badgeBg: '#fffbeb',
    badgeBorder: '#fde68a',
    description: 'Visión gerencial, cierres financieros y control general'
  },
  contadora: {
    canViewCierre: true,
    canViewConfig: true,
    canViewComisiones: true,
    canDisburseCommissions: true,
    canManageRecibos: true,
    canDeleteRecibos: true,
    canEditContrato: true,
    canDeleteCasosEspeciales: true,
    canManageUsers: false,
    label: 'Contadora',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    description: 'Control contable, cierres mensuales, auditoría y recibos'
  },
  secretaria: {
    canViewCierre: false,
    canViewConfig: false,
    canViewComisiones: true,
    canDisburseCommissions: true,
    canManageRecibos: true,
    canDeleteRecibos: false,
    canEditContrato: false,
    canDeleteCasosEspeciales: false,
    canManageUsers: false,
    label: 'Secretaría',
    badgeColor: '#059669',
    badgeBg: '#ecfdf5',
    badgeBorder: '#a7f3d0',
    description: 'Operación diaria, recaudo de pagos, recibos y desembolso de comisiones'
  }
};

export function getNormalizedRole(user) {
  if (!user) return 'secretaria';
  const rawRole = (user.user_metadata?.role || '').toLowerCase().trim();
  if (['admin', 'administrador'].includes(rawRole)) return 'admin';
  if (['propietario', 'gerencia', 'owner'].includes(rawRole)) return 'propietario';
  if (['contadora', 'contador', 'financiero'].includes(rawRole)) return 'contadora';
  if (['secretaria', 'secretario', 'asistente', 'cajero', 'cartera', 'asesor'].includes(rawRole)) return 'secretaria';

  const email = (user.email || '').toLowerCase();
  if (email.startsWith('admin')) return 'admin';
  if (email.startsWith('propietario')) return 'propietario';
  if (email.startsWith('contadora')) return 'contadora';
  if (email.startsWith('secretaria')) return 'secretaria';

  return 'contadora';
}

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listener de cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: metadata.role || 'contadora',
          nombre: metadata.nombre || '',
          ...metadata
        }
      }
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Rol basado en metadata y mapeo de permisos
  const role = getNormalizedRole(user);
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.secretaria;
  const isAdmin = role === 'admin';
  const isPropietario = role === 'propietario';
  const isContadora = role === 'contadora';
  const isSecretaria = role === 'secretaria';
  const isOwner = isPropietario || isAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
      role,
      roleInfo: permissions,
      permissions,
      isAdmin,
      isPropietario,
      isContadora,
      isSecretaria,
      isOwner
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
