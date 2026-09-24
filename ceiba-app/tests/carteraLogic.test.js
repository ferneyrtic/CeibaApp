import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/supabase.js', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../src/lib/supabase.js';
import { getCartera, clearCarteraCache } from '../src/lib/api/cartera.js';

describe('cartera - getCartera y applyCarteraFilters', () => {
  beforeEach(() => {
    clearCarteraCache();
    vi.clearAllMocks();
  });

  const mockCarteraTotal = [
    {
      venta_id: 'v1',
      id_lote: 'LC1 - 1 - 1',
      estado: 'VENDIDO',
      valor_venta: 50000000,
      cuota_inicial: 10000000,
      saldo_financiado: 40000000,
      cuotas_pagadas: 10000000,
      saldo: 30000000,
      cliente_nombre: 'Carlos Sanchez',
      vendedor_nombre: 'Asesor Juan',
      cuotas_vencidas: 2,
      cuotas_por_vencer: 2,
      cuotas_pagadas_count: 5,
      total_cuotas: 20,
      fecha_venta: '2025-05-01'
    },
    {
      venta_id: 'v2',
      id_lote: 'LC1 - 2 - 3',
      estado: 'PAGADO EN SU TOTALIDAD',
      valor_venta: 30000000,
      cuota_inicial: 5000000,
      saldo_financiado: 25000000,
      cuotas_pagadas: 25000000,
      saldo: 0,
      cliente_nombre: 'Maria Lopez',
      vendedor_nombre: 'Asesor Pedro',
      cuotas_vencidas: 0,
      cuotas_por_vencer: 0,
      cuotas_pagadas_count: 12,
      total_cuotas: 12,
      fecha_venta: '2025-06-01'
    },
    {
      venta_id: 'v3',
      id_lote: 'LC2 - 10 - 5',
      estado: 'VENDIDO',
      valor_venta: 40000000,
      cuota_inicial: 8000000,
      saldo_financiado: 32000000,
      cuotas_pagadas: 8000000,
      saldo: 24000000,
      cliente_nombre: 'Andres Castro',
      vendedor_nombre: 'Asesor Juan',
      cuotas_vencidas: 6, // Caso crítico
      cuotas_por_vencer: 0,
      cuotas_pagadas_count: 4,
      total_cuotas: 16,
      fecha_venta: '2025-01-10'
    },
    {
      venta_id: 'v4',
      id_lote: 'LC2 - 15 - 8',
      estado: 'VENDIDO',
      valor_venta: 25000000,
      cuota_inicial: 5000000,
      saldo_financiado: 20000000,
      cuotas_pagadas: 0,
      saldo: 20000000,
      cliente_nombre: 'Cliente Sin Gestión',
      vendedor_nombre: 'Asesor Juan',
      cuotas_vencidas: 0,
      cuotas_por_vencer: 10,
      cuotas_pagadas_count: 0,
      total_cuotas: 10,
      fecha_venta: null // Sin fecha de venta
    }
  ];

  const mockVentasDetalle = [
    {
      id: 'v1',
      dias_pago: '05 de cada mes',
      medio_pago: 'Transferencia',
      lotes: { id_lote: 'LC1 - 1 - 1', manzana: '1', lote: '1', etapa: 1, area_m2: 120 },
      clientes: { id: 'cl1', nombre: 'Carlos Sanchez', doc_cliente: '1098765432', celular: '3001234567' }
    },
    {
      id: 'v2',
      dias_pago: '10 de cada mes',
      medio_pago: 'Efectivo',
      lotes: { id_lote: 'LC1 - 2 - 3', manzana: '2', lote: '3', etapa: 1, area_m2: 100 },
      clientes: { id: 'cl2', nombre: 'Maria Lopez', doc_cliente: '52345678', celular: '3109876543' }
    },
    {
      id: 'v3',
      dias_pago: '15 de cada mes',
      medio_pago: 'Transferencia',
      lotes: { id_lote: 'LC2 - 10 - 5', manzana: '10', lote: '5', etapa: 2, area_m2: 150 },
      clientes: { id: 'cl3', nombre: 'Andres Castro', doc_cliente: '79888999', celular: '3151112233' }
    },
    {
      id: 'v4',
      dias_pago: '20 de cada mes',
      medio_pago: 'Transferencia',
      lotes: { id_lote: 'LC2 - 15 - 8', manzana: '15', lote: '8', etapa: 2, area_m2: 98 },
      clientes: { id: 'cl4', nombre: 'Cliente Sin Gestión', doc_cliente: '88776655', celular: '3205556677' }
    }
  ];

  // Cuotas críticas (>180 días): venta v3 tiene cuota crítica
  const mockCriticas = [{ venta_id: 'v3' }];

  function setupSupabaseMock() {
    supabase.from.mockImplementation((table) => {
      if (table === 'v_cartera_total') {
        return {
          select: () => ({
            order: async () => ({ data: mockCarteraTotal, error: null })
          })
        };
      }
      if (table === 'ventas') {
        return {
          select: async () => ({ data: mockVentasDetalle, error: null })
        };
      }
      if (table === 'cuotas') {
        return {
          select: () => ({
            eq: () => ({
              lte: async () => ({ data: mockCriticas, error: null })
            })
          })
        };
      }
      return { select: () => ({}) };
    });
  }

  it('debe consolidar contratos, calcular saldo real y marcar casos críticos', async () => {
    setupSupabaseMock();
    const data = await getCartera({ forceRefresh: true });

    expect(data.length).toBe(4);

    // v1: saldo real = 40M saldoFin - 10M pagadas = 30M
    const v1 = data.find(c => c.venta_id === 'v1');
    expect(v1.saldo).toBe(30000000);
    expect(v1.total_pagado).toBe(20000000); // 10M inicial + 10M cuotas
    expect(v1.es_critico).toBe(false);

    // v3: caso crítico >180 días
    const v3 = data.find(c => c.venta_id === 'v3');
    expect(v3.es_critico).toBe(true);
  });

  it('filtro "Con Saldo" debe excluir contratos pagados en su totalidad', async () => {
    setupSupabaseMock();
    const conSaldo = await getCartera({ filtroEstado: 'Con Saldo', forceRefresh: false });
    expect(conSaldo.length).toBe(3); // v1, v3, v4
    expect(conSaldo.some(c => c.venta_id === 'v2')).toBe(false);
  });

  it('filtro "Pagado" debe incluir contratos con saldo 0 o PAGADO EN SU TOTALIDAD', async () => {
    setupSupabaseMock();
    const pagados = await getCartera({ filtroEstado: 'Pagado', forceRefresh: false });
    expect(pagados.length).toBe(1);
    expect(pagados[0].venta_id).toBe('v2');
    expect(pagados[0].estado).toBe('PAGADO EN SU TOTALIDAD');
  });

  it('filtro "En Mora" debe filtrar contratos con cuotas_vencidas > 0', async () => {
    setupSupabaseMock();
    const enMora = await getCartera({ filtroEstado: 'En Mora', forceRefresh: false });
    expect(enMora.length).toBe(2); // v1 (2 vencidas), v3 (6 vencidas)
    expect(enMora.map(c => c.venta_id).sort()).toEqual(['v1', 'v3']);
  });

  it('filtro "Sin Gestión" debe filtrar contratos sin fecha de venta pero con saldo', async () => {
    setupSupabaseMock();
    const sinGestion = await getCartera({ filtroEstado: 'Sin Gestión', forceRefresh: false });
    expect(sinGestion.length).toBe(1);
    expect(sinGestion[0].venta_id).toBe('v4');
  });

  it('filtro "Casos Críticos" debe filtrar contratos con cuotas críticas > 180 días', async () => {
    setupSupabaseMock();
    const criticos = await getCartera({ filtroEstado: '🚨 Casos Críticos (>180 días)', forceRefresh: false });
    expect(criticos.length).toBe(1);
    expect(criticos[0].venta_id).toBe('v3');
  });

  it('búsqueda por texto debe coincidir por lote, cliente, cédula o celular', async () => {
    setupSupabaseMock();

    // Buscar por ID lote
    const porLote = await getCartera({ search: 'LC2 - 10 - 5', forceRefresh: false });
    expect(porLote.length).toBe(1);
    expect(porLote[0].venta_id).toBe('v3');

    // Buscar por nombre de cliente
    const porCliente = await getCartera({ search: 'Maria Lopez', forceRefresh: false });
    expect(porCliente.length).toBe(1);
    expect(porCliente[0].venta_id).toBe('v2');

    // Buscar por documento / cédula
    const porCedula = await getCartera({ search: '1098765432', forceRefresh: false });
    expect(porCedula.length).toBe(1);
    expect(porCedula[0].venta_id).toBe('v1');

    // Buscar por celular
    const porCel = await getCartera({ search: '3151112233', forceRefresh: false });
    expect(porCel.length).toBe(1);
    expect(porCel[0].venta_id).toBe('v3');
  });
});
