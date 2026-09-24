import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/supabase.js', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../src/lib/supabase.js';
import {
  detectarAbonosExtraordinarios,
  aplicarAmortizacion,
  guardarObservacionCuota
} from '../src/lib/api/abonosApi.js';

describe('abonosApi - detectarAbonosExtraordinarios y aplicarAmortizacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe detectar contratos con abono extraordinario (>= 2x cuota) y generar preview de amortización', async () => {
    const mockCuotasDB = [
      // Contrato V1: Cuota 1 regular (1M), Cuota 2 pagó 3.000.000 (abono grande, cubre 3 cuotas)
      {
        id: 'c1',
        venta_id: 'v1',
        numero_cuota: 1,
        fecha_pago: '2026-05-10',
        valor_cuota: 1000000,
        valor_pagado: 1000000,
        estado_cuota: 'PAGA',
        ventas: {
          id: 'v1',
          lote_id: 'lote-1',
          valor_cuota: 1000000,
          saldo_financiado: 10000000,
          plazo_cuotas: 10,
          estado: 'VENDIDO',
          lotes: { id: 'lote-1', id_lote: 'LC1 - 5 - 2', estado: 'VENDIDO' },
          clientes: { nombre: 'Pedro Gomez', doc_cliente: '123' }
        }
      },
      {
        id: 'c2',
        venta_id: 'v1',
        numero_cuota: 2,
        fecha_pago: '2026-06-10',
        valor_cuota: 1000000,
        valor_pagado: 3000000, // 3x cuota!
        estado_cuota: 'PAGA',
        ventas: {
          id: 'v1',
          lote_id: 'lote-1',
          valor_cuota: 1000000,
          saldo_financiado: 10000000,
          plazo_cuotas: 10,
          estado: 'VENDIDO',
          lotes: { id: 'lote-1', id_lote: 'LC1 - 5 - 2', estado: 'VENDIDO' },
          clientes: { nombre: 'Pedro Gomez', doc_cliente: '123' }
        }
      },
      {
        id: 'c3',
        venta_id: 'v1',
        numero_cuota: 3,
        fecha_pago: null,
        valor_cuota: 1000000,
        valor_pagado: 0,
        estado_cuota: 'VENCIDA',
        fecha_vencimiento: '2026-07-10',
        ventas: {
          id: 'v1',
          lote_id: 'lote-1',
          valor_cuota: 1000000,
          saldo_financiado: 10000000,
          plazo_cuotas: 10,
          estado: 'VENDIDO',
          lotes: { id: 'lote-1', id_lote: 'LC1 - 5 - 2', estado: 'VENDIDO' },
          clientes: { nombre: 'Pedro Gomez', doc_cliente: '123' }
        }
      },
      {
        id: 'c4',
        venta_id: 'v1',
        numero_cuota: 4,
        fecha_pago: null,
        valor_cuota: 1000000,
        valor_pagado: 0,
        estado_cuota: 'VENCIDA',
        fecha_vencimiento: '2026-08-10',
        ventas: {
          id: 'v1',
          lote_id: 'lote-1',
          valor_cuota: 1000000,
          saldo_financiado: 10000000,
          plazo_cuotas: 10,
          estado: 'VENDIDO',
          lotes: { id: 'lote-1', id_lote: 'LC1 - 5 - 2', estado: 'VENDIDO' },
          clientes: { nombre: 'Pedro Gomez', doc_cliente: '123' }
        }
      },
      // Contrato V2: Cuotas normales de 1x cuota (NO debe ser detectado)
      {
        id: 'c5',
        venta_id: 'v2',
        numero_cuota: 1,
        fecha_pago: '2026-05-15',
        valor_cuota: 800000,
        valor_pagado: 800000,
        estado_cuota: 'PAGA',
        ventas: {
          id: 'v2',
          lote_id: 'lote-2',
          valor_cuota: 800000,
          saldo_financiado: 8000000,
          plazo_cuotas: 10,
          estado: 'VENDIDO',
          lotes: { id: 'lote-2', id_lote: 'LC2 - 1 - 1', estado: 'VENDIDO' },
          clientes: { nombre: 'Laura Diaz', doc_cliente: '456' }
        }
      }
    ];

    supabase.from.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          range: async () => ({ data: mockCuotasDB, error: null })
        })
      })
    }));

    const casos = await detectarAbonosExtraordinarios();

    expect(casos.length).toBe(1);
    const caso = casos[0];
    expect(caso.venta_id).toBe('v1');
    expect(caso.id_lote).toBe('LC1 - 5 - 2');
    expect(caso.valor_pagado).toBe(3000000);
    expect(caso.cuotas_que_cubre).toBe(3);
    expect(caso.cuotas_enteras).toBe(3);
    expect(caso.remanente).toBe(0);

    // Debe preparar la amortización de 2 cuotas siguientes (C3 y C4)
    expect(caso.cuotas_pendientes_amortizar.length).toBe(2);
    expect(caso.cuotas_pendientes_amortizar[0].numero_cuota).toBe(3);
    expect(caso.cuotas_pendientes_amortizar[0].valor_pagado_nuevo).toBe(0);
    expect(caso.cuotas_pendientes_amortizar[0].estado_nuevo).toBe('PAGA');
    expect(caso.cuotas_pendientes_amortizar[0].fecha_pago_nueva).toBe('2026-06-10');

    expect(caso.cuotas_pendientes_amortizar[1].numero_cuota).toBe(4);
    expect(caso.cuotas_pendientes_amortizar[1].valor_pagado_nuevo).toBe(0);
    expect(caso.cuotas_pendientes_amortizar[1].estado_nuevo).toBe('PAGA');
  });

  it('aplicarAmortizacion debe persistir cuotas amortizadas con valor 0 y proteger el CHECK constraint de lotes', async () => {
    const mockUpdates = [];

    supabase.from.mockImplementation((table) => ({
      update: (payload) => ({
        eq: async (field, val) => {
          mockUpdates.push({ table, payload, field, val });
          return { error: null };
        }
      })
    }));

    const casoMock = {
      ultima_cuota_id: 'c2',
      lote_id: 'lote-1',
      venta_id: 'v1',
      observacion_sugerida: 'Pago grande cubre 3 cuotas',
      cuotas_pendientes_amortizar: [
        {
          cuota_id: 'c3',
          numero_cuota: 3,
          fecha_pago_nueva: '2026-06-10',
          estado_nuevo: 'PAGA',
          observacion_nueva: 'Amortizada por abono extraordinario'
        }
      ]
    };

    const res = await aplicarAmortizacion(casoMock, {
      marcarPagadoTotal: true
    });

    expect(res.cuotas_amortizadas).toBe(1);
    expect(res.marcado_pagado_total).toBe(true);

    // 1. Debe actualizar la cuota c3 a PAGA con valor_pagado = 0
    const cuotaUpdate = mockUpdates.find(u => u.table === 'cuotas' && u.val === 'c3');
    expect(cuotaUpdate).toBeDefined();
    expect(cuotaUpdate.payload.estado_cuota).toBe('PAGA');
    expect(cuotaUpdate.payload.valor_pagado).toBe(0.0);
    expect(cuotaUpdate.payload.fecha_pago).toBe('2026-06-10');

    // 2. Debe actualizar la observación en c2 (el abono grande)
    const obsUpdate = mockUpdates.find(u => u.table === 'cuotas' && u.val === 'c2');
    expect(obsUpdate).toBeDefined();
    expect(obsUpdate.payload.observacion).toBe('Pago grande cubre 3 cuotas');

    // 3. Verificación de blindaje de base de datos PostgreSQL (lotes_estado_check):
    // La tabla lotes NO debe recibir 'PAGADO EN SU TOTALIDAD' (rompe el check constraint de Postgres).
    // Debe recibir 'VENDIDO', mientras que la tabla ventas sí recibe 'PAGADO EN SU TOTALIDAD'.
    const loteUpdate = mockUpdates.find(u => u.table === 'lotes' && u.val === 'lote-1');
    expect(loteUpdate).toBeDefined();
    expect(loteUpdate.payload.estado).toBe('VENDIDO'); // Protegido contra error CHECK constraint!

    const ventaUpdate = mockUpdates.find(u => u.table === 'ventas' && u.val === 'v1');
    expect(ventaUpdate).toBeDefined();
    expect(ventaUpdate.payload.estado).toBe('PAGADO EN SU TOTALIDAD');
  });

  it('guardarObservacionCuota debe persistir la nota o null si está vacía', async () => {
    let capturedPayload = null;
    supabase.from.mockImplementation(() => ({
      update: (payload) => ({
        eq: async () => {
          capturedPayload = payload;
          return { error: null };
        }
      })
    }));

    await guardarObservacionCuota('cuota-10', 'Abono pendiente de verificación');
    expect(capturedPayload.observacion).toBe('Abono pendiente de verificación');

    await guardarObservacionCuota('cuota-10', '');
    expect(capturedPayload.observacion).toBeNull();
  });
});
