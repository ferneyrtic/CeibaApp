/**
 * Utilidad para formatear los códigos de lote al formato oficial de La Ceiba:
 * 'Lote [X] Mzn [X] Etapa [X]'
 * Regla: En 'LC1 - 38 - 4', 1 es Etapa, 38 es Manzana y 4 es Lote.
 */
export function formatearLoteDescripcion(idLote) {
  if (!idLote || typeof idLote !== 'string') return idLote || '';
  const trimmed = idLote.trim();

  // 1. Patrón estándar: LC1 - 38 - 4 o LC1-38-4
  const matchSimple = trimmed.match(/^LC(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)$/i);
  if (matchSimple) {
    const etapa = matchSimple[1];
    const manzana = matchSimple[2];
    const loteNum = matchSimple[3];
    return `Lote ${loteNum} Mzn ${manzana} Etapa ${etapa}`;
  }

  // 2. Patrón consolidado: LC1 - 8 - 3 Y 4
  const matchMulti = trimmed.match(/^LC(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)\s*(?:Y|&)\s*(\d+)$/i);
  if (matchMulti) {
    const etapa = matchMulti[1];
    const manzana = matchMulti[2];
    const loteA = matchMulti[3];
    const loteB = matchMulti[4];
    return `Lotes ${loteA} y ${loteB} Mzn ${manzana} Etapa ${etapa}`;
  }

  // 3. Casos especiales o pruebas (ej. 'TEST - 03')
  return `Lote ${trimmed}`;
}
