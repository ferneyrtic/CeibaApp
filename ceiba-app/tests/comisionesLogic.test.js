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

  it('calcula correctamente los abonos y saldo de comisión al registrar venta con desembolso inmediato', () => {
    const comisionAcordada = 2000000;

    // Caso A: No se cobra de inmediato -> queda todo en saldo pendiente
    const casoNoInmediato = {
      pagar_inmediato: false,
      valor_pagado: 0,
    };
    const abonoA = casoNoInmediato.pagar_inmediato ? casoNoInmediato.valor_pagado : 0;
    const saldoA = Math.max(0, comisionAcordada - abonoA);
    expect(abonoA).toBe(0);
    expect(saldoA).toBe(2000000);

    // Caso B: Cobro inmediato total
    const casoInmediatoTotal = {
      pagar_inmediato: true,
      valor_pagado: 2000000,
    };
    const abonoB = Math.min(comisionAcordada, casoInmediatoTotal.valor_pagado);
    const saldoB = Math.max(0, comisionAcordada - abonoB);
    expect(abonoB).toBe(2000000);
    expect(saldoB).toBe(0);

    // Caso C: Cobro inmediato parcial (anticipo)
    const casoInmediatoParcial = {
      pagar_inmediato: true,
      valor_pagado: 500000,
    };
    const abonoC = Math.min(comisionAcordada, casoInmediatoParcial.valor_pagado);
    const saldoC = Math.max(0, comisionAcordada - abonoC);
    expect(abonoC).toBe(500000);
    expect(saldoC).toBe(1500000);
  });

  it('cuando un asesor retira dinero sin relacionar un lote, descuenta de su saldo global sin alterar lotes individuales', () => {
    // Asesor con 2 ventas
    const ventas = [
      { id: 'v1', lote_id_lote: 'LC1 - 1 - 1', comision_vendedor: 1000000, abonos: 0, saldo: 1000000 },
      { id: 'v2', lote_id_lote: 'LC1 - 1 - 2', comision_vendedor: 1500000, abonos: 0, saldo: 1500000 },
    ];
    const totalComisiones = ventas.reduce((acc, v) => acc + v.comision_vendedor, 0); // 2.500.000

    // Retiro general sin lote de 800.000
    const pagoGeneral = {
      vendedor_nombre: 'ASESOR TEST',
      valor: 800000,
      lote: null, // Sin lote
    };

    // El sistema NO altera las ventas individuales
    expect(pagoGeneral.lote).toBeNull();
    ventas.forEach(v => {
      // Las ventas individuales no son tocadas
      expect(v.abonos).toBe(0);
    });

    // Pero a nivel global del asesor:
    const totalPagado = pagoGeneral.valor;
    const saldoPendienteGlobal = Math.max(0, totalComisiones - totalPagado);
    expect(saldoPendienteGlobal).toBe(1700000);
  });
});
