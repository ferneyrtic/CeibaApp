import { describe, it, expect } from 'vitest';
import { formatearLoteDescripcion } from '../src/utils/formatoLote';

describe('formatoLote - Conversión de identificadores a formato oficial', () => {
  it('convierte LC1 - 38 - 4 a Lote 4 Mzn 38 Etapa 1', () => {
    expect(formatearLoteDescripcion('LC1 - 38 - 4')).toBe('Lote 4 Mzn 38 Etapa 1');
  });

  it('convierte variantes sin espacios como LC1-8-3 a Lote 3 Mzn 8 Etapa 1', () => {
    expect(formatearLoteDescripcion('LC1-8-3')).toBe('Lote 3 Mzn 8 Etapa 1');
    expect(formatearLoteDescripcion('LC2 - 15 - 12')).toBe('Lote 12 Mzn 15 Etapa 2');
  });

  it('soporta lotes consolidados con Y como LC1 - 8 - 3 Y 4', () => {
    expect(formatearLoteDescripcion('LC1 - 8 - 3 Y 4')).toBe('Lotes 3 y 4 Mzn 8 Etapa 1');
  });

  it('retorna Lote [nombre] para lotes de prueba como TEST - 03', () => {
    expect(formatearLoteDescripcion('TEST - 03')).toBe('Lote TEST - 03');
  });
});
