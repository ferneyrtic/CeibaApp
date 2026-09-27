import { describe, it, expect, vi } from 'vitest';
import { RecibosRepository } from '../src/lib/repository/recibosRepository';
import { ValidationError } from '../src/lib/validation/schemas';

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

describe('RecibosRepository (Repository Pattern & ACID Enforcement)', () => {
  const repo = new RecibosRepository();

  it('debe abortar procesarPago inmediatamente con ValidationError si los datos son inválidos antes de tocar la base de datos', async () => {
    await expect(repo.procesarPago({
      monto: -100,
      fechaPago: '2026-09-26',
      ventaId: 1
    })).rejects.toThrow(ValidationError);
  });

  it('debe rechazar la anulación de recibos si el rol solicitante es secretaria (Seguridad RLS y Roles)', async () => {
    await expect(repo.anularRecibo({
      numeroRecibo: 1,
      motivo: 'Error de digitación',
      usuarioActual: 'Secretaria General',
      rolUsuario: 'secretaria'
    })).rejects.toThrow('Permiso denegado: El rol de Secretaría no puede anular recibos de caja.');
  });
});
