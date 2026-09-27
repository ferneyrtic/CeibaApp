/**
 * SCHEMAS Y CONTRATOS DE VALIDACIÓN DE DATOS (Clean Architecture & Defensive Programming)
 * Garantiza integridad de datos y tipos antes de interactuar con la capa de persistencia.
 */

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Valida la estructura requerida para registrar un pago y emitir recibo oficial.
 */
export function validarPagoReciboPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('El payload de pago debe ser un objeto válido.');
  }

  const monto = Number(payload.monto);
  if (isNaN(monto) || monto <= 0) {
    throw new ValidationError('El monto a pagar debe ser un número mayor a cero.', 'monto');
  }

  if (monto > 1000000000) {
    throw new ValidationError('El monto excede el límite permitido por transacción ($1.000.000.000 COP).', 'monto');
  }

  if (!payload.fechaPago || !/^\d{4}-\d{2}-\d{2}$/.test(payload.fechaPago)) {
    throw new ValidationError('La fecha de pago debe tener el formato válido YYYY-MM-DD.', 'fechaPago');
  }

  const mediosValidos = ['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'CONSIGNACIÓN', 'DATÁFONO', 'OTRO'];
  const medio = (payload.medioPago || 'TRANSFERENCIA').toUpperCase();
  if (!mediosValidos.includes(medio)) {
    throw new ValidationError(`Medio de pago no reconocido: ${payload.medioPago}. Debe ser uno de: ${mediosValidos.join(', ')}`, 'medioPago');
  }

  if (!payload.ventaId && !payload.cuotaId && (!payload.afectaciones || !payload.afectaciones.length)) {
    throw new ValidationError('Debe vincular el pago a un contrato (ventaId), cuota (cuotaId) o afectaciones en cascada.', 'ventaId');
  }

  return {
    ...payload,
    monto: Math.round(monto),
    medioPago: medio
  };
}

/**
 * Valida la estructura de un Gasto de Obra o Costo Operativo.
 */
export function validarGastoPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('El payload del gasto debe ser un objeto.');
  }

  const valor = Number(payload.valor);
  if (isNaN(valor) || valor <= 0) {
    throw new ValidationError('El valor del gasto debe ser un número positivo.', 'valor');
  }

  if (!payload.concepto || !payload.concepto.trim()) {
    throw new ValidationError('El concepto o descripción del gasto es obligatorio.', 'concepto');
  }

  if (payload.concepto.trim().length < 5) {
    throw new ValidationError('El concepto debe contener al menos 5 caracteres descriptivos.', 'concepto');
  }

  if (!payload.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(payload.fecha)) {
    throw new ValidationError('La fecha del gasto debe tener formato YYYY-MM-DD.', 'fecha');
  }

  return {
    ...payload,
    valor: Math.round(valor),
    concepto: payload.concepto.trim(),
    proveedor: (payload.proveedor || '').trim()
  };
}

/**
 * Valida la estructura de un Caso Especial de Cartera.
 */
export function validarCasoEspecialPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('El payload del caso especial debe ser un objeto.');
  }

  if (!payload.id_lote || !payload.id_lote.trim()) {
    throw new ValidationError('El identificador del lote es obligatorio.', 'id_lote');
  }

  if (!payload.titulo || !payload.titulo.trim()) {
    throw new ValidationError('El título o asunto del caso especial es obligatorio.', 'titulo');
  }

  if (payload.monto_asociado !== undefined && payload.monto_asociado !== null) {
    const m = Number(payload.monto_asociado);
    if (isNaN(m) || m < 0) {
      throw new ValidationError('El monto asociado al caso no puede ser negativo.', 'monto_asociado');
    }
  }

  return payload;
}
