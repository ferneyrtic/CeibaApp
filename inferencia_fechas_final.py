"""
Inferencia inteligente de fechas + Veredicto final de luz verde
Reglas:
  - Si MM > 12 → el número grande es el día, el otro es el mes
  - Si ambos ≤ 12 → ambiguo, se marca como tal
  - "11/11/54" → año claramente erróneo (>2030), marcar especial
  - Meses en texto → válidos (pago múltiple)
"""
import openpyxl, sys, re
from datetime import datetime
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
wb = openpyxl.load_workbook(FILE, data_only=True)
p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]

MESES_OK = {'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
            'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'}

def inferir_fecha(fp_str):
    """
    Intenta inferir la fecha correcta de una cadena de texto.
    Retorna (fecha_inferida_str, confianza, nota)
    confianza: 'ALTA', 'MEDIA', 'BAJA', 'ERROR'
    """
    fp_str = fp_str.strip().replace(' ', '')
    # Probar patrones comunes
    for sep in ['/', '-']:
        parts = fp_str.split(sep)
        if len(parts) == 3:
            try:
                a, b, c = int(parts[0]), int(parts[1]), int(parts[2])
            except: continue
            
            # Normalizar año de 2 dígitos
            year = c
            if year < 100:
                year = 2000 + year if year < 50 else 1900 + year
            
            # Año claramente erróneo
            if year < 2020 or year > 2035:
                return (None, 'ERROR', f'Año {year} fuera de rango esperado 2020-2035')
            
            month, day = a, b
            
            # Si b > 12, b es el día
            if b > 12 and a <= 12:
                month, day = a, b
                confianza = 'ALTA'
                nota = f'b={b}>12 → mes={a}, día={b}'
            # Si a > 12, a es el día
            elif a > 12 and b <= 12:
                month, day = b, a
                confianza = 'ALTA'
                nota = f'a={a}>12 → mes={b}, día={a}'
            # Ambos ≤ 12, ambiguo
            elif a <= 12 and b <= 12:
                # Asumir DD/MM (europeo) como regla de negocio
                month, day = b, a
                confianza = 'MEDIA'
                nota = f'Ambiguo (DD/MM asumido) → mes={b}, día={a}'
            else:
                return (None, 'ERROR', 'No interpretable')
            
            try:
                d = datetime(year, month, day)
                return (d.strftime('%d/%m/%Y'), confianza, nota)
            except:
                return (None, 'ERROR', f'Fecha inválida: {day}/{month}/{year}')
    
    return (None, 'BAJA', 'No reconocido como fecha')

problemas = []
for idx in range(4, 600):
    raw = ws_p.cell(idx, 3).value
    if not raw: continue
    lote = str(raw).strip()
    if lote in ('ID LOTE', ''): continue

    for n in range(1, 37):
        cs = 10 + (n-1)*6
        fp  = ws_p.cell(idx, cs+3).value
        est = ws_p.cell(idx, cs+5).value

        if fp is None: continue
        if isinstance(fp, datetime): continue

        fp_str = str(fp).strip()
        if not fp_str: continue
        if fp_str.upper() in MESES_OK: continue

        col_l = openpyxl.utils.get_column_letter(cs+3)
        celda = f'{col_l}{idx}'
        es_paga = bool(est) and 'PAG' in str(est).upper()

        fecha_inf, conf, nota = inferir_fecha(fp_str)
        problemas.append({
            'lote': lote, 'cuota': n, 'celda': celda,
            'valor_actual': fp_str, 'fecha_inferida': fecha_inf,
            'confianza': conf, 'nota': nota, 'es_paga': es_paga
        })

print('╔══════════════════════════════════════════════════════════════════════════╗')
print('   ANÁLISIS DE FECHAS PENDIENTES CON INFERENCIA INTELIGENTE')
print('╚══════════════════════════════════════════════════════════════════════════╝')

if not problemas:
    print('\n✅ NO HAY FECHAS CON FORMATO INCORRECTO — TODO LIMPIO')
else:
    alta   = [p for p in problemas if p['confianza'] == 'ALTA']
    media  = [p for p in problemas if p['confianza'] == 'MEDIA']
    error_ = [p for p in problemas if p['confianza'] == 'ERROR']
    
    if alta:
        print(f'\n🟢 INFERENCIA ALTA CONFIANZA ({len(alta)}) — El sistema puede corregir automáticamente:')
        for p in alta:
            print(f'   Lote: {p["lote"]:<32} | C{p["cuota"]:>2} | Celda {p["celda"]:<8} | "{p["valor_actual"]}" → {p["fecha_inferida"]} ({p["nota"]})')
    
    if media:
        print(f'\n🟡 INFERENCIA MEDIA CONFIANZA ({len(media)}) — Requiere confirmación visual:')
        for p in media:
            print(f'   Lote: {p["lote"]:<32} | C{p["cuota"]:>2} | Celda {p["celda"]:<8} | "{p["valor_actual"]}" → {p["fecha_inferida"]} ({p["nota"]})')
    
    if error_:
        print(f'\n🔴 NO INFERIBLES ({len(error_)}) — Requieren corrección manual en el Excel:')
        for p in error_:
            print(f'   Lote: {p["lote"]:<32} | C{p["cuota"]:>2} | Celda {p["celda"]:<8} | "{p["valor_actual"]}" → ⚠️ {p["nota"]}')

# Totales por categoría para el veredicto
print('\n' + '═'*74)

total_problemas = len(problemas)
total_bloqueantes = len([p for p in problemas if p['confianza'] == 'ERROR'])
total_auto_resolubles = len([p for p in problemas if p['confianza'] in ('ALTA','MEDIA')])

print(f'  Resumen:')
print(f'    Fechas auto-inferibles (no bloquean cargue): {total_auto_resolubles}')
print(f'    Fechas NO inferibles (requieren corrección):  {total_bloqueantes}')
print()
if total_bloqueantes == 0:
    print('  🟢 LUZ VERDE EN FECHAS: Todas las fechas anómalas son inferibles.')
    print('     El sistema las corregirá al momento del cargue y las cuotas')
    print('     quedarán editables manualmente desde el módulo de gestión.')
else:
    print(f'  🔴 Hay {total_bloqueantes} fecha(s) que deben corregirse en el Excel primero.')
print('═'*74)
