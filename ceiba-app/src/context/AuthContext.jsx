import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  getPermisosPersonalizados,
  guardarPermisosRol,
  restablecerPermisosRol
} from '../lib/api/permisosApi';

export const ROLE_PERMISSIONS = {
  admin: {
    canViewCierre: true,
    canViewConfig: true,
    canViewComisiones: true,
    canDisburseCommissions: true,
    canViewGastos: true,
    canManageGastos: true,
    canViewRecibos: true,
    canManageRecibos: true,
    canDeleteRecibos: true,
    canEditContrato: true,
    canDeleteCasosEspeciales: true,
    canManageUsers: true,
    canViewHistorialAcciones: true,
    canManagePermissions: true,
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
    canViewGastos: true,
    canManageGastos: true,
    canViewRecibos: true,
    canManageRecibos: true,
    canDeleteRecibos: true,
    canEditContrato: true,
    canDeleteCasosEspeciales: true,
    canManageUsers: false,
    canViewHistorialAcciones: false,
    canManagePermissions: false,
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
    canViewGastos: true,
    canManageGastos: true,
    canViewRecibos: true,
    canManageRecibos: true,
    canDeleteRecibos: true,
    canEditContrato: true,
    canDeleteCasosEspeciales: true,
    canManageUsers: false,
    canViewHistorialAcciones: false,
    canManagePermissions: true,
    label: 'Contadora',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    description: 'Control contable, cierres mensuales, auditoría, recibos y gestión de permisos'
  },
  secretaria: {
    canViewCierre: false,
    canViewConfig: true,
    canViewComisiones: true,
    canDisburseCommissions: true,
    canViewGastos: false,
    canManageGastos: false,
    canViewRecibos: true,
    canManageRecibos: true,
    canDeleteRecibos: false,
    canEditContrato: false,
    canDeleteCasosEspeciales: false,
    canManageUsers: false,
    canViewHistorialAcciones: false,
    canManagePermissions: false,
    label: 'Secretaría',
    badgeColor: '#059669',
    badgeBg: '#ecfdf5',
    badgeBorder: '#a7f3d0',
    description: 'Operación diaria, recaudo de pagos, recibos y desembolso de comisiones'
  },
  soporte: {
    canViewCierre: false,
    canViewConfig: true,
    canViewComisiones: true,
    canDisburseCommissions: false,
    canViewGastos: false,
    canManageGastos: false,
    canViewRecibos: true,
    canManageRecibos: true,
    canDeleteRecibos: false,
    canEditContrato: false,
    canDeleteCasosEspeciales: false,
    canManageUsers: false,
    canViewHistorialAcciones: true,
    canManagePermissions: false,
    label: 'Soporte Mora',
    badgeColor: '#0284c7',
    badgeBg: '#f0f9ff',
    badgeBorder: '#bae6fd',
    description: 'Gestión y atención de soporte operativo, recaudo y seguimiento de mora'
  }
};

export function getNormalizedRole(user) {
  if (!user) return 'secretaria';
  const rawRole = (user.user_metadata?.role || '').toLowerCase().trim();
  if (['admin', 'administrador'].includes(rawRole)) return 'admin';
  if (['propietario', 'gerencia', 'owner'].includes(rawRole)) return 'propietario';
  if (['contadora', 'contador', 'financiero'].includes(rawRole)) return 'contadora';
  if (['soporte', 'support', 'soportemora', 'mora'].includes(rawRole)) return 'soporte';
  if (['secretaria', 'secretario', 'asistente', 'cajero', 'cartera', 'asesor'].includes(rawRole)) return 'secretaria';

  const email = (user.email || '').toLowerCase();
  if (email.startsWith('admin')) return 'admin';
  if (email.startsWith('propietario')) return 'propietario';
  if (email.startsWith('contadora')) return 'contadora';
  if (email.startsWith('soporte') || email.startsWith('soportemora') || email.startsWith('mora') || email.startsWith('diana')) return 'soporte';
  if (email.startsWith('secretaria')) return 'secretaria';

  return 'contadora';
}

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [customPermissions, setCustomPermissions] = useState({});

  const reloadPermissions = useCallback(async () => {
    try {
      const config = await getPermisosPersonalizados(true);
      setCustomPermissions(config || {});
    } catch (e) {
      console.warn('Error recargando permisos personalizados:', e);
    }
  }, []);

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Cargar permisos personalizados al iniciar
    getPermisosPersonalizados().then(cfg => {
      if (cfg) setCustomPermissions(cfg);
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

  // Rol basado en metadata
  const role = getNormalizedRole(user);
  const baseRoleInfo = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.secretaria;

  // Si es admin, conserva permisos absolutos. Para otros roles, se mezclan las personalizaciones
  const roleOverrides = customPermissions[role] || {};
  const permissions = useMemo(() => {
    return role === 'admin'
      ? { ...baseRoleInfo, canManagePermissions: true }
      : {
          ...baseRoleInfo,
          ...roleOverrides,
          // Proteger permisos críticos intrínsecos al rol base
          canManagePermissions: (role === 'admin' || role === 'contadora') && (roleOverrides.canManagePermissions !== false)
        };
  }, [role, baseRoleInfo, roleOverrides]);

  const isAdmin = role === 'admin';
  const isPropietario = role === 'propietario';
  const isContadora = role === 'contadora';
  const isSecretaria = role === 'secretaria';
  const isSoporte = role === 'soporte';
  const isOwner = isPropietario || isAdmin;
  const canManagePermissions = isAdmin || isContadora || Boolean(permissions.canManagePermissions);

  const updatePermissionsForRole = async (targetRole, nuevosPermisos) => {
    const defaultRolePerms = ROLE_PERMISSIONS[targetRole] || {};
    const res = await guardarPermisosRol({
      targetRole,
      nuevosPermisos,
      editorUser: user,
      defaultPermissions: defaultRolePerms
    });
    if (res && res.config) {
      setCustomPermissions(res.config);
    }
    return res;
  };

  const resetPermissionsForRole = async (targetRole) => {
    const defaultRolePerms = ROLE_PERMISSIONS[targetRole] || {};
    const res = await restablecerPermisosRol({
      targetRole,
      editorUser: user,
      defaultPermissions: defaultRolePerms
    });
    if (res && res.config) {
      setCustomPermissions(res.config);
    }
    return res;
  };

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
      customPermissions,
      updatePermissionsForRole,
      resetPermissionsForRole,
      reloadPermissions,
      canManagePermissions,
      isAdmin,
      isPropietario,
      isContadora,
      isSecretaria,
      isSoporte,
      isOwner
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
