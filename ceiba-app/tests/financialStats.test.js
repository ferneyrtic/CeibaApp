import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/supabase.js', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

// Mock getCartera
vi.mock('../src/lib/api/cartera.js', () => {
  return {
    getCartera: vi.fn(),
    clearCarteraCache: vi.fn(),
  };
});

import { supabase } from '../src/lib/supabase.js';
import { getCartera } from '../src/lib/api/cartera.js';
import { getSharedFinancialStats, clearFinancialStatsCache } from '../src/lib/api/financialStats.js';

describe('financialStats - getSharedFinancialStats', () => {
  beforeEach(() => {
    clearFinancialStatsCache();
    vi.clearAllMocks();
  });

  it('debe incluir contratos PAGADO EN SU TOTALIDAD y VENDIDO en el total de ventas e iniciales', async () => {
    // Mock de carteraData con 1 VENDIDO y 1 PAGADO EN SU TOTALIDAD
    const mockCartera = [
      {
        venta_id: 'v1',
        estado: 'VENDIDO',
        precio_venta: 50000000,
        valor_cuota_inicial: 10000000,
        saldo_financiado: 40000000,
        cuotas_pagadas_monto: 10000000,
        saldo: 30000000,
        cuotas_vencidas: 1,
        fecha_venta: '2025-01-01',
      },
      {
        venta_id: 'v2',
        estado: 'PAGADO EN SU TOTALIDAD', // Debe incluirse en las métricas consolidadas!
        precio_venta: 40000000,
        valor_cuota_inicial: 8000000,
        saldo_financiado: 32000000,
        cuotas_pagadas_monto: 32000000,
        saldo: 0,
        cuotas_vencidas: 0,
        fecha_venta: '2025-02-01',
      },
      {
        venta_id: 'v3',
        estado: 'DISPONIBLE', // NO debe sumarse a ventas
        precio_venta: 30000000,
        valor_cuota_inicial: 0,
        saldo_financiado: 0,
        cuotas_pagadas_monto: 0,
        saldo: 0,
        cuotas_vencidas: 0,
        fecha_venta: null,
      },
    ];

    getCartera.mockResolvedValue(mockCartera);

    supabase.from.mockImplementation((table) => {
      if (table === 'lotes') {
        return {
          select: async () => ({
            data: [
              { estado: 'VENDIDO' },
              { estado: 'VENDIDO' },
              { estado: 'DISPONIBLE' },
            ],
            error: null,
          }),
        };
      }
      if (table === 'cuotas') {
        return {
          select: (fields, options) => {
            if (options?.head) {
              return {
                eq: async () => ({ count: 5, error: null }),
                gte: () => ({
                  lte: () => ({
                    neq: async () => ({ count: 2, error: null }),
                  }),
                }),
              };
            }
            // Mora venta ids
            return {
              eq: () => ({
                limit: async () => ({ data: [{ venta_id: 'v1' }], error: null }),
              }),
            };
          },
        };
      }
      return { select: () => ({}) };
    });

    const stats = await getSharedFinancialStats(true);

    // Verificación de inclusión de ambos contratos vendidos (VENDIDO + PAGADO EN SU TOTALIDAD)
    expect(stats.totalVentas).toBe(2);
    expect(stats.totalValorVentas).toBe(90000000); // 50M + 40M
    expect(stats.totalCuotaInicial).toBe(18000000); // 10M + 8M
    expect(stats.totalSaldoFinanciado).toBe(72000000); // 40M + 32M
    expect(stats.totalCuotasPagadas).toBe(42000000); // 10M + 32M
    expect(stats.totalRecaudado).toBe(60000000); // 18M iniciales + 42M cuotas
    expect(stats.totalSaldo).toBe(30000000); // 72M financiado - 42M pagado

    // Con saldo: solo v1 tiene saldo > 0
    expect(stats.conSaldo).toBe(1);

    // Mora: v1 en mora, v2 al día
    expect(stats.clientesEnMora).toBe(1);
    expect(stats.clientesAlDia).toBe(1);
  });
});
