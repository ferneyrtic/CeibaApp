/**
 * REPOSITORY PATTERN: RECIBOS DE CAJA & PAGOS
 * Abstrae y desacopla la capa de persistencia (Supabase / RPC / LocalStorage).
 * Implementa transaccionalidad ACID y compensación en caso de fallo.
 */

import { supabase } from '../supabase';
import { numeroALetrasCOP } from '../../utils/numeroALetras';
import { registrarAccion } from '../api/auditApi';
import { validarPagoReciboPayload } from '../validation/schemas';
import {
  obtenerTodosLosRecibos,
  obtenerSiguienteNumeroRecibo,
  crearReciboCaja,
  clearRecibosCache
} from '../api/recibosApi';

export class RecibosRepository {
  /**
   * Obtiene todos los recibos mediante la capa unificada de almacenamiento
   */
  async findAll(forceRefresh = false) {
    return obtenerTodosLosRecibos(forceRefresh);
  }

  /**
   * Obtiene recibos de una venta o contrato
   */
  async findByVentaId(ventaId) {
    const list = await this.findAll();
    return list.filter(r => r.venta_id === ventaId);
  }

  /**
   * Obtiene el siguiente número de recibo correlativo
   */
  async getNextConsecutivo() {
    return obtenerSiguienteNumeroRecibo();
  }

  /**
   * Procesa un pago transaccional ACID con doble salvaguarda:
   * 1. RPC nativo PostgreSQL si está desplegado en Supabase
   * 2. Orquestador transaccional con Compensating Rollback si no existe la función en BD
   */
  async procesarPago(datosPago) {
    // 1. Validar integridad de contrato
    const validado = validarPagoReciboPayload(datosPago);
    const montoNum = validado.monto;
    const valorLetras = numeroALetrasCOP(montoNum);

    // 2. Intentar ejecución atómica en PostgreSQL (Función RPC con Transacción ACID)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('procesar_pago_con_recibo', {
        p_venta_id: validado.ventaId || null,
        p_cuota_id: validado.cuotaId || null,
        p_afectaciones: validado.afectaciones ? JSON.parse(JSON.stringify(validado.afectaciones)) : null,
        p_monto: montoNum,
        p_fecha_pago: validado.fechaPago,
        p_medio_pago: validado.medioPago,
        p_banco: validado.banco || '',
        p_referencia: validado.referenciaPago || '',
        p_concepto: validado.concepto || 'Abono a contrato',
        p_observaciones: validado.observaciones || '',
        p_registrado_por: validado.registradoPor || 'Secretaría',
        p_ciudad: validado.ciudad || 'Acacías',
        p_lote_id_str: validado.loteIdStr || '',
        p_cliente_nombre: validado.clienteNombre || '',
        p_cliente_doc: validado.clienteDoc || '',
        p_valor_letras: valorLetras
      });

      if (!rpcErr && rpcData) {
        const reciboEmitido = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
        clearRecibosCache();
        return {
          recibo: reciboEmitido,
          transaccionalBackend: true
        };
      }
    } catch (eRpc) {
      console.info('Aviso: RPC backend omitido, ejecutando orquestación con Rollback Compensatorio:', eRpc);
    }

    // 3. FALLBACK: Orquestador Transaccional del Cliente con Compensating Rollback (Saga)
    const compensatingRollbackActions = [];
    let numeroRecibo = null;

    try {
      numeroRecibo = await this.getNextConsecutivo();
      let cuotasActualizadas = [];
      let esPagoCompleto = false;
      let saldoRestanteCuota = 0;
      let numeroCuota = null;

      // 3.1 Procesar Cuotas
      if (validado.afectaciones && Array.isArray(validado.afectaciones) && validado.afectaciones.length > 0) {
        numeroCuota = validado.afectaciones[0].numero_cuota;

        for (const a of validado.afectaciones) {
          const { data: cuotaOriginal } = await supabase.from('cuotas').select('*').eq('id', a.id).single();
          if (cuotaOriginal) {
            // Guardar acción de rollback compensatorio por si falla un paso posterior
            compensatingRollbackActions.push(async () => {
              await supabase.from('cuotas').update({
                valor_pagado: cuotaOriginal.valor_pagado,
                estado_cuota: cuotaOriginal.estado_cuota,
                fecha_pago: cuotaOriginal.fecha_pago,
                observacion: cuotaOriginal.observacion
              }).eq('id', a.id);
            });

            const yaPag = Number(cuotaOriginal.valor_pagado) || 0;
            const abonoItem = Number(a.valor_abono) || 0;
            const nuevoPag = yaPag + abonoItem;
            const valCuota = Number(cuotaOriginal.valor_cuota) || 0;
            const comp = a.completo || nuevoPag >= valCuota;
            const nuevoEst = comp ? 'PAGA' : (cuotaOriginal.estado_cuota === 'VENCIDA' ? 'VENCIDA' : 'AL DÍA');

            const { data: updated, error: uErr } = await supabase.from('cuotas').update({
              valor_pagado: nuevoPag,
              estado_cuota: nuevoEst,
              fecha_pago: validado.fechaPago,
              medio_pago: validado.medioPago,
              observacion: `${cuotaOriginal.observacion || ''} | Recibo #${numeroRecibo}`.trim()
            }).eq('id', a.id).select().single();

            if (uErr) throw uErr;
            if (updated) cuotasActualizadas.push(updated);
          }
        }
        esPagoCompleto = validado.afectaciones.every(a => a.completo);
      } else if (validado.cuotaId) {
        const { data: cuotaOriginal, error: cErr } = await supabase.from('cuotas').select('*').eq('id', validado.cuotaId).single();
        if (cErr) throw cErr;

        compensatingRollbackActions.push(async () => {
          await supabase.from('cuotas').update({
            valor_pagado: cuotaOriginal.valor_pagado,
            estado_cuota: cuotaOriginal.estado_cuota,
            fecha_pago: cuotaOriginal.fecha_pago,
            observacion: cuotaOriginal.observacion
          }).eq('id', validado.cuotaId);
        });

        numeroCuota = cuotaOriginal.numero_cuota;
        const valCuota = Number(cuotaOriginal.valor_cuota) || 0;
        const yaPagado = Number(cuotaOriginal.valor_pagado) || 0;
        const nuevoPagado = yaPagado + montoNum;
        esPagoCompleto = nuevoPagado >= valCuota;
        saldoRestanteCuota = Math.max(0, valCuota - nuevoPagado);
        const nuevoEstado = esPagoCompleto ? 'PAGA' : (cuotaOriginal.estado_cuota === 'VENCIDA' ? 'VENCIDA' : 'AL DÍA');

        const { data: cUpdated, error: uErr } = await supabase.from('cuotas').update({
          valor_pagado: nuevoPagado,
          estado_cuota: nuevoEstado,
          fecha_pago: validado.fechaPago,
          medio_pago: validado.medioPago,
          observacion: `${cuotaOriginal.observacion || ''} | Recibo #${numeroRecibo}`.trim()
        }).eq('id', validado.cuotaId).select().single();

        if (uErr) throw uErr;
        cuotasActualizadas = [cUpdated];
      }

      // 3.2 Actualizar Venta / Contrato
      if (validado.ventaId) {
        const { data: vOriginal } = await supabase.from('ventas').select('saldo, abonos, estado').eq('id', validado.ventaId).single();
        if (vOriginal) {
          compensatingRollbackActions.push(async () => {
            await supabase.from('ventas').update({
              saldo: vOriginal.saldo,
              abonos: vOriginal.abonos,
              estado: vOriginal.estado
            }).eq('id', validado.ventaId);
          });

          const nuevoSaldo = Math.max(0, (Number(vOriginal.saldo) || 0) - montoNum);
          const nuevosAbonos = (Number(vOriginal.abonos) || 0) + montoNum;
          await supabase.from('ventas').update({ saldo: nuevoSaldo, abonos: nuevosAbonos }).eq('id', validado.ventaId);
        }
      }

      // 3.3 Emitir el Recibo Oficial
      const recibo = await crearReciboCaja({
        numero_recibo: numeroRecibo,
        pagado_a: 'PROYECTO CAMPESTRE LA CEIBA',
        ciudad: validado.ciudad || 'Acacías',
        venta_id: validado.ventaId,
        cuota_id: validado.cuotaId,
        numero_cuota: numeroCuota,
        lote_id_str: validado.loteIdStr,
        cliente_nombre: validado.clienteNombre,
        cliente_doc: validado.clienteDoc,
        fecha_pago: validado.fechaPago,
        valor: montoNum,
        valor_letras: valorLetras,
        concepto: validado.concepto || (numeroCuota ? `Abono a Cuota #${numeroCuota}` : 'Abono a contrato'),
        medio_pago: validado.medioPago,
        banco: validado.banco,
        referencia_pago: validado.referenciaPago,
        observaciones: validado.observaciones,
        es_pago_completo: esPagoCompleto,
        saldo_restante_cuota: saldoRestanteCuota,
        registrado_por: validado.registradoPor || 'Secretaría'
      });

      // 3.4 Auditoría
      await registrarAccion({
        modulo: 'RECIBOS_CAJA',
        accion: 'EMISION_RECIBO_PAGO',
        lote_id_str: validado.loteIdStr || `Venta #${validado.ventaId}`,
        descripcion: `Emisión de Recibo #${numeroRecibo} por $${montoNum.toLocaleString('es-CO')} a nombre de ${validado.clienteNombre || 'Cliente'}`
      }).catch(() => {});

      return {
        recibo,
        cuotasActualizadas,
        compensatingRollbackAvailable: true
      };
    } catch (mutationError) {
      // 🚨 COMPENSATING ROLLBACK: Revertir todo en orden inverso si algo falló
      console.error('Fallo en mutación de pago. Ejecutando Rollback Compensatorio...', mutationError);
      for (const rollbackFn of compensatingRollbackActions.reverse()) {
        try {
          await rollbackFn();
        } catch (eRollback) {
          console.error('Error en rollback compensatorio:', eRollback);
        }
      }
      throw new Error(`Transacción revertida por seguridad para evitar inconsistencias: ${mutationError.message || mutationError}`);
    }
  }

  /**
   * Anula un recibo de forma segura con justificación obligatoria
   */
  async anularRecibo({ numeroRecibo, motivo, usuarioActual, rolUsuario }) {
    if (rolUsuario === 'secretaria') {
      throw new Error('Permiso denegado: El rol de Secretaría no puede anular recibos de caja.');
    }

    // Intentar RPC en base de datos primero
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('anular_recibo_oficial', {
        p_numero_recibo: Number(numeroRecibo),
        p_motivo: motivo,
        p_usuario_actual: usuarioActual,
        p_rol_usuario: rolUsuario
      });

      if (!rpcErr && rpcRes) {
        clearRecibosCache();
        return rpcRes;
      }
    } catch (e) {
      // Continúa con la lógica de recibosApi
    }

    const { anularRecibo } = await import('../api/recibosApi');
    return anularRecibo({ numeroRecibo, motivo, usuarioActual, rolUsuario });
  }
}

export const recibosRepository = new RecibosRepository();
