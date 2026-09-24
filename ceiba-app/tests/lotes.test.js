import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/supabase.js', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../src/lib/supabase.js';
import { getLotes, updateLote } from '../src/lib/api/lotes.js';

describe('lotes - getLotes y updateLote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLotes debe mapear el estado PAGADO EN SU TOTALIDAD si la venta está saldada', async () => {
    const mockLotes = [
      {
        id: 'l1',
        id_lote: 'LC1 - 1 - 1',
        manzana: '1',
        lote: '1',
        estado: 'VENDIDO', // En DB dice VENDIDO por restricción
        ventas: [{ id: 'v1', estado: 'PAGADO EN SU TOTALIDAD', saldo: 0 }]
      },
      {
        id: 'l2',
        id_lote: 'LC1 - 1 - 2',
        manzana: '1',
        lote: '2',
        estado: 'VENDIDO',
        ventas: [{ id: 'v2', estado: 'VENDIDO', saldo: 15000000 }]
      },
      {
        id: 'l3',
        id_lote: 'LC1 - 1 - 3',
        manzana: '1',
        lote: '3',
        estado: 'DISPONIBLE',
        ventas: null
      }
    ];

    supabase.from.mockImplementation(() => ({
      select: () => ({
        order: () => ({
          order: async () => ({ data: mockLotes, error: null })
        })
      })
    }));

    const lotes = await getLotes();
    expect(lotes.length).toBe(3);

    // Lote l1 debe reflejarse como PAGADO EN SU TOTALIDAD
    expect(lotes[0].estado).toBe('PAGADO EN SU TOTALIDAD');

    // Lote l2 sigue VENDIDO
    expect(lotes[1].estado).toBe('VENDIDO');

    // Lote l3 sigue DISPONIBLE
    expect(lotes[2].estado).toBe('DISPONIBLE');
  });

  it('updateLote debe proteger el CHECK constraint de lotes enviando VENDIDO a lotes y PAGADO EN SU TOTALIDAD a ventas', async () => {
    const mockUpdatedLote = {
      id: 'l1',
      id_lote: 'LC1 - 1 - 1',
      estado: 'VENDIDO' // Postgres devuelve VENDIDO
    };

    const recordedOps = [];

    supabase.from.mockImplementation((table) => ({
      update: (payload) => ({
        eq: (field, val) => {
          recordedOps.push({ table, payload, field, val });
          return {
            select: () => ({
              single: async () => ({ data: mockUpdatedLote, error: null })
            })
          };
        }
      })
    }));

    const result = await updateLote('l1', { estado: 'PAGADO EN SU TOTALIDAD' });

    // 1. A la tabla 'lotes' debe enviarse 'VENDIDO' para evitar error de check constraint
    const opLote = recordedOps.find(op => op.table === 'lotes');
    expect(opLote).toBeDefined();
    expect(opLote.payload.estado).toBe('VENDIDO');

    // 2. A la tabla 'ventas' debe enviarse 'PAGADO EN SU TOTALIDAD'
    const opVentas = recordedOps.find(op => op.table === 'ventas');
    expect(opVentas).toBeDefined();
    expect(opVentas.payload.estado).toBe('PAGADO EN SU TOTALIDAD');

    // 3. Al cliente frontend debe devolverle el objeto con estado PAGADO EN SU TOTALIDAD
    expect(result.estado).toBe('PAGADO EN SU TOTALIDAD');
  });
});
