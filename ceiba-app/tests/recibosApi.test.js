import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase y AuditApi antes de importar
vi.mock('../src/lib/supabase.js', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  };
});

vi.mock('../src/lib/api/auditApi.js', () => ({
  registrarAccion: vi.fn().mockResolvedValue({ success: true })
}));

import { supabase } from '../src/lib/supabase.js';
import {
  obtenerSiguienteNumeroRecibo,
  crearReciboCaja,
  registrarPagoConRecibo,
  clearRecibosCache
} from '../src/lib/api/recibosApi.js';

describe('recibosApi - Gestión de Recibos de Caja Menor', () => {
  beforeEach(() => {
    clearRecibosCache();
    vi.clearAllMocks();
  });

  it('inicia el consecutivo de recibos en 3175 si no existen registros previos', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null })
          })
        })
      })
    });

    const sig = await obtenerSiguienteNumeroRecibo();
    expect(sig).toBe(3175);
  });

  it('incrementa el consecutivo a partir del último recibo existente', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [{ orden: 3175 }], error: null })
          })
        })
      })
    });

    const sig = await obtenerSiguienteNumeroRecibo();
    expect(sig).toBe(3176);
  });

  it('crearReciboCaja genera el texto en letras bancario automáticamente', async () => {
    let insertedPayload = null;
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [{ orden: 3175 }], error: null })
          })
        })
      }),
      insert: (records) => {
        insertedPayload = records[0];
        return {
          select: () => ({
            single: async () => ({ data: { id: 'uuid-123', ...records[0] }, error: null })
          })
        };
      }
    });

    const res = await crearReciboCaja({
      monto: 500000,
      valor: 500000,
      cliente_nombre: 'Maria Elvira Gonzalez'
    });

    expect(res.numero_recibo).toBe(3176);
    expect(res.valor_letras).toBe('QUINIENTOS MIL PESOS M/CTE');
    expect(insertedPayload.orden).toBe(3176);
  });

  it('registrarPagoConRecibo mantiene la cuota en estado parcial si el pago no cubre la totalidad', async () => {
    let cuotaActualizada = null;

    supabase.from.mockImplementation((table) => {
      if (table === 'datos_maestros') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [{ orden: 3175 }], error: null })
              })
            })
          }),
          insert: (records) => ({
            select: () => ({
              single: async () => ({ data: { id: 'uuid-recibo', ...records[0] }, error: null })
            })
          })
        };
      }
      if (table === 'cuotas') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'c1',
                  numero_cuota: 4,
                  valor_cuota: 1000000,
                  valor_pagado: 0,
                  estado_cuota: 'AL DÍA',
                  observacion: ''
                },
                error: null
              }),
              // para chequeo de todas las cuotas
              then: (fn) => fn({ data: [{ estado_cuota: 'AL DÍA', valor_cuota: 1000000, valor_pagado: 500000 }] })
            })
          }),
          update: (updates) => {
            cuotaActualizada = updates;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'c1', ...updates }, error: null })
                })
              })
            };
          }
        };
      }
      if (table === 'ventas') {
        return {
          update: () => ({ eq: async () => ({}) })
        };
      }
      return {};
    });

    const resultado = await registrarPagoConRecibo({
      ventaId: 'v1',
      cuotaId: 'c1',
      monto: 500000,
      fechaPago: '2026-10-15',
      clienteNombre: 'Maria Gonzalez',
      loteIdStr: 'LC1 - 7 - 19'
    });

    // Verificaciones:
    // 1. Recibo generado con consecutivo 3176
    expect(resultado.recibo.numero_recibo).toBe(3176);
    expect(resultado.recibo.valor).toBe(500000);
    expect(resultado.recibo.es_pago_completo).toBe(false);
    expect(resultado.recibo.saldo_restante_cuota).toBe(500000);

    // 2. Cuota NO debe estar PAGA, debe quedar con valor acumulado 500.000
    expect(cuotaActualizada.valor_pagado).toBe(500000);
    expect(cuotaActualizada.estado_cuota).not.toBe('PAGA');
    expect(cuotaActualizada.fecha_pago).toBe('2026-10-15');
    expect(cuotaActualizada.observacion).toContain('Recibo #3176');
  });

  it('no arroja excepción ni falla si datos_maestros rechaza la fila por violación de RLS', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'datos_maestros') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null })
              })
            })
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { code: '42501', message: 'new row violates row-level security policy for table "datos_maestros"' }
              })
            })
          })
        };
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: {}, error: null }) }) })
      };
    });

    // crearReciboCaja NO debe fallar aunque datos_maestros tenga RLS
    const res = await crearReciboCaja({
      monto: 300000,
      valor: 300000,
      cliente_nombre: 'Pedro Perez'
    });

    expect(res).toBeDefined();
    expect(res.numero_recibo).toBe(3175);
    expect(res.valor_letras).toBe('TRESCIENTOS MIL PESOS M/CTE');
  });
});
