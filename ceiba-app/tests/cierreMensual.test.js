import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockeamos supabase antes de importar cierreApi
vi.mock('../src/lib/supabase.js', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../src/lib/supabase.js';
import { getCierreMensualData, clearCierreCache } from '../src/lib/api/cierreApi.js';

describe('cierreApi - getCierreMensualData', () => {
  beforeEach(() => {
    clearCierreCache();
    vi.clearAllMocks();
  });

  it('debe consolidar ingresos por fecha de pago y descartar cuotas amortizadas con valor 0 (prevención dinero fantasma)', async () => {
    // Mock de cuotas devueltas por Supabase
    const mockCuotas = [
      // Cuota pagada legítima de Septiembre
      {
        id: 'c1',
        venta_id: 'v1',
        numero_cuota: 1,
        fecha_pago: '2026-09-02',
        fecha_vencimiento: '2026-09-01',
        valor_cuota: 1000000,
        valor_pagado: 1000000,
        estado_cuota: 'PAGA',
        medio_pago: 'Transferencia',
        ventas: {
          id: 'v1',
          vendedor_nombre: 'Carlos Asesor',
          lotes: { id_lote: 'LC1 - 1 - 2' },
          clientes: { nombre: 'Juan Perez', doc_cliente: '12345' }
        }
      },
      // Cuota AMORTIZADA con valor_pagado = 0 (NO debe sumar al dinero real)
      {
        id: 'c2',
        venta_id: 'v1',
        numero_cuota: 2,
        fecha_pago: '2026-09-02',
        fecha_vencimiento: '2026-10-01',
        valor_cuota: 1000000,
        valor_pagado: 0.0,
        estado_cuota: 'PAGA',
        medio_pago: 'Transferencia',
        observacion: 'Amortizada por abono',
        ventas: {
          id: 'v1',
          vendedor_nombre: 'Carlos Asesor',
          lotes: { id_lote: 'LC1 - 1 - 2' },
          clientes: { nombre: 'Juan Perez', doc_cliente: '12345' }
        }
      },
      // Cuota de otro asesor en Septiembre
      {
        id: 'c3',
        venta_id: 'v2',
        numero_cuota: 5,
        fecha_pago: '2026-09-05',
        fecha_vencimiento: '2026-09-05',
        valor_cuota: 1500000,
        valor_pagado: 1500000,
        estado_cuota: 'PAGA',
        medio_pago: 'Efectivo',
        ventas: {
          id: 'v2',
          vendedor_nombre: 'Maria Asesora',
          lotes: { id_lote: 'LC2 - 5 - 10' },
          clientes: { nombre: 'Ana Gomez', doc_cliente: '67890' }
        }
      }
    ];

    // Mock de cuotas iniciales del mes
    const mockIniciales = [
      {
        id: 'v3',
        fecha_venta: '2026-09-01',
        valor_cuota_inicial: 5000000,
        fecha_pago_cuota_inicial: '2026-09-03',
        medio_pago: 'Transferencia',
        vendedor_nombre: 'Carlos Asesor',
        lotes: { id_lote: 'LC1 - 3 - 4' },
        clientes: { nombre: 'Pedro Gomez', doc_cliente: '11223' }
      }
    ];

    // Configurar el mock de Supabase
    supabase.from.mockImplementation((table) => {
      if (table === 'cuotas') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: async () => ({ data: mockCuotas, error: null })
              })
            })
          })
        };
      }
      if (table === 'ventas') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => ({
                order: async () => ({ data: mockIniciales, error: null })
              })
            }),
            in: async () => ({ data: [], error: null })
          })
        };
      }
      if (table === 'datos_maestros') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null })
            })
          })
        };
      }
      return { select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) };
    });

    const data = await getCierreMensualData(2026, 9, true);

    // 1. Verificación de Prevención de Dinero Fantasma:
    // La cuota c2 tiene valor_pagado = 0, por lo que NO debe sumar.
    // Cuotas reales: c1 (1M) + c3 (1.5M) = 2.500.000
    expect(data.kpis.totalCuotasMes).toBe(2500000);
    expect(data.kpis.countCuotasMes).toBe(2);

    // Cuota inicial: v3 (5M)
    expect(data.kpis.totalInicialesMes).toBe(5000000);
    expect(data.kpis.countInicialesMes).toBe(1);

    // Total Recaudado en el Mes: 2.5M + 5M = 7.500.000
    expect(data.kpis.totalRecaudadoMes).toBe(7500000);
    expect(data.kpis.totalTransacciones).toBe(3);
    expect(data.kpis.ticketPromedio).toBe(2500000);

    // 2. Ranking de Asesores:
    // Carlos: c1 (1M) + v3 inicial (5M) = 6.000.000 (80% del total)
    // Maria: c3 (1.5M) = 1.500.000 (20% del total)
    expect(data.rankingAsesores.length).toBe(2);
    expect(data.rankingAsesores[0].vendedor).toBe('Carlos Asesor');
    expect(data.rankingAsesores[0].totalRecaudado).toBe(6000000);
    expect(data.rankingAsesores[0].pctDelTotal).toBe(80);

    expect(data.rankingAsesores[1].vendedor).toBe('Maria Asesora');
    expect(data.rankingAsesores[1].totalRecaudado).toBe(1500000);
    expect(data.rankingAsesores[1].pctDelTotal).toBe(20);

    // 3. Medios de Pago:
    // Transferencia: 1M + 5M = 6.000.000
    // Efectivo: 1.500.000
    const transf = data.desgloseMedios.find(m => m.medio === 'TRANSFERENCIA');
    expect(transf.total).toBe(6000000);
    const efect = data.desgloseMedios.find(m => m.medio === 'EFECTIVO');
    expect(efect.total).toBe(1500000);

    // 4. Recaudo por día:
    const dia2 = data.recaudoPorDia.find(d => d.fecha === '2026-09-02');
    expect(dia2.totalDia).toBe(1000000);
    const dia3 = data.recaudoPorDia.find(d => d.fecha === '2026-09-03');
    expect(dia3.totalDia).toBe(5000000);
    const dia5 = data.recaudoPorDia.find(d => d.fecha === '2026-09-05');
    expect(dia5.totalDia).toBe(1500000);
  });
});
