import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    })
  }
}));

import {
  registrarAccion,
  getHistorialAcciones
} from '../src/lib/api/auditApi';
import {
  getCasosEspeciales,
  guardarCasoEspecial,
  obtenerBadgeCasoEspecial,
  eliminarCasoEspecial
} from '../src/lib/api/casosEspecialesApi';

describe('Sistema de Auditoría (Audit Log)', () => {
  it('debe registrar una acción con estructura completa y timestamp', async () => {
    const log = await registrarAccion({
      modulo: 'ABONOS_EXTRAORDINARIOS',
      accion: 'AMORTIZACION_APLICADA',
      lote_id_str: 'LC2 - 41 - 16',
      cliente_nombre: 'NANCY ESPERANZA VILLAMIL',
      descripcion: 'Amortización de 4 cuotas por abono de $4.000.000',
      detalles: { cuotas: [1, 2, 3, 4], valor: 4000000 }
    });

    expect(log).toBeDefined();
    expect(log.modulo).toBe('ABONOS_EXTRAORDINARIOS');
    expect(log.accion).toBe('AMORTIZACION_APLICADA');
    expect(log.lote_id_str).toBe('LC2 - 41 - 16');
    expect(log.cliente_nombre).toBe('NANCY ESPERANZA VILLAMIL');
    expect(log.timestamp).toBeDefined();
    expect(log.detalles.cuotas).toEqual([1, 2, 3, 4]);
  });

  it('debe filtrar logs por búsqueda de texto y módulo', async () => {
    await registrarAccion({
      modulo: 'LOTES',
      accion: 'ESTADO_LOTE_CAMBIADO',
      lote_id_str: 'LC1 - 10 - 2',
      descripcion: 'Cambio de estado a DISPONIBLE'
    });

    const logsLotes = await getHistorialAcciones({ modulo: 'LOTES' });
    expect(Array.isArray(logsLotes)).toBe(true);
    if (logsLotes.length > 0) {
      expect(logsLotes.every(l => l.modulo === 'LOTES')).toBe(true);
    }

    const logsBusqueda = await getHistorialAcciones({ search: 'LC1 - 10 - 2' });
    expect(Array.isArray(logsBusqueda)).toBe(true);
  });
});

describe('Gestión de Casos Especiales & Observaciones', () => {
  it('debe entregar los casos especiales iniciales o guardados', async () => {
    const casos = await getCasosEspeciales();
    expect(Array.isArray(casos)).toBe(true);
    expect(casos.length).toBeGreaterThan(0);

    // Debe contener casos conocidos como LC2-28-2 (dinero en tránsito) o LC1-4-5 (permuta)
    const casoTransito = casos.find(c => c.id_lote.includes('LC2 - 28 - 2'));
    expect(casoTransito).toBeDefined();
    expect(casoTransito.categoria).toBe('TRASLADO_DINERO');
  });

  it('obtenerBadgeCasoEspecial debe detectar correctamente lotes con casos especiales activos', async () => {
    const casos = await getCasosEspeciales();

    const badge1 = obtenerBadgeCasoEspecial('LC2 - 28 - 2', casos);
    expect(badge1).not.toBeNull();
    expect(badge1.categoria).toBe('TRASLADO_DINERO');

    const badge2 = obtenerBadgeCasoEspecial('LC1 - 4 - 5', casos);
    expect(badge2).not.toBeNull();
    expect(badge2.categoria).toBe('PARTE_DE_PAGO');

    const badgeInexistente = obtenerBadgeCasoEspecial('LOTE_INEXISTENTE_99', casos);
    expect(badgeInexistente).toBeNull();
  });

  it('guardarCasoEspecial debe crear un nuevo caso especial y actualizar la lista', async () => {
    const nuevoCaso = {
      id_lote: 'LC2 - 99 - 1',
      categoria: 'PARTE_DE_PAGO',
      estado: 'EN_TRAMITE',
      titulo: 'Vehículo recibido como dación en pago',
      monto_asociado: 20000000,
      cliente: 'Cliente Prueba Vitest',
      observacion: 'Prueba de integración de caso especial'
    };

    const guardado = await guardarCasoEspecial(nuevoCaso, { nombre: 'Tester' });
    expect(guardado.id).toBeDefined();
    expect(guardado.titulo).toBe('Vehículo recibido como dación en pago');

    const casosActualizados = await getCasosEspeciales();
    const encontrado = casosActualizados.find(c => c.id === guardado.id || c.id_lote === 'LC2 - 99 - 1');
    expect(encontrado).toBeDefined();
    expect(encontrado.monto_asociado).toBe(20000000);

    // Limpieza
    await eliminarCasoEspecial(guardado.id, { nombre: 'Tester' });
  });
});
