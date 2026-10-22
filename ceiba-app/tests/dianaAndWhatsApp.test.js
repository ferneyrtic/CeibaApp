import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, getNormalizedRole } from '../src/context/AuthContext';
import { formatWhatsAppNumber, getWhatsAppLink } from '../src/utils/helpers';

describe('Rol y Permisos de Diana (Soporte)', () => {
  it('debe reconocer el rol "soporte" en getNormalizedRole', () => {
    const userRole = { user_metadata: { role: 'soporte' }, email: 'diana@ceiba.com' };
    expect(getNormalizedRole(userRole)).toBe('soporte');

    const userEmail = { user_metadata: {}, email: 'diana@ceiba.com' };
    expect(getNormalizedRole(userEmail)).toBe('soporte');

    const userSoporteEmail = { user_metadata: {}, email: 'soporte@ceiba.com' };
    expect(getNormalizedRole(userSoporteEmail)).toBe('soporte');
  });

  it('debe tener los permisos correctos definidos para Soporte Mora', () => {
    const soportePerms = ROLE_PERMISSIONS.soporte;
    expect(soportePerms).toBeDefined();
    expect(soportePerms.label).toBe('Soporte Mora');
    expect(soportePerms.canManageRecibos).toBe(true);
    expect(soportePerms.canViewHistorialAcciones).toBe(true);
    expect(soportePerms.canViewCierre).toBe(false);
    expect(soportePerms.canViewConfig).toBe(false);
    expect(soportePerms.canDeleteRecibos).toBe(false);
  });
});

describe('Generación de Enlace WhatsApp para Cartera en Mora', () => {
  it('debe formatear teléfonos celulares con código de Colombia (wa.me/57xxxx)', () => {
    const celularStandard = '313 2213086';
    const num = formatWhatsAppNumber(celularStandard);
    expect(num).toBe('573132213086');

    const link = getWhatsAppLink(celularStandard);
    expect(link).toBe('https://wa.me/573132213086');
  });

  it('debe manejar números con prefijo +57', () => {
    const celConPrefijo = '+57 314 3043270';
    expect(getWhatsAppLink(celConPrefijo)).toBe('https://wa.me/573143043270');
  });

  it('debe manejar clientes con teléfonos múltiples', () => {
    const celMultiple = '316 3162386 / 310 1234567';
    expect(getWhatsAppLink(celMultiple)).toBe('https://wa.me/573163162386');
  });
});
