"""
Filtro de fechas con formato incorrecto — versión 16:08
Excluye meses en texto (son válidos: pago múltiple sin fecha exacta).
Solo reporta lo que AÚN necesita corrección.
"""
import openpyxl, sys, re
from datetime import datetime
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
wb = openpyxl.load_workbook(FILE, data_only=True)
p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]

# Meses en texto → VÁLIDOS (pago múltiple sin fecha exacta)
MESES_OK = {'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
            'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'}

problemas = []

for idx in range(4, 600):
    raw = ws_p.cell(idx, 3).value
    if not raw: continue
    lote = str(raw).strip()
    if lote in ('ID LOTE', ''): continue

    for n in range(1, 37):
        cs = 10 + (n-1)*6
        fv  = ws_p.cell(idx, cs+1).value
        fp  = ws_p.cell(idx, cs+3).value   # fecha de pago
        vc  = ws_p.cell(idx, cs+4).value
        est = ws_p.cell(idx, cs+5).value

        if fp is None: continue
        fp_str = str(fp).strip()
        col_l  = openpyxl.utils.get_column_letter(cs+3)
        celda  = f'{col_l}{idx}'

        # Si es un objeto datetime de Excel → correcto, ignorar
        if isinstance(fp, datetime): continue

        # Si es texto de mes → VÁLIDO por regla de negocio
        if fp_str.upper() in MESES_OK: continue

        # Todo lo demás que sea string y no vacío → PROBLEMA
        es_paga = bool(est) and 'PAG' in str(est).upper()
        
        # Intentar interpretar si es una fecha en formato USA MM-DD-YY o similar
        tipo = 'TEXTO_INDEFINIDO'
        if re.match(r'^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$', fp_str):
            tipo = 'FECHA_FORMATO_USA (MM-DD-AA o similar)'
        elif re.match(r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}$', fp_str):
            tipo = 'FECHA_FORMATO_ISO_TEXTO (debería ser celda fecha)'
        elif re.match(r'^\d{1,2}\s*/\d{1,2}/\d{2,4}$', fp_str):
            tipo = 'FECHA_CON_ESPACIO'
        
        vc_num = float(vc) if isinstance(vc, (int,float)) else 0
        problemas.append({
            'lote': lote, 'cuota': n, 'celda': celda,
            'valor_actual': fp_str, 'tipo': tipo,
            'es_paga': es_paga, 'valor_cuota': vc_num
        })

print(f'╔══════════════════════════════════════════════════════════════════╗')
print(f'  FECHAS CON FORMATO INCORRECTO — PENDIENTES DE CORRECCIÓN')
print(f'  (Meses en texto excluidos: son válidos como "pago múltiple")')
print(f'  Total encontradas: {len(problemas)}')
print(f'╚══════════════════════════════════════════════════════════════════╝\n')

if not problemas:
    print('✅ ¡NO QUEDAN FECHAS CON FORMATO INCORRECTO! Todo está correcto.')
else:
    # Agrupar por tipo de problema
    from collections import defaultdict
    por_tipo = defaultdict(list)
    for p in problemas:
        por_tipo[p['tipo']].append(p)

    for tipo, items in sorted(por_tipo.items()):
        print(f'\n  ── {tipo} ({len(items)} casos) ──')
        for p in items:
            flag = '🔴 PAGA' if p['es_paga'] else '🟡 NO PAGA'
            print(f'  {flag} | Lote: {p["lote"]:<30} | C{p["cuota"]:>2} | Celda: {p["celda"]:<8} | Valor: "{p["valor_actual"]}"')

print('\n  ─────────────────────────────────────────────────────')
print('  REGLA GUARDADA: Fecha de pago = mes en texto → "Pago múltiple"')
print('  El sistema aceptará estos valores y los marcará con flag especial.')
