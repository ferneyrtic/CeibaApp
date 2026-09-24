"""
Carga masiva de CUOTAS desde la hoja PROYECCIÓN a Supabase
Cumple estrictamente con el CHECK CONSTRAINT:
estado_cuota in ('PAGA','VENCIDA','POR VENCER','AL DÍA')
"""
import openpyxl, sys, re, json, math, time, urllib.request, ssl, calendar
from datetime import datetime, date

sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
BASE = 'https://qatfoxmarddsocnwycgy.supabase.co/rest/v1/'
KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s'
ctx  = ssl.create_default_context()
BATCH = 100

def to_num(val):
    if val is None: return 0.0
    try:
        if isinstance(val, (int, float)):
            return 0.0 if math.isnan(float(val)) else float(val)
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
        d = min(max(1, d), calendar.monthrange(y, mo)[1])
        return f'{y:04d}-{mo:02d}-{d:02d}'
    return None

def clean_str(val):
    if val is None: return None
    s = str(val).strip()
    return s if s and s.lower() not in ('none','nan','') else None

def norm(val):
    if not val: return ''
    s = str(val).strip().upper()
    return re.sub(r'\s+', ' ', s).replace(' - ','-').replace(' -','-').replace('- ','-')

def map_estado_cuota(est, is_pagada, f_venc):
    """Mapea estrictamente a: 'PAGA', 'VENCIDA', 'POR VENCER', 'AL DÍA'"""
    if is_pagada:
        return 'PAGA'
    if est:
        e = est.upper().strip()
        if 'PAG' in e:
            return 'PAGA'
        if 'VENC' in e:
            return 'VENCIDA'
        if 'POR VENCER' in e:
            return 'POR VENCER'
        if 'AL D' in e:
            return 'AL DÍA'
    # Si no tiene estado o dice 'SIN ESTADO'
    if f_venc:
        try:
            today_str = date.today().strftime('%Y-%m-%d')
            if f_venc < today_str:
                return 'VENCIDA'
            else:
                return 'AL DÍA'
        except:
            pass
    return 'AL DÍA'

print("1. Obteniendo lotes y ventas de Supabase...")
req_l = urllib.request.Request(BASE + 'lotes?select=id,id_lote&limit=1000', headers={'apikey': KEY, 'Authorization': 'Bearer '+KEY})
with urllib.request.urlopen(req_l, context=ctx) as r:
    lotes_db = json.loads(r.read())
lotes_map = {norm(l['id_lote']): l['id'] for l in lotes_db}

req_v = urllib.request.Request(BASE + 'ventas?select=id,lote_id,plazo_cuotas&limit=1000', headers={'apikey': KEY, 'Authorization': 'Bearer '+KEY})
with urllib.request.urlopen(req_v, context=ctx) as r:
    ventas_db = json.loads(r.read())
lote_to_venta = {v['lote_id']: v for v in ventas_db}

print(f"   Lotes indexados: {len(lotes_map)} | Ventas indexadas: {len(lote_to_venta)}")

print("2. Vaciando tabla cuotas...")
req_del = urllib.request.Request(BASE + 'cuotas?id=not.is.null', headers={'apikey': KEY, 'Authorization': 'Bearer '+KEY}, method='DELETE')
try:
    with urllib.request.urlopen(req_del, context=ctx) as r:
        print("   ✅ Cuotas vaciadas.")
except Exception as e:
    print("   Error vaciando cuotas:", e)

print("3. Leyendo PROYECCIÓN del Excel...")
wb = openpyxl.load_workbook(FILE, data_only=True)
p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]

cuotas_insert = []
lotes_procesados = 0

for r in ws_p.iter_rows(min_row=4, values_only=True):
    if not any(r): continue
    raw_id = clean_str(r[2]) # Columna índice 2 es ID LOTE
    if not raw_id or raw_id == 'ID LOTE': continue

    k = norm(raw_id)
    lote_uuid = lotes_map.get(k)
    venta_info = lote_to_venta.get(lote_uuid)

    if not venta_info:
        continue

    venta_uuid = venta_info['id']
    plazo_max = venta_info.get('plazo_cuotas') or 36

    sf_val = to_num(r[5]) # Saldo financiado
    if sf_val <= 0: continue

    lotes_procesados += 1

    # Extraer cuotas reales según el plazo
    for n in range(1, min(plazo_max + 1, 45)):
        c_start = 10 + (n - 1) * 6
        if c_start >= len(r): break

        f_venc   = to_date(r[c_start]) if c_start < len(r) else None
        f_pago   = to_date(r[c_start + 2]) if c_start + 2 < len(r) else None
        v_cuota  = to_num(r[c_start + 3]) if c_start + 3 < len(r) else 0.0
        est_c    = clean_str(r[c_start + 4]) if c_start + 4 < len(r) else None
        medio_c  = clean_str(r[c_start + 5]) if c_start + 5 < len(r) else None

        # Si no hay fecha ni valor, terminar
        if not f_venc and v_cuota <= 0 and not f_pago:
            break

        is_pag = bool(f_pago and v_cuota > 0) or (est_c and 'PAG' in est_c.upper())
        val_pagado = v_cuota if is_pag else 0.0
        estado_final = map_estado_cuota(est_c, is_pag, f_venc)

        cuotas_insert.append({
            'venta_id': venta_uuid,
            'numero_cuota': n,
            'fecha_vencimiento': f_venc,
            'valor_cuota': v_cuota,
            'fecha_pago': f_pago,
            'valor_pagado': val_pagado,
            'estado_cuota': estado_final,
            'medio_pago': medio_c,
            'comprobante_url': None,
            'observacion': None,
        })

print(f"   Lotes financiados procesados: {lotes_procesados}")
print(f"   Total cuotas válidas preparadas: {len(cuotas_insert)}")

# Subir en batches de 100
total = len(cuotas_insert)
subidas = 0
for i in range(0, total, BATCH):
    batch = cuotas_insert[i:i+BATCH]
    data = json.dumps(batch, ensure_ascii=False, default=str).encode('utf-8')
    req = urllib.request.Request(
        BASE + 'cuotas',
        data=data,
        headers={
            'apikey': KEY,
            'Authorization': 'Bearer ' + KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            if resp.status in (200, 201):
                subidas += len(batch)
                pct = round(subidas / total * 100)
                print(f"   Subiendo cuotas: {subidas}/{total} ({pct}%)...", end='\r')
                time.sleep(0.04)
    except urllib.error.HTTPError as e:
        print(f"\nHTTP ERROR en batch {i}: {e.code} - {e.read().decode()}")
        print("Muestra del registro fallido:", batch[0])
        break

print(f"\n\n🎉 ¡{subidas}/{total} CUOTAS SUBIDAS A SUPABASE EXITOSAMENTE!")
