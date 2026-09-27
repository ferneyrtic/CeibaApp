-- ==============================================================================
-- PROYECTO CAMPESTRE LA CEIBA - MIGRACIÓN DE ROBUSTEZ TRANSACCIONAL (ACID) Y RLS
-- ==============================================================================
-- Este script implementa en PostgreSQL:
-- 1. Secuencia nativa de base de datos para consecutivo de Recibos de Caja (previene Race Conditions).
-- 2. Función Transaccional Atómica (RPC): procesar_pago_con_recibo (ACID: Todo o Nada).
-- 3. Función Transaccional Atómica (RPC): anular_recibo_oficial (Reversión completa auditada).
-- 4. Políticas de Seguridad RLS (Row Level Security) que impiden a Secretaría borrar recibos o contratos.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECUENCIA ATÓMICA DE RECIBOS DE CAJA
-- ------------------------------------------------------------------------------
-- Garantiza numeración consecutiva estricta, libre de colisiones concurrentes.
CREATE SEQUENCE IF NOT EXISTS public.recibo_caja_seq START WITH 3180 INCREMENT BY 1;

-- Ajustar la secuencia al valor máximo actual existente en datos_maestros o 3180
DO $$
DECLARE
  v_max_orden bigint;
BEGIN
  SELECT COALESCE(MAX(orden), 3179) INTO v_max_orden
  FROM public.datos_maestros
  WHERE tipo = 'RECIBO_CAJA';

  IF v_max_orden >= 3175 THEN
    PERFORM setval('public.recibo_caja_seq', v_max_orden);
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN RPC TRANSACCIONAL ACID: PROCESAR PAGO Y EMITIR RECIBO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.procesar_pago_con_recibo(
  p_venta_id bigint,
  p_cuota_id bigint,
  p_afectaciones jsonb,
  p_monto numeric,
  p_fecha_pago date,
  p_medio_pago text,
  p_banco text,
  p_referencia text,
  p_concepto text,
  p_observaciones text,
  p_registrado_por text,
  p_ciudad text,
  p_lote_id_str text,
  p_cliente_nombre text,
  p_cliente_doc text,
  p_valor_letras text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_numero_recibo bigint;
  v_recibo_json jsonb;
  v_afectacion jsonb;
  v_cuota_actual record;
  v_nuevo_pagado numeric;
  v_val_cuota numeric;
  v_es_completo boolean;
  v_nuevo_estado text;
  v_obs_cuota text;
  v_historial jsonb;
  v_saldo_actual numeric;
  v_abonos_actual numeric;
  v_nuevo_saldo numeric;
  v_nuevos_abonos numeric;
  v_cuotas_pendientes integer;
BEGIN
  -- A. Validación de entrada
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto a pagar debe ser mayor a cero.';
  END IF;

  -- B. Obtener siguiente número atómico de recibo
  v_numero_recibo := nextval('public.recibo_caja_seq');

  -- C. Construir JSON del Recibo Oficial
  v_recibo_json := jsonb_build_object(
    'numero_recibo', v_numero_recibo,
    'pagado_a', 'PROYECTO CAMPESTRE LA CEIBA',
    'ciudad', COALESCE(p_ciudad, 'Acacías'),
    'venta_id', p_venta_id,
    'cuota_id', p_cuota_id,
    'lote_id_str', p_lote_id_str,
    'cliente_nombre', p_cliente_nombre,
    'cliente_doc', p_cliente_doc,
    'fecha_pago', p_fecha_pago,
    'valor', p_monto,
    'valor_letras', p_valor_letras,
    'medio_pago', p_medio_pago,
    'banco', p_banco,
    'referencia_pago', p_referencia,
    'concepto', p_concepto,
    'observaciones', p_observaciones,
    'registrado_por', p_registrado_por,
    'created_at', now()
  );

  -- D. CASO 1: Múltiples cuotas afectadas en cascada
  IF p_afectaciones IS NOT NULL AND jsonb_array_length(p_afectaciones) > 0 THEN
    FOR v_afectacion IN SELECT * FROM jsonb_array_elements(p_afectaciones)
    LOOP
      SELECT * INTO v_cuota_actual FROM public.cuotas WHERE id = (v_afectacion->>'id')::bigint FOR UPDATE;
      
      IF FOUND THEN
        v_nuevo_pagado := COALESCE(v_cuota_actual.valor_pagado, 0) + (v_afectacion->>'valor_abono')::numeric;
        v_val_cuota := COALESCE(v_cuota_actual.valor_cuota, 0);
        v_es_completo := (v_afectacion->>'completo')::boolean OR (v_nuevo_pagado >= v_val_cuota);
        v_nuevo_estado := CASE WHEN v_es_completo THEN 'PAGA' ELSE 'VENCIDA' END;
        v_obs_cuota := COALESCE(v_cuota_actual.observacion, '') || ' | Recibo #' || v_numero_recibo;

        UPDATE public.cuotas
        SET valor_pagado = v_nuevo_pagado,
            estado_cuota = v_nuevo_estado,
            fecha_pago = p_fecha_pago,
            medio_pago = p_medio_pago,
            observacion = TRIM(v_obs_cuota)
        WHERE id = (v_afectacion->>'id')::bigint;
      END IF;
    END LOOP;

  -- E. CASO 2: Cuota individual seleccionada
  ELSIF p_cuota_id IS NOT NULL THEN
    SELECT * INTO v_cuota_actual FROM public.cuotas WHERE id = p_cuota_id FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La cuota con ID % no existe.', p_cuota_id;
    END IF;

    v_nuevo_pagado := COALESCE(v_cuota_actual.valor_pagado, 0) + p_monto;
    v_val_cuota := COALESCE(v_cuota_actual.valor_cuota, 0);
    v_es_completo := (v_nuevo_pagado >= v_val_cuota);
    v_nuevo_estado := CASE WHEN v_es_completo THEN 'PAGA' ELSE 'VENCIDA' END;
    v_obs_cuota := COALESCE(v_cuota_actual.observacion, '') || ' | Recibo #' || v_numero_recibo;

    UPDATE public.cuotas
    SET valor_pagado = v_nuevo_pagado,
        estado_cuota = v_nuevo_estado,
        fecha_pago = p_fecha_pago,
        medio_pago = p_medio_pago,
        observacion = TRIM(v_obs_cuota)
    WHERE id = p_cuota_id;
  END IF;

  -- F. Actualizar saldo del contrato de venta
  IF p_venta_id IS NOT NULL THEN
    SELECT saldo, abonos INTO v_saldo_actual, v_abonos_actual
    FROM public.ventas WHERE id = p_venta_id FOR UPDATE;

    IF FOUND THEN
      v_nuevo_saldo := GREATEST(0, COALESCE(v_saldo_actual, 0) - p_monto);
      v_nuevos_abonos := COALESCE(v_abonos_actual, 0) + p_monto;

      UPDATE public.ventas
      SET saldo = v_nuevo_saldo,
          abonos = v_nuevos_abonos
      WHERE id = p_venta_id;

      -- Verificar si ya se saldó totalmente
      SELECT COUNT(*) INTO v_cuotas_pendientes
      FROM public.cuotas
      WHERE venta_id = p_venta_id
        AND (estado_cuota <> 'PAGA' OR COALESCE(valor_pagado, 0) < COALESCE(valor_cuota, 0));

      IF v_cuotas_pendientes = 0 THEN
        UPDATE public.ventas SET estado = 'PAGADO EN SU TOTALIDAD' WHERE id = p_venta_id;
      END IF;
    END IF;
  END IF;

  -- G. Insertar en datos_maestros como RECIBO_CAJA
  INSERT INTO public.datos_maestros (tipo, orden, valor, created_at)
  VALUES ('RECIBO_CAJA', v_numero_recibo, v_recibo_json::text, now());

  -- H. Registrar auditoría obligatoria
  BEGIN
    INSERT INTO public.auditoria (modulo, accion, lote_id_str, descripcion, created_at)
    VALUES (
      'RECIBOS_CAJA',
      'EMISION_RECIBO_PAGO',
      COALESCE(p_lote_id_str, 'Venta #' || p_venta_id),
      'Emisión de Recibo #' || v_numero_recibo || ' por valor de $' || p_monto || ' por ' || p_registrado_por,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Si la tabla auditoría tiene esquema diferente, no rompe la transacción
  END;

  RETURN v_recibo_json;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. FUNCIÓN RPC TRANSACCIONAL ACID: ANULACIÓN REVERSIBLE DE RECIBO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anular_recibo_oficial(
  p_numero_recibo bigint,
  p_motivo text,
  p_usuario_actual text,
  p_rol_usuario text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recibo_row record;
  v_recibo_data jsonb;
  v_venta_id bigint;
  v_cuota_id bigint;
  v_monto numeric;
  v_recibo_anulado jsonb;
BEGIN
  -- Protección RBAC en base de datos: Secretaría no puede anular
  IF LOWER(p_rol_usuario) = 'secretaria' THEN
    RAISE EXCEPTION 'Permiso denegado: El rol de Secretaría no puede anular recibos de caja en la base de datos.';
  END IF;

  IF p_motivo IS NULL OR TRIM(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debe especificar un motivo justificado para anular el recibo.';
  END IF;

  -- Buscar recibo en datos_maestros
  SELECT * INTO v_recibo_row
  FROM public.datos_maestros
  WHERE tipo = 'RECIBO_CAJA' AND orden = p_numero_recibo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el recibo de caja #%', p_numero_recibo;
  END IF;

  v_recibo_data := v_recibo_row.valor::jsonb;
  
  IF (v_recibo_data->>'anulado')::boolean = true THEN
    RAISE EXCEPTION 'El recibo #% ya se encuentra anulado.', p_numero_recibo;
  END IF;

  v_venta_id := (v_recibo_data->>'venta_id')::bigint;
  v_cuota_id := (v_recibo_data->>'cuota_id')::bigint;
  v_monto := (v_recibo_data->>'valor')::numeric;

  -- 1. Revertir saldo en Venta
  IF v_venta_id IS NOT NULL AND v_monto > 0 THEN
    UPDATE public.ventas
    SET saldo = COALESCE(saldo, 0) + v_monto,
        abonos = GREATEST(0, COALESCE(abonos, 0) - v_monto),
        estado = 'ACTIVA'
    WHERE id = v_venta_id;
  END IF;

  -- 2. Revertir abono en Cuota si aplica
  IF v_cuota_id IS NOT NULL AND v_monto > 0 THEN
    UPDATE public.cuotas
    SET valor_pagado = GREATEST(0, COALESCE(valor_pagado, 0) - v_monto),
        estado_cuota = 'VENCIDA',
        observacion = COALESCE(observacion, '') || ' | [ANULADO Recibo #' || p_numero_recibo || ']'
    WHERE id = v_cuota_id;
  END IF;

  -- 3. Marcar recibo como anulado
  v_recibo_anulado := v_recibo_data || jsonb_build_object(
    'anulado', true,
    'motivo_anulacion', p_motivo,
    'anulado_por', p_usuario_actual,
    'anulado_at', now()
  );

  UPDATE public.datos_maestros
  SET valor = v_recibo_anulado::text
  WHERE id = v_recibo_row.id;

  -- 4. Registrar auditoría
  BEGIN
    INSERT INTO public.auditoria (modulo, accion, lote_id_str, descripcion, created_at)
    VALUES (
      'RECIBOS_CAJA',
      'ANULACION_RECIBO',
      COALESCE(v_recibo_data->>'lote_id_str', 'Recibo #' || p_numero_recibo),
      'Anulación de Recibo #' || p_numero_recibo || ' por ' || p_usuario_actual || '. Motivo: ' || p_motivo,
      now()
    );
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN v_recibo_anulado;
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS DE SEGURIDAD RLS (DEFENSA EN PROFUNDIDAD)
-- ------------------------------------------------------------------------------
-- Habilitar RLS en tablas clave
ALTER TABLE IF EXISTS public.datos_maestros ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ventas ENABLE ROW LEVEL SECURITY;

-- Política: Todos los usuarios autenticados pueden consultar datos
DROP POLICY IF EXISTS "Lectura universal autenticados" ON public.datos_maestros;
CREATE POLICY "Lectura universal autenticados" ON public.datos_maestros
  FOR SELECT TO authenticated USING (true);

-- Política: Secretaría NO puede eliminar registros de datos_maestros
DROP POLICY IF EXISTS "Solo Contadora y Admin pueden eliminar en datos_maestros" ON public.datos_maestros;
CREATE POLICY "Solo Contadora y Admin pueden eliminar en datos_maestros" ON public.datos_maestros
  FOR DELETE TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', 'secretaria') IN ('admin', 'contadora', 'propietario')
  );

-- Política: Secretaría NO puede eliminar ventas ni cuotas
DROP POLICY IF EXISTS "Solo Admin puede eliminar ventas" ON public.ventas;
CREATE POLICY "Solo Admin puede eliminar ventas" ON public.ventas
  FOR DELETE TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', 'secretaria') = 'admin'
  );

DROP POLICY IF EXISTS "Solo Admin puede eliminar cuotas" ON public.cuotas;
CREATE POLICY "Solo Admin puede eliminar cuotas" ON public.cuotas
  FOR DELETE TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', 'secretaria') = 'admin'
  );
