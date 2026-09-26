import { describe, it, expect } from 'vitest';
import { generarPlanPagos } from '../src/lib/api/ventas';

describe('Ventas - generarPlanPagos', () => {
  it('retorna arreglo vacío si no hay plazo o saldo financiado', () => {
    expect(generarPlanPagos({ saldoFinanciado: 0, plazoCuotas: 12 })).toEqual([]);
    expect(generarPlanPagos({ saldoFinanciado: 1000000, plazoCuotas: 0 })).toEqual([]);
  });

  it('genera el número exacto de cuotas con suma total igual al saldo financiado', () => {
    const saldo = 25000000;
    const plazo = 24;
    const plan = generarPlanPagos({
      saldoFinanciado: saldo,
      plazoCuotas: plazo,
      diasPago: 15,
      fechaPrimeraCuota: '2026-10-15',
    });

    expect(plan.length).toBe(24);
    expect(plan[0].numero_cuota).toBe(1);
    expect(plan[0].fecha_vencimiento).toBe('2026-10-15');
    expect(plan[1].fecha_vencimiento).toBe('2026-11-15');
    expect(plan[23].numero_cuota).toBe(24);

    const totalSum = plan.reduce((acc, c) => acc + c.valor_cuota, 0);
    expect(totalSum).toBe(saldo);
  });

  it('respeta el día de pago pactado ajustando para meses más cortos', () => {
    const plan = generarPlanPagos({
      saldoFinanciado: 10000000,
      plazoCuotas: 6,
      diasPago: 31,
      fechaPrimeraCuota: '2027-01-31',
    });

    expect(plan.length).toBe(6);
    expect(plan[0].fecha_vencimiento).toBe('2027-01-31');
    // Febrero tiene 28 días en 2027
    expect(plan[1].fecha_vencimiento).toBe('2027-02-28');
    // Marzo tiene 31 días
    expect(plan[2].fecha_vencimiento).toBe('2027-03-31');
    // Abril tiene 30 días
    expect(plan[3].fecha_vencimiento).toBe('2027-04-30');
  });
});
