import { describe, it, expect } from 'vitest';
import { numeroALetrasCOP } from '../src/utils/numeroALetras';

describe('numeroALetrasCOP - Conversión bancaria a letras', () => {
  it('convierte montos comunes en cuotas y abonos correctamente', () => {
    expect(numeroALetrasCOP(500000)).toBe('QUINIENTOS MIL PESOS M/CTE');
    expect(numeroALetrasCOP(875000)).toBe('OCHOCIENTOS SETENTA Y CINCO MIL PESOS M/CTE');
    expect(numeroALetrasCOP(1000000)).toBe('UN MILLÓN DE PESOS M/CTE');
    expect(numeroALetrasCOP(1250000)).toBe('UN MILLÓN DOSCIENTOS CINCUENTA MIL PESOS M/CTE');
    expect(numeroALetrasCOP(2000000)).toBe('DOS MILLONES DE PESOS M/CTE');
    expect(numeroALetrasCOP(25000000)).toBe('VEINTICINCO MILLONES DE PESOS M/CTE');
    expect(numeroALetrasCOP(55482000)).toBe('CINCUENTA Y CINCO MILLONES CUATROCIENTOS OCHENTA Y DOS MIL PESOS M/CTE');
  });

  it('maneja cero o valores vacíos', () => {
    expect(numeroALetrasCOP(0)).toBe('CERO PESOS M/CTE');
    expect(numeroALetrasCOP('')).toBe('CERO PESOS M/CTE');
    expect(numeroALetrasCOP(null)).toBe('CERO PESOS M/CTE');
  });

  it('maneja cadenas de texto numéricas', () => {
    expect(numeroALetrasCOP('500000')).toBe('QUINIENTOS MIL PESOS M/CTE');
    expect(numeroALetrasCOP('1000000')).toBe('UN MILLÓN DE PESOS M/CTE');
  });
});
