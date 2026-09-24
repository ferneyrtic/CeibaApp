-- ==============================================================================
-- PROYECTO LA CEIBA - SCRIPT DE OPTIMIZACIÓN Y SEGURIDAD SUPABASE
-- ==============================================================================
-- 1. Soluciona la alerta crítica: 'Security Definer View public.v_cartera_total'
-- 2. Crea los índices necesarios para acelerar consultas y prevenir errores 504
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PASO 1: CORRECCIÓN DE SEGURIDAD (Security Definer View -> Security Invoker)
-- ------------------------------------------------------------------------------
-- Le indica a PostgreSQL que la vista evalúe los permisos y políticas RLS 
-- del usuario que consulta (invoker), eliminando la vulnerabilidad y la alerta crítica.
ALTER VIEW public.v_cartera_total SET (security_invoker = true);


-- ------------------------------------------------------------------------------
-- PASO 2: ÍNDICES DE ALTO RENDIMIENTO PARA CUOTAS (9.724 registros)
-- ------------------------------------------------------------------------------
-- Acelera los joins entre ventas y cuotas, filtros de mora, vencimientos y pagos.
CREATE INDEX IF NOT EXISTS idx_cuotas_venta_id 
  ON public.cuotas (venta_id);

CREATE INDEX IF NOT EXISTS idx_cuotas_estado 
  ON public.cuotas (estado_cuota);

CREATE INDEX IF NOT EXISTS idx_cuotas_fecha_vencimiento 
  ON public.cuotas (fecha_vencimiento);

CREATE INDEX IF NOT EXISTS idx_cuotas_fecha_pago 
  ON public.cuotas (fecha_pago);

CREATE INDEX IF NOT EXISTS idx_cuotas_numero 
  ON public.cuotas (numero_cuota);


-- ------------------------------------------------------------------------------
-- PASO 3: ÍNDICES DE ALTO RENDIMIENTO PARA VENTAS Y LOTES
-- ------------------------------------------------------------------------------
-- Acelera las consultas de cartera consolidada, reportes y estados de cuenta.
CREATE INDEX IF NOT EXISTS idx_ventas_lote_id 
  ON public.ventas (lote_id);

CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id 
  ON public.ventas (cliente_id);

CREATE INDEX IF NOT EXISTS idx_ventas_estado 
  ON public.ventas (estado);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha_pago_inicial 
  ON public.ventas (fecha_pago_cuota_inicial);

CREATE INDEX IF NOT EXISTS idx_lotes_id_lote 
  ON public.lotes (id_lote);

CREATE INDEX IF NOT EXISTS idx_lotes_estado 
  ON public.lotes (estado);

CREATE INDEX IF NOT EXISTS idx_clientes_doc_cliente 
  ON public.clientes (doc_cliente);


-- ------------------------------------------------------------------------------
-- PASO 4: ACTUALIZAR ESTADÍSTICAS DEL PLANIFICADOR DE POSTGRESQL
-- ------------------------------------------------------------------------------
-- Informa al optimizador de consultas sobre los nuevos índices para uso inmediato.
ANALYZE public.cuotas;
ANALYZE public.ventas;
ANALYZE public.lotes;
ANALYZE public.clientes;
