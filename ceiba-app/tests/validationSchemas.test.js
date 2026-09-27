import { describe, it, expect } from 'vitest';
import {
  validarPagoReciboPayload,
  validarGastoPayload,
  validarCasoEspecialPayload,
  ValidationError
} from '../src/lib/validation/schemas';

describe('Contratos y Esquemas de Validación (Clean Architecture & Data Integrity)', () => {
  describe('validarPagoReciboPayload', () => {
    it('debe lanzar ValidationError si el payload no es un objeto', () => {
      expect(() => validarPagoReciboPayload(null)).toThrow(ValidationError);
      expect(() => validarPagoReciboPayload('invalido')).toThrow(ValidationError);
    });

    it('debe rechazar montos menores o iguales a cero', () => {
      expect(() => validarPagoReciboPayload({
        monto: 0,
        fechaPago: '2026-09-26',
        ventaId: 10
      })).toThrow('El monto a pagar debe ser un número mayor a cero.');

      expect(() => validarPagoReciboPayload({
        monto: -500000,
        fechaPago: '2026-09-26',
        ventaId: 10
      })).toThrow('El monto a pagar debe ser un número mayor a cero.');
    });

    it('debe rechazar montos absurdos o desbordantes (> 1.000.000.000 COP)', () => {
      expect(() => validarPagoReciboPayload({
        monto: 1000000001,
        fechaPago: '2026-09-26',
        ventaId: 10
      })).toThrow('El monto excede el límite permitido por transacción');
    });

    it('debe validar el formato de fecha ISO YYYY-MM-DD', () => {
      expect(() => validarPagoReciboPayload({
        monto: 500000,
        fechaPago: '26/09/2026',
        ventaId: 10
      })).toThrow('La fecha de pago debe tener el formato válido YYYY-MM-DD.');
    });

    it('debe rechazar medios de pago no permitidos', () => {
      expect(() => validarPagoReciboPayload({
        monto: 500000,
        fechaPago: '2026-09-26',
        medioPago: 'CRIPTOMONEDA',
        ventaId: 10
      })).toThrow('Medio de pago no reconocido');
    });

    it('debe requerir vinculación con ventaId, cuotaId o afectaciones', () => {
      expect(() => validarPagoReciboPayload({
        monto: 500000,
        fechaPago: '2026-09-26',
        medioPago: 'TRANSFERENCIA'
      })).toThrow('Debe vincular el pago a un contrato (ventaId), cuota (cuotaId) o afectaciones en cascada.');
    });

    it('debe normalizar y aprobar un payload válido', () => {
      const valid = validarPagoReciboPayload({
        monto: '650000.45',
        fechaPago: '2026-09-26',
        medioPago: 'transferencia',
        ventaId: 12
      });

      expect(valid.monto).toBe(650000);
      expect(valid.medioPago).toBe('TRANSFERENCIA');
      expect(valid.ventaId).toBe(12);
    });
  });

  describe('validarGastoPayload', () => {
    it('debe rechazar valores negativos o cero en gastos', () => {
      expect(() => validarGastoPayload({
        valor: -10000,
        concepto: 'Compra de cemento',
        fecha: '2026-09-26'
      })).toThrow('El valor del gasto debe ser un número positivo.');
    });

    it('debe exigir un concepto descriptivo de al menos 5 caracteres', () => {
      expect(() => validarGastoPayload({
        valor: 100000,
        concepto: 'ok',
        fecha: '2026-09-26'
      })).toThrow('El concepto debe contener al menos 5 caracteres descriptivos.');
    });

    it('debe normalizar y limpiar espacios en el concepto y proveedor', () => {
      const g = validarGastoPayload({
        valor: '150000',
        concepto: '  Mantenimiento motobomba  ',
        fecha: '2026-09-26',
        proveedor: '  Ferretería El Progreso  '
      });

      expect(g.valor).toBe(150000);
      expect(g.concepto).toBe('Mantenimiento motobomba');
      expect(g.proveedor).toBe('Ferretería El Progreso');
    });
  });

  describe('validarCasoEspecialPayload', () => {
    it('debe requerir id_lote y titulo', () => {
      expect(() => validarCasoEspecialPayload({
        titulo: 'Demanda civil'
      })).toThrow('El identificador del lote es obligatorio.');

      expect(() => validarCasoEspecialPayload({
        id_lote: 'MZ A LT 01',
        titulo: ''
      })).toThrow('El título o asunto del caso especial es obligatorio.');
    });

    it('debe rechazar montos asociados negativos', () => {
      expect(() => validarCasoEspecialPayload({
        id_lote: 'MZ A LT 01',
        titulo: 'Reestructuración de crédito',
        monto_asociado: -50000
      })).toThrow('El monto asociado al caso no puede ser negativo.');
    });
  });
});
