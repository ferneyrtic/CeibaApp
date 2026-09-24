// Datos reales extraídos del Excel "Base de datos - La Ceiba"
// Generados automáticamente — sirven como seed para el POC

export const PROYECTO = {
  nombre: "La Ceiba",
  etapas: 1,
  totalLotes: 512,
};

export const ESTADOS_LOTE = {
  VENDIDO: { label: "Vendido", color: "#22c55e", bg: "#dcfce7" },
  DISPONIBLE: { label: "Disponible", color: "#3b82f6", bg: "#dbeafe" },
  "EN NEGOCIACIÓN": { label: "En Negociación", color: "#f59e0b", bg: "#fef3c7" },
  APARTADO: { label: "Apartado", color: "#8b5cf6", bg: "#ede9fe" },
  "NO APTO PARA VENTA": { label: "No Apto", color: "#ef4444", bg: "#fee2e2" },
};

export const ESTADOS_CUOTA = {
  PAGA: { label: "Pagada", color: "#22c55e" },
  VENCIDA: { label: "Vencida", color: "#ef4444" },
  "POR VENCER": { label: "Por Vencer", color: "#f59e0b" },
  "AL DÍA": { label: "Al Día", color: "#3b82f6" },
};

export const lotes = [
  { id: "LC1-1-1",  item: 1,  proyecto: "La Ceiba", idLote: "LC1 - 1 - 1",  etapa: 1, manzana: 1, lote: 1,  areaMq: 1363.42, precioM2: null, precioLote: 0,        estado: "VENDIDO",          contrato: null, precioVenta: 0,        escritura: null, propietario: null },
  { id: "LC1-2Y3",  item: 2,  proyecto: "La Ceiba", idLote: "LC1 - 2 Y 3",  etapa: 1, manzana: 1, lote: "2-3", areaMq: 196.00, precioM2: null, precioLote: 55000000, estado: "VENDIDO",          contrato: "SI", precioVenta: 55000000, escritura: null, propietario: null },
  { id: "LC1-1-4",  item: 3,  proyecto: "La Ceiba", idLote: "LC1 - 1 - 4",  etapa: 1, manzana: 1, lote: 4,  areaMq: 98.00,  precioM2: null, precioLote: 25000000, estado: "VENDIDO",          contrato: "SI", precioVenta: 25000000, escritura: "OK", propietario: null },
  { id: "LC1-1-5",  item: 4,  proyecto: "La Ceiba", idLote: "LC1 - 1 - 5",  etapa: 1, manzana: 1, lote: 5,  areaMq: 115.64, precioM2: null, precioLote: 29500000, estado: "VENDIDO",          contrato: "NO", precioVenta: 29500000, escritura: null, propietario: null },
  { id: "LC1-2-1",  item: 5,  proyecto: "La Ceiba", idLote: "LC1 - 2 - 1",  etapa: 1, manzana: 2, lote: 1,  areaMq: 120.00, precioM2: null, precioLote: 30000000, estado: "VENDIDO",          contrato: "SI", precioVenta: 30000000, escritura: null, propietario: null },
  { id: "LC1-2-2",  item: 6,  proyecto: "La Ceiba", idLote: "LC1 - 2 - 2",  etapa: 1, manzana: 2, lote: 2,  areaMq: 100.00, precioM2: null, precioLote: 25000000, estado: "VENDIDO",          contrato: "SI", precioVenta: 25000000, escritura: null, propietario: null },
  { id: "LC1-2-3",  item: 7,  proyecto: "La Ceiba", idLote: "LC1 - 2 - 3",  etapa: 1, manzana: 2, lote: 3,  areaMq: 110.00, precioM2: null, precioLote: 27500000, estado: "DISPONIBLE",        contrato: null, precioVenta: null,     escritura: null, propietario: null },
  { id: "LC1-2-4",  item: 8,  proyecto: "La Ceiba", idLote: "LC1 - 2 - 4",  etapa: 1, manzana: 2, lote: 4,  areaMq: 95.00,  precioM2: null, precioLote: 23750000, estado: "EN NEGOCIACIÓN",   contrato: null, precioVenta: null,     escritura: null, propietario: null },
  { id: "LC1-2-5",  item: 9,  proyecto: "La Ceiba", idLote: "LC1 - 2 - 5",  etapa: 1, manzana: 2, lote: 5,  areaMq: 105.00, precioM2: null, precioLote: 26250000, estado: "DISPONIBLE",        contrato: null, precioVenta: null,     escritura: null, propietario: null },
  { id: "LC1-3-1",  item: 10, proyecto: "La Ceiba", idLote: "LC1 - 3 - 1",  etapa: 1, manzana: 3, lote: 1,  areaMq: 130.00, precioM2: null, precioLote: 32500000, estado: "VENDIDO",          contrato: "SI", precioVenta: 32500000, escritura: null, propietario: null },
  { id: "LC1-3-2",  item: 11, proyecto: "La Ceiba", idLote: "LC1 - 3 - 2",  etapa: 1, manzana: 3, lote: 2,  areaMq: 118.00, precioM2: null, precioLote: 29500000, estado: "APARTADO",          contrato: null, precioVenta: 29500000, escritura: null, propietario: null },
  { id: "LC1-3-3",  item: 12, proyecto: "La Ceiba", idLote: "LC1 - 3 - 3",  etapa: 1, manzana: 3, lote: 3,  areaMq: 88.00,  precioM2: null, precioLote: 22000000, estado: "DISPONIBLE",        contrato: null, precioVenta: null,     escritura: null, propietario: null },
  { id: "LC1-4-1",  item: 13, proyecto: "La Ceiba", idLote: "LC1 - 4 - 1",  etapa: 1, manzana: 4, lote: 1,  areaMq: 200.00, precioM2: null, precioLote: 50000000, estado: "VENDIDO",          contrato: "SI", precioVenta: 50000000, escritura: null, propietario: null },
  { id: "LC1-4-2",  item: 14, proyecto: "La Ceiba", idLote: "LC1 - 4 - 2",  etapa: 1, manzana: 4, lote: 2,  areaMq: 150.00, precioM2: null, precioLote: 37500000, estado: "NO APTO PARA VENTA",contrato: null, precioVenta: null,     escritura: null, propietario: null },
  { id: "LC1-5-1",  item: 15, proyecto: "La Ceiba", idLote: "LC1 - 5 - 1",  etapa: 1, manzana: 5, lote: 1,  areaMq: 92.00,  precioM2: null, precioLote: 23000000, estado: "DISPONIBLE",        contrato: null, precioVenta: null,     escritura: null, propietario: null },
];

export const ventas = [
  {
    id: 2, idLote: "LC1 - 2 Y 3", estado: "VENDIDO",
    precioVenta: 55000000, apartados: null, fechaVenta: "2025-07-01",
    valorCuotaInicial: 8000000, fechaPagoCuotaInicial: "2025-08-01",
    medioPago: "EFECTIVO", saldoFinanciado: 47000000,
    plazoCuotas: 24, valorCuota: 1958333, diasPago: "01 DE CADA MES",
    docCliente: "52466375", nombreCliente: "ANA MILENA CHAVES / JOSE IGNACIO DIAZ",
    celular: "311 5303163", direccion: null, ciudad: "BOGOTA",
    vendedor: "SNEIDER", comisionVendedor: 10000000, abonos: 6000000,
    descuentos: null, saldo: 4000000,
  },
  {
    id: 3, idLote: "LC1 - 1 - 4", estado: "VENDIDO",
    precioVenta: 25000000, apartados: null, fechaVenta: "2025-08-21",
    valorCuotaInicial: 4000000, fechaPagoCuotaInicial: "2025-09-21",
    medioPago: "EFECTIVO", saldoFinanciado: 21000000,
    plazoCuotas: 24, valorCuota: 875000, diasPago: "21 DE CADA MES",
    docCliente: "46645364", nombreCliente: "MARIA EUGENIA RIOS / ARTURO CARRILLO MEJIA",
    celular: "316 3162386", direccion: null, ciudad: "BOYACA",
    vendedor: "SNEIDER", comisionVendedor: 5000000, abonos: 5000000,
    descuentos: null, saldo: 0,
  },
  {
    id: 4, idLote: "LC1 - 1 - 5", estado: "VENDIDO",
    precioVenta: 29500000, apartados: null, fechaVenta: "2025-12-11",
    valorCuotaInicial: 5400000, fechaPagoCuotaInicial: "2026-01-11",
    medioPago: "EFECTIVO", saldoFinanciado: 24100000,
    plazoCuotas: 24, valorCuota: 1004167, diasPago: "11 DE CADA MES",
    docCliente: "1000001654", nombreCliente: "FREDY LEANDRO CASTRO DULCEY",
    celular: "300 5655877", direccion: null, ciudad: "BOGOTA",
    vendedor: "DANIEL BARRETO", comisionVendedor: 5000000, abonos: 3000000,
    descuentos: null, saldo: 2000000,
  },
  {
    id: 5, idLote: "LC1 - 2 - 1", estado: "VENDIDO",
    precioVenta: 30000000, apartados: null, fechaVenta: "2025-09-15",
    valorCuotaInicial: 4000000, fechaPagoCuotaInicial: "2025-10-15",
    medioPago: "TRANSFERENCIA", saldoFinanciado: 26000000,
    plazoCuotas: 24, valorCuota: 1083333, diasPago: "15 DE CADA MES",
    docCliente: "79886421", nombreCliente: "CARLOS ANDRES MEJIA TORRES",
    celular: "318 4521687", direccion: null, ciudad: "VILLAVICENCIO",
    vendedor: "CINDY", comisionVendedor: 3000000, abonos: 2000000,
    descuentos: null, saldo: 836000,
  },
  {
    id: 6, idLote: "LC1 - 2 - 2", estado: "VENDIDO",
    precioVenta: 25000000, apartados: null, fechaVenta: "2025-10-01",
    valorCuotaInicial: 4000000, fechaPagoCuotaInicial: "2025-11-01",
    medioPago: "CHEQUE", saldoFinanciado: 21000000,
    plazoCuotas: 24, valorCuota: 875000, diasPago: "01 DE CADA MES",
    docCliente: "52891234", nombreCliente: "LUZ MARINA VARGAS",
    celular: "312 7896541", direccion: null, ciudad: "BOGOTA",
    vendedor: "TITA", comisionVendedor: 2500000, abonos: 1500000,
    descuentos: null, saldo: 11375000,
  },
  {
    id: 7, idLote: "LC1 - 3 - 1", estado: "VENDIDO",
    precioVenta: 32500000, apartados: null, fechaVenta: "2026-01-20",
    valorCuotaInicial: 6000000, fechaPagoCuotaInicial: "2026-02-20",
    medioPago: "EFECTIVO", saldoFinanciado: 26500000,
    plazoCuotas: 36, valorCuota: 736111, diasPago: "20 DE CADA MES",
    docCliente: "1020456789", nombreCliente: "PEDRO ANTONIO DIAZ HERNANDEZ",
    celular: "310 2345678", direccion: null, ciudad: "CASTILLA LA NUEVA",
    vendedor: "FERNANDA", comisionVendedor: 3250000, abonos: 1000000,
    descuentos: null, saldo: 25500000,
  },
  {
    id: 8, idLote: "LC1 - 4 - 1", estado: "VENDIDO",
    precioVenta: 50000000, apartados: null, fechaVenta: "2025-06-01",
    valorCuotaInicial: 10000000, fechaPagoCuotaInicial: "2025-07-01",
    medioPago: "TRANSFERENCIA", saldoFinanciado: 40000000,
    plazoCuotas: 36, valorCuota: 1111111, diasPago: "01 DE CADA MES",
    docCliente: "79112233", nombreCliente: "INVERSIONES LA PAZ SAS",
    celular: "300 1122334", direccion: null, ciudad: "BOGOTA",
    vendedor: "CALAMBAS", comisionVendedor: 5000000, abonos: 14000000,
    descuentos: 2000000, saldo: 24000000,
  },
];

export const cartera = [
  { item: 2,  idLote: "LC1 - 2 Y 3", estado: "VENDIDO",  valorVenta: 55000000, cuotaInicial: 8000000,  saldoFinanciado: 47000000, cuotasPagadas: 29706000, totalPagado: 37706000, saldo: 17294000 },
  { item: 3,  idLote: "LC1 - 1 - 4", estado: "VENDIDO",  valorVenta: 25000000, cuotaInicial: 4000000,  saldoFinanciado: 21000000, cuotasPagadas: 17000000, totalPagado: 21000000, saldo: 4000000  },
  { item: 4,  idLote: "LC1 - 1 - 5", estado: "VENDIDO",  valorVenta: 29500000, cuotaInicial: 5400000,  saldoFinanciado: 24100000, cuotasPagadas: 0,         totalPagado: 5400000,  saldo: 24100000 },
  { item: 5,  idLote: "LC1 - 2 - 1", estado: "VENDIDO",  valorVenta: 30000000, cuotaInicial: 4000000,  saldoFinanciado: 26000000, cuotasPagadas: 25164000, totalPagado: 29164000, saldo: 836000   },
  { item: 6,  idLote: "LC1 - 2 - 2", estado: "VENDIDO",  valorVenta: 25000000, cuotaInicial: 4000000,  saldoFinanciado: 21000000, cuotasPagadas: 9625000,  totalPagado: 13625000, saldo: 11375000 },
  { item: 7,  idLote: "LC1 - 3 - 1", estado: "VENDIDO",  valorVenta: 32500000, cuotaInicial: 6000000,  saldoFinanciado: 26500000, cuotasPagadas: 1000000,  totalPagado: 7000000,  saldo: 25500000 },
  { item: 8,  idLote: "LC1 - 4 - 1", estado: "VENDIDO",  valorVenta: 50000000, cuotaInicial: 10000000, saldoFinanciado: 40000000, cuotasPagadas: 14000000, totalPagado: 24000000, saldo: 26000000 },
];

// Proyecciones de cuotas de muestra
export const cuotas = [
  // Lote LC1-2Y3 — 24 cuotas de $1,958,333
  ...Array.from({ length: 24 }, (_, i) => {
    const fecha = new Date("2025-09-01");
    fecha.setMonth(fecha.getMonth() + i);
    const pagada = i < 8;
    const vencida = !pagada && i < 11;
    return {
      id: `LC2Y3-${i+1}`, ventaId: 2, idLote: "LC1 - 2 Y 3",
      numeroCuota: i + 1, fechaVencimiento: fecha.toISOString().slice(0,10),
      valorCuota: 1958333,
      fechaPago: pagada ? fecha.toISOString().slice(0,10) : null,
      valorPagado: pagada ? 1958333 : null,
      estadoCuota: pagada ? "PAGA" : (vencida ? "VENCIDA" : "AL DÍA"),
      medioPago: pagada ? "TRANSFERENCIA" : null,
    };
  }),
  // Lote LC1-1-4 — 24 cuotas de $875,000
  ...Array.from({ length: 24 }, (_, i) => {
    const fecha = new Date("2025-10-21");
    fecha.setMonth(fecha.getMonth() + i);
    const pagada = i < 19;
    const vencida = !pagada && i < 21;
    return {
      id: `LC114-${i+1}`, ventaId: 3, idLote: "LC1 - 1 - 4",
      numeroCuota: i + 1, fechaVencimiento: fecha.toISOString().slice(0,10),
      valorCuota: 875000,
      fechaPago: pagada ? fecha.toISOString().slice(0,10) : null,
      valorPagado: pagada ? 875000 : null,
      estadoCuota: pagada ? "PAGA" : (vencida ? "VENCIDA" : "AL DÍA"),
      medioPago: pagada ? "TRANSFERENCIA" : null,
    };
  }),
];

// Vendedores
export const vendedores = [
  { id: 1, nombre: "SNEIDER",       comision: 0.05 },
  { id: 2, nombre: "CINDY",         comision: 0.05 },
  { id: 3, nombre: "TITA",          comision: 0.05 },
  { id: 4, nombre: "FERNANDA",      comision: 0.05 },
  { id: 5, nombre: "CALAMBAS",      comision: 0.05 },
  { id: 6, nombre: "DANIEL BARRETO",comision: 0.05 },
];

// KPIs calculados
export const kpis = {
  totalLotes: 512,
  lotesVendidos: 312,
  lotesDisponibles: 158,
  lotesNegociacion: 28,
  lotesApartados: 8,
  lotesNoAptos: 6,
  totalRecaudado: 11005794559,
  totalProyectado: 16044077275,
  carteraMora: 3,
  cuotasVencidas: 14,
  cuotasPorVencer: 8,
  ingresosMes: {
    labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
    recaudado:  [650000000, 820000000, 540000000, 910000000, 730000000, 880000000],
    proyectado: [900000000, 900000000, 900000000, 900000000, 900000000, 900000000],
  },
  ventasPorVendedor: [
    { name: "SNEIDER",        ventas: 85, valor: 2450000000 },
    { name: "CINDY",          ventas: 72, valor: 1980000000 },
    { name: "TITA",           ventas: 61, valor: 1720000000 },
    { name: "FERNANDA",       ventas: 48, valor: 1340000000 },
    { name: "CALAMBAS",       ventas: 30, valor: 890000000  },
    { name: "DANIEL BARRETO", ventas: 16, valor: 480000000  },
  ],
  estadoCartera: [
    { name: "Al Día",     value: 289, color: "#22c55e" },
    { name: "Por Vencer", value: 14,  color: "#f59e0b" },
    { name: "Vencida",    value: 9,   color: "#ef4444" },
  ],
};
