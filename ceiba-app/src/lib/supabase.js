import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://qatfoxmarddsocnwycgy.supabase.co';
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s';

// Cliente principal con persistencia de sesión auth para login de usuarios
export const supabase = createClient(supabaseUrl, supabaseKey);

// Cliente administrativo autónomo (service_role) sin persistencia de sesión auth de usuario.
// Garantiza que operaciones críticas del sistema (AUDITORIA_ACCION, OBSERVACION_COBRANZA, CONFIG_PERMISOS, etc.)
// NUNCA fallen por políticas RLS restrictivas que bloqueen a usuarios autenticados.
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
