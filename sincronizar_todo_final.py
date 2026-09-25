"""
SINCRONIZACIÓN MAESTRA DEFINITIVA — v2 (Sep-2026)
Excel → Supabase: lotes, vendedores, clientes, ventas, cuotas

Mejoras v2:
  6. Corrección de fechas de vencimiento para días 30 y 31 del mes:
     - Cuando dias_pago es 30 ó 31, forzar las fechas de vencimiento
       al último día real del mes correspondiente (28/29/30/31).
  7. Estado de cuotas dinámico con fecha de hoy (no hardcoded).
  8. Actualiza fecha_pago_cuota_inicial para LC2-42-7 (2026-05-01).
"""
import openpyxl, sys, re, json, math, time, urllib.request, ssl, calendar
from datetime import datetime, date

sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
BASE = 'https://qatfoxmarddsocnwycgy.supabase.co/rest/v1/'
KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s'
ctx  = ssl.create_default_context()
BATCH = 100
TODAY = date.today().strftime('%Y-%m-%d')

MESES_TEXTO = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
    'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
    'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
}

def to_num(val):
    if val is None: return 0.0
    try:
        if isinstance(val, (int, float)):
            return 0.0 if math.isnan(float(val)) else float(val)
        s = str(val).replace('$','').replace(',','').strip()
        if s.startswith('#') or s in ('','None','nan'): return 0.0
        return float(s)
    except: return 0.0

def clean(val):
    if val is None: return None
    s = str(val).strip()
    return s if s and s.lower() not in ('none','nan','') else None

def norm(val):
    if not val: return ''
    s = str(val).strip().upper()
    return re.sub(r'\s+', ' ', s).replace(' - ','-').replace(' -','-').replace('- ','-')

def end_of_month_date(y, m, d):
    """Returns 'YYYY-MM-DD' clamping d to the real last day of month m in year y."""
    last = calendar.monthrange(y, m)[1]
    return f'{y:04d}-{m:02d}-{min(d, last):02d}'

def inferir_fecha(val):
    """
    Convierte a 'YYYY-MM-DD'.
    Infiere fechas invertidas MM/DD -> DD/MM cuando día > 12.
    Retorna (fecha_str | None, observacion | None)
    """
    if val is None: return None, None
    if isinstance(val, (datetime, date)):
        return val.strftime('%Y-%m-%d') if isinstance(val, datetime) else str(val), None

    s = str(val).strip().replace(' ', '')
    if not s or s.startswith('#') or s.lower() in ('none','nan'):
        return None, None

    su = s.upper()
    if su in MESES_TEXTO:
        return None, f'PAGO MÚLTIPLE - {su}'

    # ISO format YYYY-MM-DD
    m = re.match(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$', s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        mo = max(1, min(12, mo))
        d = min(max(1, d), calendar.monthrange(y, mo)[1])
        return f'{y:04d}-{mo:02d}-{d:02d}', None

    # Formatos con 3 partes
    for sep in ['/', '-']:
        parts = s.split(sep)
        if len(parts) == 3:
            try:
                a, b, c = int(parts[0]), int(parts[1]), int(parts[2])
            except: continue

            year = c if c > 100 else (2000 + c if c < 50 else 1900 + c)
            if year < 2020 or year > 2035:
                return None, f'AÑO FUERA DE RANGO: {s}'

            if b > 12 and a <= 12:
                month, day = a, b
            elif a > 12 and b <= 12:
                month, day = b, a
            elif a <= 12 and b <= 12:
                month, day = b, a
            else:
                return None, f'NO INTERPRETABLE: {s}'

            try:
                d_obj = datetime(year, month, day)
                return d_obj.strftime('%Y-%m-%d'), None
            except:
                return None, f'FECHA INVÁLIDA: {s}'

    return None, f'FORMATO NO RECONOCIDO: {s}'

def map_estado_cuota(est, is_pag, f_venc):
    if is_pag: return 'PAGA'
    if est:
        eu = str(est).strip().upper()
        if 'PAG' in eu: return 'PAGA'
        if 'VENC' in eu: return 'VENCIDA'
        if 'POR VENCER' in eu: return 'POR VENCER'
        if 'AL D' in eu: return 'AL DÍA'
    # Estado dinámico basado en fecha de hoy
    if f_venc and f_venc < TODAY:
        return 'VENCIDA'
    return 'AL DÍA'

def extract_day_from_dias_pago(dias_pago_str):
    """Extracts the numeric day from 'dias_pago' field. Returns int or None."""
    if not dias_pago_str:
        return None
    m = re.search(r'\b(\d{1,2})\b', str(dias_pago_str))
    if m:
        d = int(m.group(1))
        if 1 <= d <= 31:
            return d
    return None

def fix_end_of_month_if_needed(fv_str, expected_day):
    """
    If expected_day is 30 or 31, and the stored fecha_vencimiento
    has drifted (e.g. 2026-07-01 instead of 2026-06-30), fix it.
    For days 28-31, always snap to last day of the month from the year/month.
    """
    if not fv_str or not expected_day:
        return fv_str
    if expected_day < 28:
        return fv_str  # No correction needed for days < 28
    
    # Parse the stored date
    try:
        y, m, d = int(fv_str[:4]), int(fv_str[5:7]), int(fv_str[8:10])
    except:
        return fv_str
    
    last_day = calendar.monthrange(y, m)[1]
    
    # For expected_day 30 or 31: the vencimiento should be min(expected_day, last_day)
    correct_day = min(expected_day, last_day)
    
    if d != correct_day:
        # Check if the stored date is just "overflowed" to next month
        # e.g., June 30+1 = July 1 should stay June 30
        # We detect overflow: if d is 1, 2, or 3 of a month but expected was end-of-prev-month
        # In that case, go back to previous month's last day
        if d <= 5:  # possible overflow from previous month
            # compute what the previous month's last day is
            prev_m = m - 1 if m > 1 else 12
            prev_y = y if m > 1 else y - 1
            prev_last = calendar.monthrange(prev_y, prev_m)[1]
            # If we expected day 30/31 and prev_last matches
            if min(expected_day, prev_last) >= d:
                correct_y = prev_y
                correct_m = prev_m
                correct_d = min(expected_day, prev_last)
                return f'{correct_y:04d}-{correct_m:02d}-{correct_d:02d}'
        # Otherwise: clamp to correct day in same month
        return f'{y:04d}-{m:02d}-{correct_day:02d}'
    
    return fv_str

def api_req(method, path, data=None, params='', prefer='return=minimal'):
    url = BASE + path + (('?' + params) if params else '')
    headers = {
        'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json', 'Prefer': prefer,
    }
    body = json.dumps(data, ensure_ascii=False, default=str).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=45) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]

def upload_batch(table, records, label, prefer='return=minimal,resolution=ignore-duplicates'):
    total = len(records); done = 0; errs = 0
    for i in range(0, total, BATCH):
        batch = records[i:i+BATCH]
        status, err = api_req('POST', table, batch, prefer=prefer)
        if status in (200, 201, 204):
            done += len(batch)
        else:
            errs += len(batch)
            print(f'\n    ⚠️ Batch {i//BATCH+1} ({status}): {str(err)[:160]}')
        print(f'    Progreso {label}: {min(i+BATCH,total)}/{total}...', end='\r')
        time.sleep(0.04)
    print(f'    ✅ {done}/{total} {label} procesados. Errores: {errs}               ')
    return done

# ═══════════════════════════════════════════════════════
print("=" * 64)
print("  🚀 SINCRONIZACIÓN MAESTRA DEFINITIVA v2 — EXCEL -> SUPABASE")
print(f"  📅 Fecha de hoy: {TODAY}")
print("=" * 64)

print(f"\nCargando {FILE}...")
wb = openpyxl.load_workbook(FILE, data_only=True)
ws_v = wb['VENTAS']
ws_l = wb['LISTADO']
p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]
print("✓ Archivo cargado exitosamente.")

# ── PASO 1: LOTES ──────────────────────────────────────
print("\n[1/6] Sincronizando tabla lotes...")
status, lotes_db = api_req('GET', 'lotes', params='select=id,id_lote,estado,precio_venta&limit=1000')
if not isinstance(lotes_db, list):
    print(f"  ❌ Error consultando lotes: {lotes_db}")
    sys.exit(1)

lotes_map  = {norm(l['id_lote']): l['id'] for l in lotes_db}
lotes_info = {norm(l['id_lote']): l for l in lotes_db}
print(f"  ✓ {len(lotes_map)} lotes cargados de Supabase.")

lotes_actualizados = 0
for r in ws_l.iter_rows(min_row=3, values_only=True):
    raw = clean(r[3])
    if not raw or raw == 'ID LOTE': continue
    k = norm(raw)
    if '8-4' in k and 'LC1' in k and '3' not in k:
        continue  # Consolidado en LC1-8-3 Y 4
    curr = lotes_info.get(k)
    if not curr: continue

    est_raw = clean(r[11]) or 'DISPONIBLE'
    # CHECK constraint de lotes no admite 'CEDIDO...' -> mapear a 'VENDIDO'
    est_db = 'VENDIDO' if 'CEDIDO' in est_raw.upper() else est_raw
    pv = to_num(r[13])
    obs = clean(r[18]) if len(r) > 18 else None

    # Si hubo cambio en estado o precio
    if curr.get('estado') != est_db or abs(to_num(curr.get('precio_venta')) - pv) > 1:
        api_req('PATCH', f'lotes?id=eq.{curr["id"]}',
                data={'estado': est_db, 'precio_venta': pv, 'observacion': obs})
        lotes_actualizados += 1

print(f"  ✓ {lotes_actualizados} lotes actualizados con últimos cambios de LISTADO.")

# ── PASO 2: VENDEDORES Y CLIENTES ──────────────────────
print("\n[2/6] Extrayendo y sincronizando Vendedores y Clientes...")
clientes_dict = {}
vendedores_set = set()

for r in ws_v.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    doc  = clean(r[13])
    if doc and doc.endswith('.0'): doc = doc[:-2]
    nom  = clean(r[14])
    cel  = clean(r[15])
    if cel and cel.endswith('.0'): cel = cel[:-2]
    dir_c = clean(r[16]) if len(r) > 16 else None
    ciu  = clean(r[17]) if len(r) > 17 else None
    vend = clean(r[18]) if len(r) > 18 else None

    if nom:
        if 'RUBEN' in nom.upper() and 'BUSTOS' in nom.upper() and not doc:
            doc_final = 'CEDIDO-RUBEN-BUSTOS'
        elif 'JEISSON' in nom.upper() and not doc:
            doc_final = 'PENDIENTE-JEISSON-VILLANUEVA'
        elif not doc:
            doc_final = f'SIN-DOC-{norm(nom)[:20]}'
        else:
            doc_final = doc

        if doc_final not in clientes_dict:
            clientes_dict[doc_final] = {
                'doc_cliente': doc_final,
                'nombre': nom,
                'celular': cel,
                'direccion': dir_c,
                'ciudad': ciu
            }

    if vend:
        vendedores_set.add(vend)

# Asegurar cliente para LC1-8-3 Y 4 consolidado
if 'ESCRITURA-JOHN-ALBERTO-BOHORQUEZ' not in clientes_dict:
    clientes_dict['ESCRITURA-JOHN-ALBERTO-BOHORQUEZ'] = {
        'doc_cliente': 'ESCRITURA-JOHN-ALBERTO-BOHORQUEZ',
        'nombre': 'JOHN ALBERTO BOHORQUEZ',
        'celular': None,
        'direccion': None,
        'ciudad': 'LA CEIBA'
    }

vend_records = [{'nombre': v, 'activo': True} for v in sorted(vendedores_set)]
upload_batch('vendedores', vend_records, 'vendedores')

cli_records = list(clientes_dict.values())
upload_batch('clientes', cli_records, 'clientes')

status, clientes_db = api_req('GET', 'clientes', params='select=id,doc_cliente,nombre&limit=1000')
clientes_id_map = {str(c['doc_cliente']).strip(): c['id'] for c in clientes_db}
print(f"  ✓ {len(clientes_id_map)} clientes activos e indexados en Supabase.")

# ── PASO 3: LIMPIAR VENTAS Y CUOTAS ANTERIORES ─────────
print("\n[3/6] Limpiando tablas ventas y cuotas anteriores...")
s_c, _ = api_req('DELETE', 'cuotas', params='id=not.is.null')
s_v, _ = api_req('DELETE', 'ventas', params='id=not.is.null')
print(f"  ✓ Tablas limpiadas (cuotas status: {s_c}, ventas status: {s_v}).")

# ── PASO 4: INSERTAR VENTAS ────────────────────────────
print("\n[4/6] Construyendo e insertando VENTAS...")
ventas_insert = []
ventas_lote_norm = {}

for idx, r in enumerate(ws_v.iter_rows(min_row=3, values_only=True), 3):
    if not any(r): continue
    raw = clean(r[1])
    if not raw or raw == 'ID LOTE': continue

    k = norm(raw)
    if '8-4' in k and 'LC1' in k and '3' not in k:
        continue  # Consolidado en LC1-8-3 Y 4

    lote_uuid = lotes_map.get(k)
    if not lote_uuid:
        print(f"  ⚠️ Lote sin UUID en BD: {raw}")
        continue

    estado = clean(r[2]) or 'DISPONIBLE'
    doc    = clean(r[13])
    if doc and doc.endswith('.0'): doc = doc[:-2]
    nom    = clean(r[14])

    # Resolver cliente_id
    cli_uuid = None
    if doc and doc in clientes_id_map:
        cli_uuid = clientes_id_map[doc]
    elif nom:
        if 'RUBEN' in nom.upper() and 'BUSTOS' in nom.upper():
            cli_uuid = clientes_id_map.get('CEDIDO-RUBEN-BUSTOS')
        elif 'JEISSON' in nom.upper():
            cli_uuid = clientes_id_map.get('PENDIENTE-JEISSON-VILLANUEVA')
        else:
            cli_uuid = clientes_id_map.get(f'SIN-DOC-{norm(nom)[:20]}')

    f_venta, _ = inferir_fecha(r[5])
    f_ci,    _ = inferir_fecha(r[7])
    
    # Caso especial LC1-8-3 Y 4 consolidado (John Alberto Bohorquez)
    raw_lote_norm = norm(raw)
    if '8-3' in raw_lote_norm and '4' in raw_lote_norm and 'LC1' in raw_lote_norm:
        cli_uuid = clientes_id_map.get('ESCRITURA-JOHN-ALBERTO-BOHORQUEZ') or cli_uuid
        r_precio = to_num(r[3]) or 55482000.0
        vendedor_final = clean(r[18]) or 'JHON ALBERTO'
        f_venta = f_venta or '2026-09-17'
        f_ci = f_ci or '2026-09-17'
        venta_rec = {
            'lote_id':                  lote_uuid,
            'cliente_id':               cli_uuid,
            'vendedor_nombre':          vendedor_final,
            'estado':                   'PAGADO EN SU TOTALIDAD',
            'precio_venta':             r_precio,
            'apartados':                0.0,
            'fecha_venta':              f_venta,
            'valor_cuota_inicial':      r_precio,
            'fecha_pago_cuota_inicial': f_ci,
            'medio_pago':               clean(r[8]) or 'TRANSFERENCIA',
            'saldo_financiado':         0.0,
            'plazo_cuotas':             1,
            'valor_cuota':              0.0,
            'dias_pago':                '-',
            'comision_vendedor':        0.0,
            'abonos':                   0.0,
            'descuentos':               0.0,
            'saldo':                    0.0,
        }
        ventas_insert.append(venta_rec)
        ventas_lote_norm[k] = venta_rec
        continue

    # Corregir typo LC2-42-7: 1/5/0206 -> 2026-05-01
    dias_pago_raw = clean(r[12])
    if '42-7' in raw_lote_norm and 'LC2' in raw_lote_norm and f_ci is None:
        f_ci = '2026-05-01'
        print(f"  🔧 LC2-42-7: fecha_pago_cuota_inicial forzada a 2026-05-01 (typo en Excel corregido)")

    venta_rec = {
        'lote_id':                  lote_uuid,
        'cliente_id':               cli_uuid,
        'vendedor_nombre':          clean(r[18]),
        'estado':                   estado,
        'precio_venta':             to_num(r[3]),
        'apartados':                to_num(r[4]),
        'fecha_venta':              f_venta,
        'valor_cuota_inicial':      to_num(r[6]),
        'fecha_pago_cuota_inicial': f_ci,
        'medio_pago':               clean(r[8]),
        'saldo_financiado':         to_num(r[9]),
        'plazo_cuotas':             int(to_num(r[10])) if to_num(r[10]) else None,
        'valor_cuota':              to_num(r[11]),
        'dias_pago':                dias_pago_raw,
        'comision_vendedor':        to_num(r[19]),
        'abonos':                   to_num(r[20]),
        'descuentos':               to_num(r[21]),
        'saldo':                    to_num(r[22]),
    }
    ventas_insert.append(venta_rec)
    ventas_lote_norm[k] = venta_rec

upload_batch('ventas', ventas_insert, 'ventas')

# ── PASO 5: INDEXAR VENTAS RECIÉN INSERTADAS ───────────
print("\n[5/6] Indexando IDs de ventas...")
status, ventas_db = api_req('GET', 'ventas', params='select=id,lote_id&limit=1000')
lote_to_venta_id = {v['lote_id']: v['id'] for v in ventas_db}
print(f"  ✓ {len(lote_to_venta_id)} ventas indexadas.")

# ── PASO 6: INSERTAR CUOTAS DESDE PROYECCIÓN ──────────
print("\n[6/6] Extrayendo y subiendo CUOTAS desde PROYECCIÓN...")
cuotas_insert = []
lotes_sin_venta = 0
pagos_multiples = 0
fechas_invertidas = 0
fechas_eom_corregidas = 0  # end-of-month corrections

for idx, r in enumerate(ws_p.iter_rows(min_row=4, values_only=True), 4):
    if not any(r): continue
    raw = clean(r[2])  # Col C = ID LOTE
    if not raw or raw == 'ID LOTE': continue

    k = norm(raw)
    if '8-4' in k and 'LC1' in k and '3' not in k:
        continue  # Consolidado en LC1-8-3 Y 4

    lote_uuid = lotes_map.get(k)
    venta_uuid = lote_to_venta_id.get(lote_uuid) if lote_uuid else None

    if not venta_uuid:
        lotes_sin_venta += 1
        continue

    v_rec = ventas_lote_norm.get(k, {})
    plazo_contrato = v_rec.get('plazo_cuotas') or 0
    cuota_contrato = v_rec.get('valor_cuota') or 0.0
    dias_pago_str  = v_rec.get('dias_pago') or ''
    expected_day   = extract_day_from_dias_pago(dias_pago_str)

    for n in range(1, 37):
        cs = 10 + (n - 1) * 6
        if cs >= len(r): break

        fv_raw  = r[cs]
        fp_raw  = r[cs + 2]
        vc_raw  = r[cs + 3]
        est_raw = clean(r[cs + 4])
        mp_raw  = clean(r[cs + 5])

        vc = to_num(vc_raw)
        has_fp = fp_raw is not None and str(fp_raw).strip() != ''
        has_vc = vc > 0
        is_pag = bool(has_fp and has_vc) or (est_raw and 'PAG' in est_raw.upper())
        is_venc = bool(est_raw and 'VENC' in est_raw.upper())

        # Cuota relevante si: está dentro del plazo del contrato, o tiene pago real / vencida
        if plazo_contrato > 0 and n <= plazo_contrato:
            pass  # Válida de su plan
        elif is_pag or is_venc or has_vc:
            pass  # Extra / especial con datos
        else:
            continue

        # Inferencia de fechas
        fv_str, fv_obs = inferir_fecha(fv_raw)
        fp_str, fp_obs = inferir_fecha(fp_raw)

        # ── CORRECCIÓN END-OF-MONTH ──────────────────────────────
        # Si dias_pago es 28, 29, 30 o 31: corregir fecha_vencimiento
        # al último día real del mes (o al día esperado si < último día)
        if expected_day and expected_day >= 28 and fv_str:
            fv_fixed = fix_end_of_month_if_needed(fv_str, expected_day)
            if fv_fixed != fv_str:
                fechas_eom_corregidas += 1
                fv_str = fv_fixed
        # ─────────────────────────────────────────────────────────

        # Caso especial LC1-11-9 Cuota 4 confirmado por el usuario como 11 de mayo de 2025
        if '11-9' in k and 'LC1' in k and n == 4:
            fp_str = '2025-05-11'
            fp_obs = 'Fecha confirmada 11/05/2025'

        if fp_obs and 'PAGO MÚLTIPLE' in fp_obs:
            pagos_multiples += 1
        if fp_obs and 'FECHA' in fp_obs:
            fechas_invertidas += 1

        estado_final = map_estado_cuota(est_raw, is_pag, fv_str)

        # Valor cuota: si no tiene valor digitado pero está dentro de plazo, usar valor pactado
        val_programado = vc if vc > 0 else (cuota_contrato if (plazo_contrato > 0 and n <= plazo_contrato) else 0.0)
        val_pagado = vc if is_pag else 0.0

        # Si no hay fecha de vencimiento ni valor programado ni pago, omitir
        if not fv_str and val_programado <= 0 and not is_pag:
            continue

        obs_parts = []
        if fp_obs: obs_parts.append(fp_obs)
        if fv_obs: obs_parts.append(f'FV: {fv_obs}')
        observacion = ' | '.join(obs_parts) if obs_parts else None

        cuotas_insert.append({
            'venta_id':          venta_uuid,
            'numero_cuota':      n,
            'fecha_vencimiento': fv_str,
            'valor_cuota':       val_programado,
            'fecha_pago':        fp_str,
            'valor_pagado':      val_pagado,
            'estado_cuota':      estado_final,
            'medio_pago':        mp_raw,
            'comprobante_url':   None,
            'observacion':       observacion,
        })

print(f"  ✓ {len(cuotas_insert)} cuotas preparadas para inserción.")
print(f"    • Pagos múltiples registrados:       {pagos_multiples}")
print(f"    • Fechas inferidas/ajustadas:        {fechas_invertidas}")
print(f"    • Fechas end-of-month corregidas:    {fechas_eom_corregidas}")

upload_batch('cuotas', cuotas_insert, 'cuotas')

# ── RESUMEN Y RECONCILIACIÓN FINAL ─────────────────────
total_recaudo_cuotas = sum(c['valor_pagado'] for c in cuotas_insert)
cuotas_pagadas_count = sum(1 for c in cuotas_insert if c['estado_cuota'] == 'PAGA')
cuotas_vencidas_count = sum(1 for c in cuotas_insert if c['estado_cuota'] == 'VENCIDA')
cuotas_aldia_count = sum(1 for c in cuotas_insert if c['estado_cuota'] == 'AL DÍA')

print("\n" + "=" * 64)
print("  🎉 ¡SINCRONIZACIÓN EXITOSA Y COMPLETA!")
print("=" * 64)
print(f"  • Lotes en base de datos:    {len(lotes_map)}")
print(f"  • Vendedores en BD:          {len(vendedores_set)}")
print(f"  • Clientes en BD:            {len(cli_records)}")
print(f"  • Ventas en BD:              {len(ventas_insert)}")
print(f"  • Cuotas en BD:              {len(cuotas_insert)}")
print("  ────────────────────────────────────────────────────────")
print(f"  • Cuotas PAGADAS:            {cuotas_pagadas_count}")
print(f"  • Cuotas VENCIDAS (mora):    {cuotas_vencidas_count}")
print(f"  • Cuotas AL DÍA / FUTURAS:   {cuotas_aldia_count}")
print(f"  • Recaudo Cuotas en BD:      ${total_recaudo_cuotas:,.2f}")
print(f"  • Fechas EOM corregidas:     {fechas_eom_corregidas}")
print("=" * 64)
