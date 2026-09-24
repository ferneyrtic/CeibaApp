"""
Encontrar exactamente qué lotes no tienen cuotas en Supabase o tienen diferencia
"""
import openpyxl, sys, urllib.request, json, ssl
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

def norm(val):
    if not val: return ''
    import re
    return re.sub(r'\s+', ' ', str(val)).strip().upper().replace(' - ','-').replace(' -','-').replace('- ','-')

# 1. Obtener suma de cuotas por venta_id en Supabase
# Obtener todas las ventas: id, lote_id
req_v = urllib.request.Request(BASE + 'ventas?select=id,lote_id,lotes(id_lote)&limit=1000', headers={'apikey': KEY, 'Authorization': 'Bearer '+KEY})
with urllib.request.urlopen(req_v, context=ctx) as r:
    ventas_db = json.loads(r.read())

venta_by_id = {v['id']: norm(v['lotes']['id_lote'] if v.get('lotes') else '') for v in ventas_db}
lote_to_vid = {norm(v['lotes']['id_lote']): v['id'] for v in ventas_db if v.get('lotes')}

# Sumar cuotas en Supabase por venta_id
pagado_por_vid = {}
offset = 0
while True:
    req = urllib.request.Request(BASE + f'cuotas?select=venta_id,valor_pagado&limit=1000&offset={offset}', headers={'apikey': KEY, 'Authorization': 'Bearer '+KEY})
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        batch = json.loads(r.read())
        if not batch: break
        for c in batch:
            vid = c['venta_id']
            val = float(c.get('valor_pagado') or 0)
            pagado_por_vid[vid] = pagado_por_vid.get(vid, 0.0) + val
        offset += len(batch)
        if len(batch) < 1000: break

# Comparar con PROYECCIÓN
total_dif = 0.0
casos_dif = []

for row_idx, r in enumerate(ws_p.iter_rows(min_row=4, values_only=True), start=4):
    if not any(r): continue
    raw_id = r[2]
    if not raw_id: continue
    k = norm(raw_id)
    hs_val = to_num(r[col_hs - 1]) if col_hs <= len(r) else 0.0

    vid = lote_to_vid.get(k)
    supa_val = pagado_por_vid.get(vid, 0.0)

    dif = hs_val - supa_val
    if abs(dif) > 1:
        casos_dif.append({
            'fila': row_idx,
            'lote': raw_id,
            'k': k,
            'vid': vid,
            'hs_excel': hs_val,
            'supa_val': supa_val,
            'dif': dif
        })
        total_dif += dif

print(f"Total contratos con diferencia Supabase vs Excel: {len(casos_dif)}")
print(f"Diferencia total acumulada: ${total_dif:,.2f}")
print("\nListado completo de discrepancias:")
for c in casos_dif:
    print(f"• Fila {c['fila']:<3} | Lote: {str(c['lote']):<16} | Excel HS: ${c['hs_excel']:>11,.0f} | Supabase: ${c['supa_val']:>11,.0f} | Faltante: ${c['dif']:>11,.0f} | VID: {bool(c['vid'])}")
