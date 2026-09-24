import { describe, it, expect } from 'vitest';
import {
  formatCOP,
  formatNumber,
  formatDate,
  getEstadoBadge,
  getEstadoCuotaBadge,
  diasDesdeHoy
} from '../src/utils/helpers.js';

describe('helpers - formatCOP', () => {
  it('debe devolver "—" para valores nulos, indefinidos o vacíos', () => {
    expect(formatCOP(null)).toBe('—');
    expect(formatCOP(undefined)).toBe('—');
    expect(formatCOP('')).toBe('—');
    expect(formatCOP('invalid-text')).toBe('—');
  });

  it('debe formatear números válidos en COP sin decimales', () => {
    const formattedZero = formatCOP(0);
    expect(formattedZero).toContain('0');

    const formatted1M = formatCOP(1000000);
    const clean1M = formatted1M.replace(/\s/g, ' ');
    expect(clean1M.includes('1.000.000') || clean1M.includes('1,000,000')).toBe(true);
    expect(clean1M).toContain('$');
  });

  it('debe admitir números pasados como string', () => {
    const res = formatCOP('2500000');
    expect(res.includes('2.500.000') || res.includes('2,500,000')).toBe(true);
  });
});

describe('helpers - formatNumber', () => {
  it('debe devolver "—" para valores nulos o indefinidos', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
  });

  it('debe formatear números con separadores de miles', () => {
    const res = formatNumber(1234567);
    expect(res.includes('1.234.567') || res.includes('1,234,567')).toBe(true);
  });
});

describe('helpers - formatDate', () => {
  it('debe devolver "—" para valores falsy o nulos', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('None')).toBe('—');
    expect(formatDate('nan')).toBe('—');
  });

  it('debe formatear cadenas ISO YYYY-MM-DD como DD/MM/YYYY', () => {
    expect(formatDate('2026-09-08')).toBe('08/09/2026');
  });

  it('debe formatear timestamps completos correctamente', () => {
    const res = formatDate('2026-03-15T18:30:00.000Z');
    expect(res).toContain('2026');
    expect(res).toContain('03');
  });

  it('debe devolver "—" ante fechas inválidas sin romper la ejecución', () => {
    expect(formatDate('not-a-valid-date')).toBe('—');
  });
});

describe('helpers - getEstadoBadge', () => {
  it('debe mapear correctamente estados reconocidos', () => {
    expect(getEstadoBadge('VENDIDO')).toEqual({ color: '#16a34a', bg: '#dcfce7', label: 'Vendido' });
    expect(getEstadoBadge('PAGADO EN SU TOTALIDAD')).toEqual({ color: '#059669', bg: '#d1fae5', label: 'Pagado en su totalidad' });
    expect(getEstadoBadge('DISPONIBLE')).toEqual({ color: '#2563eb', bg: '#dbeafe', label: 'Disponible' });
    expect(getEstadoBadge('EN NEGOCIACIÓN')).toEqual({ color: '#d97706', bg: '#fef3c7', label: 'En Negociación' });
    expect(getEstadoBadge('NO APTO PARA VENTA')).toEqual({ color: '#dc2626', bg: '#fee2e2', label: 'No Apto' });
  });

  it('debe proporcionar fallback seguro ante estados desconocidos o vacíos', () => {
    expect(getEstadoBadge('ESTADO_INVENTADO')).toEqual({ color: '#6b7280', bg: '#f3f4f6', label: 'ESTADO_INVENTADO' });
    expect(getEstadoBadge(null)).toEqual({ color: '#6b7280', bg: '#f3f4f6', label: 'Sin estado' });
  });
});

describe('helpers - getEstadoCuotaBadge', () => {
  it('debe mapear correctamente los estados de cuota', () => {
    expect(getEstadoCuotaBadge('PAGA')).toEqual({ color: '#16a34a', bg: '#dcfce7', label: 'Paga' });
    expect(getEstadoCuotaBadge('AL DÍA')).toEqual({ color: '#2563eb', bg: '#dbeafe', label: 'Al Día' });
    expect(getEstadoCuotaBadge('POR VENCER')).toEqual({ color: '#d97706', bg: '#fef3c7', label: 'Por Vencer' });
    expect(getEstadoCuotaBadge('VENCIDA')).toEqual({ color: '#dc2626', bg: '#fee2e2', label: 'Vencida' });
  });

  it('debe proporcionar fallback ante cuotas sin estado', () => {
    expect(getEstadoCuotaBadge(null)).toEqual({ color: '#6b7280', bg: '#f3f4f6', label: '—' });
    expect(getEstadoCuotaBadge('')).toEqual({ color: '#6b7280', bg: '#f3f4f6', label: '—' });
  });
});

describe('helpers - diasDesdeHoy', () => {
  it('debe retornar null para fechas nulas', () => {
    expect(diasDesdeHoy(null)).toBeNull();
    expect(diasDesdeHoy('')).toBeNull();
  });

  it('debe calcular días negativos para fechas pasadas y positivos para futuras', () => {
    const toLocalDateStr = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const hoy = new Date();
    const pasada = new Date(hoy);
    pasada.setDate(pasada.getDate() - 10);
    const diffPasada = diasDesdeHoy(toLocalDateStr(pasada));
    expect(diffPasada).toBeGreaterThanOrEqual(-11);
    expect(diffPasada).toBeLessThanOrEqual(-9);

    const futura = new Date(hoy);
    futura.setDate(futura.getDate() + 15);
    const diffFutura = diasDesdeHoy(toLocalDateStr(futura));
    expect(diffFutura).toBeGreaterThanOrEqual(14);
    expect(diffFutura).toBeLessThanOrEqual(16);
  });
});
