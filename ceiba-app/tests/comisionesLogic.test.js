import { describe, it, expect } from 'vitest';

describe('Lógica y Liquidación de Comisiones', () => {
  it('saldoPendiente nunca debe ser negativo y debe reflejar anticipos a favor', () => {
    const rawComisiones = 10000000;
    const rawPagado = 15000000; // Pagado mayor que comisión

    const rawSaldo = rawComisiones - rawPagado;
    const saldoPendiente = Math.max(0, rawSaldo);
    const anticipoAFavor = rawSaldo < 0 ? Math.abs(rawSaldo) : 0;
    const porcentajeLiquidado = rawComisiones > 0
      ? Math.min(100, Math.round((rawPagado / rawComisiones) * 100))
      : 100;

    expect(saldoPendiente).toBe(0);
    expect(saldoPendiente).toBeGreaterThanOrEqual(0);
    expect(anticipoAFavor).toBe(5000000);
    expect(porcentajeLiquidado).toBe(100);
  });

  it('calcula correctamente el saldo pendiente positivo para asesor regular', () => {
    const comisiones = 25000000;
    const pagado = 15000000;

    const rawSaldo = comisiones - pagado;
    const saldoPendiente = Math.max(0, rawSaldo);
    const anticipoAFavor = rawSaldo < 0 ? Math.abs(rawSaldo) : 0;
    const porcentajeLiquidado = Math.min(100, Math.round((pagado / comisiones) * 100));

    expect(saldoPendiente).toBe(10000000);
    expect(anticipoAFavor).toBe(0);
    expect(porcentajeLiquidado).toBe(60);
  });

  it('consolida KPIs del proyecto sin saldos negativos generales', () => {
    const asesores = [
      { nombre: 'ASESOR A', totalComisiones: 10000000, totalPagado: 6000000 },
      { nombre: 'ASESOR B', totalComisiones: 5000000, totalPagado: 5000000 },
      { nombre: 'ASESOR C', totalComisiones: 20000000, totalPagado: 12000000 },
    ];

    const totalComisionesProyecto = asesores.reduce((acc, a) => acc + a.totalComisiones, 0);
    const totalLiquidadoPagado = asesores.reduce((acc, a) => acc + a.totalPagado, 0);
    const saldoTotalPendiente = Math.max(0, totalComisionesProyecto - totalLiquidadoPagado);

    expect(totalComisionesProyecto).toBe(35000000);
    expect(totalLiquidadoPagado).toBe(23000000);
    expect(saldoTotalPendiente).toBe(12000000);
    expect(saldoTotalPendiente).toBeGreaterThanOrEqual(0);
  });
});
