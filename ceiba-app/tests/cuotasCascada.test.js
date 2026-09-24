import { describe, it, expect } from 'vitest';
import { simularAbonoCascada } from '../src/lib/api/cuotas.js';

describe('cuotas - simularAbonoCascada', () => {
  const cuotasMock = [
    { id: 'c1', numero_cuota: 1, valor_cuota: 1000000, valor_pagado: 1000000, estado_cuota: 'PAGA', fecha_vencimiento: '2026-01-10' },
    { id: 'c2', numero_cuota: 2, valor_cuota: 1000000, valor_pagado: 0, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-02-10' },
    { id: 'c3', numero_cuota: 3, valor_cuota: 1000000, valor_pagado: 0, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-03-10' },
    { id: 'c4', numero_cuota: 4, valor_cuota: 1000000, valor_pagado: 0, estado_cuota: 'AL DÍA', fecha_vencimiento: '2026-04-10' },
  ];

  it('debe retornar 0 afectaciones si el monto es 0 o negativo', () => {
    const res0 = simularAbonoCascada(cuotasMock, 0);
    expect(res0.afectaciones.length).toBe(0);
    expect(res0.montoAplicado).toBe(0);
    expect(res0.montoSobrante).toBe(0);

    const resNeg = simularAbonoCascada(cuotasMock, -500000);
    expect(resNeg.afectaciones.length).toBe(0);
  });

  it('debe cubrir exactamente 1 cuota pendiente cuando el monto es igual a 1 cuota', () => {
    // La C1 ya está paga. Debe tomar C2 (la primera pendiente)
    const res = simularAbonoCascada(cuotasMock, 1000000);
    expect(res.afectaciones.length).toBe(1);
    expect(res.afectaciones[0].numero_cuota).toBe(2);
    expect(res.afectaciones[0].valor_abono).toBe(1000000);
    expect(res.afectaciones[0].nuevo_pagado).toBe(1000000);
    expect(res.afectaciones[0].nuevo_estado).toBe('PAGA');
    expect(res.afectaciones[0].completo).toBe(true);
    expect(res.montoAplicado).toBe(1000000);
    expect(res.montoSobrante).toBe(0);
  });

  it('debe cubrir 2 cuotas completas y 1 parcial cuando el monto es 2.5x', () => {
    const res = simularAbonoCascada(cuotasMock, 2500000);
    expect(res.afectaciones.length).toBe(3);

    // Cuota 2: completa (1.000.000)
    expect(res.afectaciones[0].numero_cuota).toBe(2);
    expect(res.afectaciones[0].valor_abono).toBe(1000000);
    expect(res.afectaciones[0].completo).toBe(true);
    expect(res.afectaciones[0].nuevo_estado).toBe('PAGA');

    // Cuota 3: completa (1.000.000)
    expect(res.afectaciones[1].numero_cuota).toBe(3);
    expect(res.afectaciones[1].valor_abono).toBe(1000000);
    expect(res.afectaciones[1].completo).toBe(true);
    expect(res.afectaciones[1].nuevo_estado).toBe('PAGA');

    // Cuota 4: parcial (500.000)
    expect(res.afectaciones[2].numero_cuota).toBe(4);
    expect(res.afectaciones[2].valor_abono).toBe(500000);
    expect(res.afectaciones[2].nuevo_pagado).toBe(500000);
    expect(res.afectaciones[2].completo).toBe(false);
    expect(res.afectaciones[2].nuevo_estado).toBe('AL DÍA');

    expect(res.montoAplicado).toBe(2500000);
    expect(res.montoSobrante).toBe(0);
  });

  it('debe calcular monto sobrante si el abono supera todas las cuotas pendientes', () => {
    // Pendientes C2, C3, C4 suman 3.000.000. Abono de 4.000.000 -> sobran 1.000.000
    const res = simularAbonoCascada(cuotasMock, 4000000);
    expect(res.afectaciones.length).toBe(3);
    expect(res.afectaciones.every(a => a.completo && a.nuevo_estado === 'PAGA')).toBe(true);
    expect(res.montoAplicado).toBe(3000000);
    expect(res.montoSobrante).toBe(1000000);
  });

  it('debe completar cuota con abono parcial previo antes de pasar a la siguiente', () => {
    const cuotasConParcial = [
      { id: 'c1', numero_cuota: 1, valor_cuota: 1000000, valor_pagado: 400000, estado_cuota: 'AL DÍA', fecha_vencimiento: '2026-01-10' },
      { id: 'c2', numero_cuota: 2, valor_cuota: 1000000, valor_pagado: 0, estado_cuota: 'VENCIDA', fecha_vencimiento: '2026-02-10' },
    ];

    // Abona 1.000.000: debe abonar 600.000 para completar C1 y los 400.000 restantes a C2
    const res = simularAbonoCascada(cuotasConParcial, 1000000);
    expect(res.afectaciones.length).toBe(2);

    // C1: faltaban 600.000
    expect(res.afectaciones[0].numero_cuota).toBe(1);
    expect(res.afectaciones[0].valor_anterior).toBe(400000);
    expect(res.afectaciones[0].valor_abono).toBe(600000);
    expect(res.afectaciones[0].nuevo_pagado).toBe(1000000);
    expect(res.afectaciones[0].completo).toBe(true);

    // C2: recibe los 400.000 restantes
    expect(res.afectaciones[1].numero_cuota).toBe(2);
    expect(res.afectaciones[1].valor_anterior).toBe(0);
    expect(res.afectaciones[1].valor_abono).toBe(400000);
    expect(res.afectaciones[1].nuevo_pagado).toBe(400000);
    expect(res.afectaciones[1].completo).toBe(false);
  });
});
