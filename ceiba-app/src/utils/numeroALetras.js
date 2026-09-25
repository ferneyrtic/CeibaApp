/**
 * Utilidad bancaria colombiana para convertir números a palabras en pesos colombianos (COP).
 * Formato estándar: "QUINIENTOS MIL PESOS M/CTE"
 */

const UNIDADES = [
  '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'
];

const DECENAS = [
  '', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'
];

const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
  'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
];

function seccion(num, divisor, strSingular, strPlural) {
  const cientos = Math.floor(num / divisor);
  const resto = num - cientos * divisor;
  let letras = '';

  if (cientos > 0) {
    if (cientos > 1) {
      letras = `${convertirNumero(cientos)} ${strPlural}`;
    } else {
      letras = strSingular;
    }
  }

  if (resto > 0) {
    letras += '';
  }

  return { letras: letras.trim(), resto };
}

function convertirNumero(num) {
  if (num === 0) return 'CERO';
  if (num === 100) return 'CIEN';

  if (num < 30) {
    return UNIDADES[num];
  }

  if (num < 100) {
    const decena = Math.floor(num / 10);
    const unidad = num % 10;
    if (unidad === 0) return DECENAS[decena];
    return `${DECENAS[decena]} Y ${UNIDADES[unidad]}`;
  }

  if (num < 1000) {
    const centena = Math.floor(num / 100);
    const resto = num % 100;
    if (resto === 0) {
      return CENTENAS[centena];
    }
    return `${CENTENAS[centena]} ${convertirNumero(resto)}`.trim();
  }

  // Miles de Millones
  if (num >= 1000000000) {
    const milesMillones = Math.floor(num / 1000000000);
    const resto = num % 1000000000;
    let prefijo = milesMillones === 1 ? 'MIL MILLONES' : `${convertirNumero(milesMillones)} MIL MILLONES`;
    if (resto > 0) {
      return `${prefijo} ${convertirNumero(resto)}`.trim();
    }
    return prefijo;
  }

  // Millones
  if (num >= 1000000) {
    const millones = Math.floor(num / 1000000);
    const resto = num % 1000000;
    let prefijo = millones === 1 ? 'UN MILLÓN' : `${convertirNumero(millones)} MILLONES`;
    if (resto > 0) {
      return `${prefijo} ${convertirNumero(resto)}`.trim();
    }
    return `${prefijo} DE`;
  }

  // Miles
  if (num >= 1000) {
    const miles = Math.floor(num / 1000);
    const resto = num % 1000;
    let prefijo = miles === 1 ? 'MIL' : `${convertirNumero(miles)} MIL`;
    if (resto > 0) {
      return `${prefijo} ${convertirNumero(resto)}`.trim();
    }
    return prefijo;
  }

  return '';
}

/**
 * Convierte un número a pesos colombianos en letras con sufijo M/CTE
 * @param {number|string} valor 
 * @returns {string} Ejemplo: "QUINIENTOS MIL PESOS M/CTE"
 */
export function numeroALetrasCOP(valor) {
  const num = Math.round(Math.abs(Number(valor) || 0));
  if (num === 0) return 'CERO PESOS M/CTE';

  let letras = convertirNumero(num).trim();

  // Si termina en MILLÓN o MILLONES directamente (sin miles o unidades posteriores), agregar 'DE'
  if (letras.endsWith('MILLÓN') || letras.endsWith('MILLONES')) {
    letras += ' DE';
  }

  return `${letras} PESOS M/CTE`;
}

export default numeroALetrasCOP;
