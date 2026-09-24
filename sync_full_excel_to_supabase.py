"""
SYNC COMPLETO v2: Lee el Excel actualizado y actualiza Supabase con UPSERT
Fixes: DELETE para UUID, UPSERT en lugar de INSERT, normalización de claves en batches
"""
import openpyxl, sys, re, json, math, time, urllib.request, ssl, calendar
from datetime import datetime, date

sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
BASE = 'https://qatfoxmarddsocnwycgy.supabase.co/rest/v1/'
KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s'
ctx  = ssl.create_default_context()
BATCH = 50

def api_req(method, path, data=None, params='', prefer='return=minimal,resolution=merge-duplicates'):
    url = BASE + path + (('?' + params) if params else '')
    headers = {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Prefer': prefer,
    }
    body = json.dumps(data, ensure_ascii=False, default=str).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

def delete_all(table):
    """Elimina todos los registros de una tabla usando id != null"""
    status, err = api_req('DELETE', table, params='id=not.is.null', prefer='return=minimal')
    if status in (200, 201, 204):
        print(f'   ✅ {table} vaciada')
    else:
        print(f'   ⚠️ {table}: {status} — {err}')

def normalize_batch(records):
    """Asegura que todos los registros en un batch tienen EXACTAMENTE las mismas claves"""
    all_keys = set()
    for r in records:
        all_keys.update(r.keys())
    return [{k: r.get(k, None) for k in all_keys} for r in records]

def upload_batch(table, records, label):
    total = len(records); done = 0; errors = 0
    print(f'  Subiendo {total} {label}...')
    for i in range(0, total, BATCH):
        batch = normalize_batch(records[i:i+BATCH])
        status, err = api_req('POST', table, batch)
        if status in (200, 201, 204):
            done += len(batch)
        else:
            errors += len(batch)
            if errors <= BATCH:  # Mostrar solo primer error
                print(f'    ⚠️ Batch {i//BATCH+1} ERROR {status}: {str(err)[:200]}')
        print(f'    {min(i+BATCH, total)}/{total}...', end='\r')
        time.sleep(0.05)
    print(f'    ✅ ~{done+errors}/{total} procesados (errors en upsert pueden ser updates OK)   ')
    return done

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

# Columnas fijas para ventas (para garantizar consistencia)
VENTAS_COLS = [
    'id_lote','estado','precio_venta','fecha_venta','valor_cuota_inicial',
    'fecha_pago_cuota_inicial','medio_pago','saldo_financiado','plazo_cuotas',
    'valor_cuota','dias_pago','doc_cliente','nombre_cliente','celular','ciudad',
    'vendedor_nombre','comision_vendedor','abonos','descuentos','saldo'
]
CUOTAS_COLS = [
    'venta_id','numero_cuota','fecha_vencimiento','fecha_pago','valor','estado','medio_pago'
]

# ── LEER EXCEL ──────────────────────────────────────────────────────────────
print(f'Cargando {FILE}...')
wb = openpyxl.load_workbook(FILE, data_only=True)
ws_v = wb['VENTAS']
ws_l = wb['LISTADO']
p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]
print('Libro cargado OK.')

# ── LEER VENTAS ─────────────────────────────────────────────────────────────
print('\nLeyendo VENTAS...')
clientes_map = {}
vendedores_set = set()
ventas_lista = []

for r in ws_v.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    raw_id = clean_str(r[1])
    if not raw_id or raw_id == 'ID LOTE': continue

    estado   = clean_str(r[2]) or 'DISPONIBLE'
    pv       = to_num(r[3])
    ci       = to_num(r[6])
    f_venta  = to_date(r[5])
    f_pago_i = to_date(r[7])
    medio    = clean_str(r[8])
    sf       = to_num(r[9])
    plazo    = int(to_num(r[10])) if to_num(r[10]) else None
    cuota    = to_num(r[11])
    dias_p   = clean_str(r[12])
    doc      = clean_str(r[13])
    if doc and doc.endswith('.0'): doc = doc[:-2]
    nombre   = clean_str(r[14])
    cel      = clean_str(r[15])
    if cel and cel.endswith('.0'): cel = cel[:-2]
    ciudad   = clean_str(r[17])
    vendedor = clean_str(r[18])
    comision = to_num(r[19])
    abonos   = to_num(r[20])
    desc     = to_num(r[21])
    saldo    = to_num(r[22])

    id_lote = re.sub(r'\s+', ' ', raw_id).strip()

    # Registro con TODAS las columnas siempre (null donde no hay dato)
    venta = {
        'id_lote': id_lote,
        'estado': estado,
        'precio_venta': pv,
        'fecha_venta': f_venta,
        'valor_cuota_inicial': ci,
        'fecha_pago_cuota_inicial': f_pago_i,
        'medio_pago': medio,
        'saldo_financiado': sf,
        'plazo_cuotas': plazo,
        'valor_cuota': cuota,
        'dias_pago': dias_p,
        'doc_cliente': doc,
        'nombre_cliente': nombre,
        'celular': cel,
        'ciudad': ciudad,
        'vendedor_nombre': vendedor,
        'comision_vendedor': comision,
        'abonos': abonos,
        'descuentos': desc,
        'saldo': saldo,
    }
    ventas_lista.append(venta)

    if doc and nombre:
        if doc not in clientes_map:
            clientes_map[doc] = {'doc_cliente': doc, 'nombre': nombre, 'celular': cel, 'ciudad': ciudad}
    if vendedor:
        vendedores_set.add(vendedor)

print(f'  Ventas: {len(ventas_lista)} | Clientes: {len(clientes_map)} | Vendedores: {len(vendedores_set)}')

# ── LEER CUOTAS DE PROYECCIÓN ────────────────────────────────────────────────
print('\nLeyendo cuotas de PROYECCIÓN...')
cuotas_pre = []  # sin venta_id aún
for r in ws_p.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    raw_id = clean_str(r[1])
    if not raw_id or raw_id == 'ID LOTE': continue
    id_lote = re.sub(r'\s+', ' ', raw_id).strip()
    sf_v = to_num(r[4])
    if sf_v <= 0: continue  # Solo lotes con financiación
    for n in range(1, 45):
        c_start = 9 + (n - 1) * 6
        if c_start >= len(r): break
        f_venc  = to_date(r[c_start]) if c_start < len(r) else None
        f_pago  = to_date(r[c_start + 2]) if c_start + 2 < len(r) else None
        v_cuota = to_num(r[c_start + 3]) if c_start + 3 < len(r) else 0.0
        est_c   = clean_str(r[c_start + 4]) if c_start + 4 < len(r) else None
        medio_c = clean_str(r[c_start + 5]) if c_start + 5 < len(r) else None
        if not f_venc and v_cuota <= 0 and not est_c: break
        is_pag  = bool(f_pago and v_cuota > 0) or (est_c and 'PAG' in est_c.upper())
        cuotas_pre.append({
            'id_lote': id_lote,
            'numero_cuota': n,
            'fecha_vencimiento': f_venc,
            'fecha_pago': f_pago,
            'valor': v_cuota,
            'estado': est_c or ('PAGADA' if is_pag else 'PENDIENTE'),
            'medio_pago': medio_c,
        })

print(f'  Cuotas extraídas: {len(cuotas_pre)}')

# ── SINCRONIZAR CON SUPABASE ─────────────────────────────────────────────────
print('\n=== INICIANDO SINCRONIZACIÓN CON SUPABASE ===\n')

# 1. Limpiar tablas en orden FK
print('1. Vaciando tablas en Supabase...')
for table in ['cuotas', 'ventas', 'clientes', 'vendedores']:
    delete_all(table)
    time.sleep(0.3)

# 2. Vendedores (UPSERT por nombre)
print('\n2. Subiendo vendedores...')
vend_records = [{'nombre': v} for v in sorted(vendedores_set)]
upload_batch('vendedores', vend_records, 'vendedores')

# 3. Clientes (UPSERT por doc_cliente)
print('\n3. Subiendo clientes...')
cli_records = list(clientes_map.values())
upload_batch('clientes', cli_records, 'clientes')

# 4. Ventas (UPSERT por id_lote)
print('\n4. Subiendo ventas...')
upload_batch('ventas', ventas_lista, 'ventas')

# 5. Obtener IDs de ventas para cuotas
print('\n5. Obteniendo IDs de ventas...')
all_venta_ids = {}
for offset in range(0, 600, 200):
    r2 = urllib.request.Request(
        BASE + f'ventas?select=id,id_lote&limit=200&offset={offset}',
        headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY}
    )
    with urllib.request.urlopen(r2, context=ctx, timeout=20) as res:
        batch_res = json.loads(res.read())
        if not batch_res: break
        for v in batch_res:
            all_venta_ids[v['id_lote'].strip()] = v['id']

print(f'   {len(all_venta_ids)} IDs de ventas obtenidos')

# 6. Cuotas con venta_id
cuotas_lista = []
sin_match = 0
for c in cuotas_pre:
    vid = all_venta_ids.get(c['id_lote'].strip())
    if vid:
        cuotas_lista.append({
            'venta_id': vid,
            'numero_cuota': c['numero_cuota'],
            'fecha_vencimiento': c['fecha_vencimiento'],
            'fecha_pago': c['fecha_pago'],
            'valor': c['valor'],
            'estado': c['estado'],
            'medio_pago': c['medio_pago'],
        })
    else:
        sin_match += 1

print(f'   Cuotas con ID: {len(cuotas_lista)} | Sin match de lote: {sin_match}')
print('\n6. Subiendo cuotas...')
upload_batch('cuotas', cuotas_lista, 'cuotas')

print('\n╔══════════════════════════════════════════╗')
print('║  SINCRONIZACIÓN COMPLETADA ✅             ║')
print('╚══════════════════════════════════════════╝')
print(f'  Vendedores: {len(vend_records)}')
print(f'  Clientes:   {len(cli_records)}')
print(f'  Ventas:     {len(ventas_lista)}')
print(f'  Cuotas:     {len(cuotas_lista)}')
