"""
Script final de carga que no ignora ningún pago en PROYECCIÓN
"""
import openpyxl, sys, re, json, urllib.request, ssl
from datetime import datetime, date
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
wb = openpyxl.load_workbook(FILE, data_only=True)
ws_p = wb['PROYECCIÓN']
col_hs = openpyxl.utils.column_index_from_string('HS')

BASE = 'https://qatfoxmarddsocnwycgy.supabase.co/rest/v1/'
KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s'
ctx  = ssl.create_default_context()

def to_num(val):
    if val is None: return 0.0
    try:
        if isinstance(val, (int, float)): return float(val)
        s = str(val).replace('$','').replace(',','').strip()
        if s.startswith('#') or s in ('','None','nan'): return 0.0
        return float(s)
    except: return 0.0

def to_date(val):
    if not val: return None
    if isinstance(val, (datetime, date)): return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    m = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        mo = max(1, min(12, mo))
        d = min(max(1, d), 28)
        return f'{y:04d}-{mo:02d}-{d:02d}'
    return None

def clean_str(val):
    if val is None: return None
    s = str(val).strip()
    return s if s and s.lower() not in ('none','nan','') else None

def norm(val):
    if not val: return ''
    return re.sub(r'\s+', ' ', str(val)).strip().upper().replace(' - ','-').replace(' -','-').replace('- ','-')

def map_estado(est, is_paga, f_venc):
    if is_paga: return 'PAGA'
    if est:
        e = est.upper().strip()
        if 'PAG' in e: return 'PAGA'
        if 'VENC' in e: return 'VENCIDA'
        if 'POR VENCER' in e: return 'POR VENCER'
        if 'AL D' in e: return 'AL DÍA'
    if f_venc and f_venc < '2026-09-03': return 'VENCIDA'
    return 'AL DÍA'

# Obtener mapeo lotes y ventas
req_v = urllib.request.Request(BASE + 'ventas?select=id,lotes(id_lote)&limit=1000', headers={'apikey': KEY, 'Authorization': 'Bearer '+KEY})
with urllib.request.urlopen(req_v, context=ctx) as r:
    ventas_db = json.loads(r.read())
lote_to_vid = {norm(v['lotes']['id_lote']): v['id'] for v in ventas_db if v.get('lotes')}

# Extraer TODAS las cuotas válidas (incluyendo cuotas de lotes que tenían pagos pero SF=0)
cuotas_nuevas = []
for r in ws_p.iter_rows(min_row=4, values_only=True):
    if not any(r): continue
    raw_id = r[2]
    if not raw_id: continue
    k = norm(raw_id)
    vid = lote_to_vid.get(k)
    if not vid: continue

    for n in range(1, 37):
        c_start = 10 + (n - 1) * 6
        if c_start >= len(r): break
        fv = to_date(r[c_start])
        fp = to_date(r[c_start + 2])
        vc = to_num(r[c_start + 3])
        est = clean_str(r[c_start + 4])
        mp = clean_str(r[c_start + 5])

        if not fv and not fp and vc <= 0 and not est:
            continue

        is_paga = bool(fp and vc > 0) or (est and 'PAG' in est.upper())
        val_pagado = vc if is_paga else 0.0
        est_final = map_estado(est, is_paga, fv)

        cuotas_nuevas.append({
            'venta_id': vid,
            'numero_cuota': n,
            'fecha_vencimiento': fv,
            'valor_cuota': vc,
            'fecha_pago': fp,
            'valor_pagado': val_pagado,
            'estado_cuota': est_final,
            'medio_pago': mp,
            'comprobante_url': None,
            'observacion': None,
        })

print(f"Total cuotas extraídas con captura completa: {len(cuotas_nuevas)}")
pagadas = [c for c in cuotas_nuevas if c['estado_cuota'] == 'PAGA']
suma_pag = sum(c['valor_pagado'] for c in cuotas_nuevas)
print(f"Cuotas pagadas: {len(pagadas)}")
print(f"Suma valor_pagado: ${suma_pag:,.2f}")
print(f"Esperado Excel (Col HS): $3,053,040,994.00")
print(f"Diferencia restante: ${abs(suma_pag - 3053040994):,.2f}")
