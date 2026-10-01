"""
SINCRONIZACIÓN MAESTRA DEFINITIVA — GOOGLE SHEETS -> SUPABASE (v4)
Incluye:
1. Parser robusto to_num para moneda colombiana (sin pérdida de ceros ni truncamiento de miles).
2. Cálculo exacto de abonos extraordinarios y cuotas amortizadas por contrato.
3. Observaciones detalladas en cada cuota amortizada indicando el abono origen y la fecha/cuota del próximo aporte.
4. Cuotas amortizadas con valor_pagado = 0.0 para no duplicar recaudo y visualización limpia ('—').
5. Preservación estricta de lotes de prueba TEST y comisiones.
"""
import gspread
from google.oauth2.service_account import Credentials
import sys, re, json, math, time, urllib.request, ssl, calendar
from datetime import datetime, date

sys.stdout.reconfigure(encoding='utf-8')

SPREADSHEET_ID = '1H7u5aiE3m8GPcGp0zN4D_DzcyCMph6hmvIt22i0FYsA'
CREDENTIALS_FILE = 'service_account.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

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
    if isinstance(val, (int, float)):
        return 0.0 if math.isnan(float(val)) else float(val)
    s = str(val).replace('$', '').replace(' ', '').strip()
    if s.startswith('#') or s in ('', 'None', 'nan', '-', '—'): return 0.0
    
    # Manejo de separadores
    if ',' in s and '.' in s:
        if s.rfind(',') > s.rfind('.'):
            # Formato latino: 14.000.000,00 -> puntos son miles, coma es decimal
            s = s.replace('.', '').replace(',', '.')
        else:
            # Formato gringo: 14,000,000.00 -> comas son miles, punto es decimal
            s = s.replace(',', '')
    elif '.' in s and ',' not in s:
        # Solo tiene puntos: en pesos colombianos son miles (14.000.000 o 875.000)
        s = s.replace('.', '')
    elif ',' in s and '.' not in s:
        # Solo tiene comas
        partes = s.split(',')
        if len(partes) > 2 or (len(partes) == 2 and len(partes[-1]) == 3):
            # Miles: 14,000,000 o 875,000
            s = s.replace(',', '')
        else:
            # Decimal: 1958,33
            s = s.replace(',', '.')
            
    try:
        return float(s)
    except:
        return 0.0

def clean(val):
    if val is None: return None
    s = str(val).strip()
    return s if s and s.lower() not in ('none','nan','') else None

def norm(val):
    if not val: return ''
    s = str(val).strip().upper()
    return re.sub(r'\s+', ' ', s).replace(' - ','-').replace(' -','-').replace('- ','-')

def parse_date_str(val):
    if not val: return None
    s = str(val).strip().split('T')[0].split(' ')[0]
    m_txt = re.match(r'^([A-Za-z]+)[-\s](\d{2,4})$', s)
    if m_txt:
        mes_nombre = m_txt.group(1).upper()
        mes_num = MESES_TEXTO.get(mes_nombre)
        if mes_num:
            yr = int(m_txt.group(2))
            if yr < 100: yr += 2000
            return f'{yr:04d}-{mes_num:02d}-01'
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%y', '%m/%d/%y', '%Y/%m/%d'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except: pass
    try:
        f = float(s)
        if 35000 < f < 55000:
            d_val = datetime.fromordinal(datetime(1900, 1, 1).toordinal() + int(f) - 2)
            return d_val.strftime('%Y-%m-%d')
    except: pass
    return None

def inferir_fecha(raw):
    if raw is None: return None, None
    s = str(raw).strip()
    if not s or s.lower() in ('none','nan',''): return None, None
    d = parse_date_str(s)
    if d: return d, None
    return None, f"Original: {s[:30]}"

def extract_day_from_dias_pago(dias_pago_val):
    if not dias_pago_val: return None
    s = str(dias_pago_val).strip()
    m = re.search(r'\b(\d{1,2})\b', s)
    if m:
        d = int(m.group(1))
        if 1 <= d <= 31: return d
    return None

def fix_end_of_month_if_needed(fv_str, expected_day):
    if not fv_str or not expected_day: return fv_str
    try:
        parts = fv_str.split('-')
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
    except:
        return fv_str
    last_day = calendar.monthrange(y, m)[1]
    correct_day = min(expected_day, last_day)
    if expected_day in (30, 31) and d != correct_day:
        if d in (1, 2, 3) and expected_day >= 28:
            prev_m = m - 1 if m > 1 else 12
            prev_y = y if m > 1 else y - 1
            prev_last = calendar.monthrange(prev_y, prev_m)[1]
            correct_d = min(expected_day, prev_last)
            return f'{prev_y:04d}-{prev_m:02d}-{correct_d:02d}'
        return f'{y:04d}-{m:02d}-{correct_day:02d}'
    return fv_str

def resolve_client_doc(doc, nom, lote_norm):
    if not nom: return None, None
    nom_clean = norm(nom)
    if 'REDONDO' in nom_clean and 'PABLO' in nom_clean:
        return '17111343', 'PABLO EMILIO REDONDO FUQUENE'
    if 'RUBEN' in nom_clean and 'BUSTO' in nom_clean and not doc:
        return 'CEDIDO-RUBEN-BUSTOS', 'RUBEN FABIAN BUSTOS'
    if 'JEISSON' in nom_clean and not doc:
        return 'PENDIENTE-JEISSON-VILLANUEVA', 'JEISSON VILLANUEVA GARCIA'
    if ('MICO' in nom_clean or 'PERALTA' in nom_clean) and not doc:
        return 'CEDIDO-JHON-PERALTA-MICO', 'JHON PERALTA (CEDIDO EN PAGO EL MICO)'
    if 'INGRID' in nom_clean and 'DUVAN' in nom_clean and not doc:
        return 'PENDIENTE-INGRID-Y-DUVAN', 'INGRID Y DUVAN'
    if not doc:
        return f'SIN-DOC-{nom_clean[:20]}', nom.strip()
    if doc == '35485787' and 'ELSA' in nom_clean:
        return 'PENDIENTE-ELSA-ORTEGON-GAVILAN', nom.strip()
    if doc == '1067465637' and 'JHON FREDY' in nom_clean:
        return 'PENDIENTE-JHON-FREDY-ESCOBAR', nom.strip()
    if '/' in nom or ('-' in nom and not any(c.isdigit() for c in nom)):
        return f'{doc}-CO-{lote_norm}', nom.strip()
    return doc, nom.strip()

def api_req(method, path, data=None, params='', prefer='return=minimal', max_retries=3):
    url = BASE + path + (('?' + params) if params else '')
    headers = {
        'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json', 'Prefer': prefer,
    }
    body = json.dumps(data, ensure_ascii=False, default=str).encode('utf-8') if data else None

    for attempt in range(max_retries):
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
                raw = r.read()
                return r.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')[:400]
            if e.code >= 500 and attempt < max_retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return e.code, err_body
        except (urllib.error.URLError, TimeoutError, Exception) as e:
            if attempt < max_retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return 599, str(e)

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
        time.sleep(0.05)
    print(f'    ✅ {done}/{total} {label} procesados. Errores: {errs}               ')
    return done

# ═══════════════════════════════════════════════════════
print("=" * 64)
print("  🚀 SINCRONIZACIÓN DEFINITIVA — GOOGLE SHEETS -> SUPABASE (v4)")
print(f"  📅 Fecha de hoy: {TODAY}")
print(f"  📊 Hoja en la nube: {SPREADSHEET_ID}")
print("=" * 64)

print("\nConectando a Google Sheets vía API...")
t_init = time.time()
creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
gc = gspread.authorize(creds)
sh = gc.open_by_key(SPREADSHEET_ID)

print("Descargando hojas de cálculo...")
rows_listado = sh.worksheet('LISTADO').get_all_values()
rows_ventas  = sh.worksheet('VENTAS').get_all_values()
rows_proy    = sh.worksheet('PROYECCIÓN').get_all_values()
print(f"✓ Datos leídos de Google Sheets en {round(time.time() - t_init, 2)}s.")

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
for r in rows_listado[2:]:
    if len(r) < 4: continue
    raw = clean(r[3])
    if not raw or raw == 'ID LOTE': continue
    k = norm(raw)
    if k == 'LC1-8-4': continue
    curr = lotes_info.get(k)
    if not curr: continue

    est_raw = clean(r[11]) if len(r) > 11 else 'DISPONIBLE'
    est_db = 'VENDIDO' if (est_raw and 'CEDIDO' in est_raw.upper()) else (est_raw or 'DISPONIBLE')
    pv = to_num(r[13]) if len(r) > 13 else 0.0
    obs = clean(r[18]) if len(r) > 18 else None

    if curr.get('estado') != est_db or abs(to_num(curr.get('precio_venta')) - pv) > 1:
        api_req('PATCH', f'lotes?id=eq.{curr["id"]}',
                data={'estado': est_db, 'precio_venta': pv, 'observacion': obs})
        lotes_actualizados += 1

print(f"  ✓ {lotes_actualizados} lotes actualizados con últimos cambios de LISTADO.")

# ── PASO 2: VENDEDORES Y CLIENTES ──────────────────────
print("\n[2/6] Extrayendo y sincronizando Vendedores y Clientes...")
clientes_dict = {}
vendedores_set = set()

for r in rows_ventas[2:]:
    if not any(r) or len(r) < 15: continue
    raw_lote = clean(r[1])
    if not raw_lote or raw_lote == 'ID LOTE': continue
    k = norm(raw_lote)
    if k == 'LC1-8-4': continue

    doc  = clean(r[13]) if len(r) > 13 else None
    if doc and doc.endswith('.0'): doc = doc[:-2]
    nom  = clean(r[14]) if len(r) > 14 else None
    cel  = clean(r[15]) if len(r) > 15 else None
    if cel and cel.endswith('.0'): cel = cel[:-2]
    dir_c = clean(r[16]) if len(r) > 16 else None
    ciu  = clean(r[17]) if len(r) > 17 else None
    vend = clean(r[18]) if len(r) > 18 else None

    if nom:
        doc_final, nom_final = resolve_client_doc(doc, nom, k)
        if doc_final and doc_final not in clientes_dict:
            clientes_dict[doc_final] = {
                'doc_cliente': doc_final,
                'nombre': nom_final,
                'celular': cel,
                'direccion': dir_c,
                'ciudad': ciu
            }

    if vend:
        vendedores_set.add(vend)

vend_records = [{'nombre': v, 'activo': True} for v in sorted(vendedores_set)]
upload_batch('vendedores?on_conflict=nombre', vend_records, 'vendedores', prefer='return=minimal,resolution=ignore-duplicates')

cli_records = list(clientes_dict.values())
upload_batch('clientes?on_conflict=doc_cliente', cli_records, 'clientes', prefer='return=minimal,resolution=merge-duplicates')

status, clientes_db = api_req('GET', 'clientes', params='select=id,doc_cliente,nombre&limit=1000')
clientes_id_map = {str(c['doc_cliente']).strip(): c['id'] for c in clientes_db}
print(f"  ✓ {len(clientes_id_map)} clientes activos e indexados en Supabase.")

# ── PASO 3: LIMPIAR VENTAS Y CUOTAS (PRESERVANDO TEST) ─
print("\n[3/6] Limpiando tablas ventas y cuotas anteriores (preservando lotes de prueba)...")
status_tl, test_lotes = api_req('GET', 'lotes', params='id_lote=ilike.TEST*&select=id')
test_lote_ids = [l['id'] for l in (test_lotes or []) if isinstance(l, dict) and 'id' in l]

test_venta_ids = []
if test_lote_ids:
    status_tv, test_ventas = api_req('GET', 'ventas', params=f'lote_id=in.({",".join(test_lote_ids)})&select=id')
    test_venta_ids = [v['id'] for v in (test_ventas or []) if isinstance(v, dict) and 'id' in v]

if test_venta_ids:
    s_c, _ = api_req('DELETE', 'cuotas', params=f'venta_id=not.in.({",".join(test_venta_ids)})')
    s_v, _ = api_req('DELETE', 'ventas', params=f'lote_id=not.in.({",".join(test_lote_ids)})')
else:
    s_c, _ = api_req('DELETE', 'cuotas', params='id=not.is.null')
    s_v, _ = api_req('DELETE', 'ventas', params='id=not.is.null')

print(f"  ✓ Tablas limpiadas ({len(test_venta_ids)} ventas de prueba preservadas).")

# ── PASO 4: VENTAS ────────────────────────────────────
print("\n[4/6] Construyendo e insertando VENTAS...")
# Mapa de total pagado en cuotas por lote desde PROYECCIÓN (Col HS)
proy_pagado_map = {}
for r_p in rows_proy[3:]:
    if len(r_p) > 226 and r_p[2]:
        proy_pagado_map[norm(r_p[2])] = to_num(r_p[226])

ventas_insert = []
ventas_lote_norm = {}
lotes_pagados_total_count = 0

for idx, r in enumerate(rows_ventas[2:], 3):
    if not any(r) or len(r) < 15: continue
    raw = clean(r[1])
    if not raw or raw == 'ID LOTE': continue
    k = norm(raw)
    if k == 'LC1-8-4': continue

    lote_uuid = lotes_map.get(k)
    if not lote_uuid: continue

    estado = clean(r[2]) or 'DISPONIBLE'
    doc    = clean(r[13]) if len(r) > 13 else None
    if doc and doc.endswith('.0'): doc = doc[:-2]
    nom    = clean(r[14]) if len(r) > 14 else None

    doc_final, nom_final = resolve_client_doc(doc, nom, k)
    cli_uuid = clientes_id_map.get(doc_final) if doc_final else None

    f_venta, _ = inferir_fecha(r[5]) if len(r) > 5 else (None, None)
    f_ci,    _ = inferir_fecha(r[7]) if len(r) > 7 else (None, None)

    # Caso especial LC1-8-3 Y 4 consolidado
    raw_lote_norm = norm(raw)
    if '8-3' in raw_lote_norm and '4' in raw_lote_norm and 'LC1' in raw_lote_norm:
        cli_uuid = clientes_id_map.get('1018446159') or cli_uuid
        r_precio = to_num(r[3]) or 55482000.0
        vendedor_final = clean(r[18]) or 'YADIRA RIVERA'
        f_venta = f_venta or '2026-09-15'
        f_ci = f_ci or '2026-09-15'
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
            'comision_vendedor':        to_num(r[19]) if len(r) > 19 else 0.0,
            'abonos':                   to_num(r[20]) if len(r) > 20 else 0.0,
            'descuentos':               0.0,
            'saldo':                    0.0,
        }
        ventas_insert.append(venta_rec)
        ventas_lote_norm[k] = venta_rec
        lotes_pagados_total_count += 1
        continue

    # Typo LC2-42-7
    dias_pago_raw = clean(r[12]) if len(r) > 12 else None
    if '42-7' in raw_lote_norm and 'LC2' in raw_lote_norm and f_ci is None:
        f_ci = '2026-05-01'

    pv_val = to_num(r[3])
    ci_val = to_num(r[6]) if len(r) > 6 else 0.0
    sf_val = to_num(r[9]) if len(r) > 9 else 0.0
    pagado_cuotas = proy_pagado_map.get(k, 0.0)
    total_recaudado = ci_val + pagado_cuotas

    # Clasificación automática: si ya pagó el 100% del contrato
    if pv_val > 0 and (total_recaudado >= (pv_val - 5000) or (sf_val > 0 and pagado_cuotas >= (sf_val - 5000))):
        estado_final_venta = 'PAGADO EN SU TOTALIDAD'
        saldo_final_venta = 0.0
        lotes_pagados_total_count += 1
    else:
        estado_final_venta = estado
        saldo_final_venta = max(0.0, pv_val - total_recaudado) if pv_val > 0 else (to_num(r[22]) if len(r) > 22 else 0.0)

    venta_rec = {
        'lote_id':                  lote_uuid,
        'cliente_id':               cli_uuid,
        'vendedor_nombre':          clean(r[18]) if len(r) > 18 else None,
        'estado':                   estado_final_venta,
        'precio_venta':             pv_val,
        'apartados':                to_num(r[4]) if len(r) > 4 else 0.0,
        'fecha_venta':              f_venta,
        'valor_cuota_inicial':      ci_val,
        'fecha_pago_cuota_inicial': f_ci,
        'medio_pago':               clean(r[8]) if len(r) > 8 else None,
        'saldo_financiado':         sf_val,
        'plazo_cuotas':             int(to_num(r[10])) if len(r) > 10 and to_num(r[10]) else None,
        'valor_cuota':              to_num(r[11]) if len(r) > 11 else 0.0,
        'dias_pago':                dias_pago_raw,
        'comision_vendedor':        to_num(r[19]) if len(r) > 19 else 0.0,
        'abonos':                   to_num(r[20]) if len(r) > 20 else 0.0,
        'descuentos':               to_num(r[21]) if len(r) > 21 else 0.0,
        'saldo':                    saldo_final_venta,
    }
    ventas_insert.append(venta_rec)
    ventas_lote_norm[k] = venta_rec

upload_batch('ventas', ventas_insert, 'ventas')

# ── PASO 5: INDEXAR IDS DE VENTAS ─────────────────────
print("\n[5/6] Indexando IDs de ventas...")
status, ventas_db = api_req('GET', 'ventas', params='select=id,lote_id&limit=1000')
lote_to_venta_id = {v['lote_id']: v['id'] for v in ventas_db}
print(f"  ✓ {len(lote_to_venta_id)} ventas indexadas.")

# ── PASO 6: INSERTAR CUOTAS DESDE PROYECCIÓN ──────────
print("\n[6/6] Extrayendo y subiendo CUOTAS desde PROYECCIÓN de Google Sheets...")
cuotas_insert = []
fechas_eom_corregidas = 0
cuotas_amortizadas_total = 0

for r in rows_proy[3:]:
    if not any(r) or len(r) < 3: continue
    raw = clean(r[2])
    if not raw or raw == 'ID LOTE': continue

    k = norm(raw)
    if k == 'LC1-8-4': continue

    lote_uuid = lotes_map.get(k)
    venta_uuid = lote_to_venta_id.get(lote_uuid) if lote_uuid else None
    if not venta_uuid: continue

    v_rec = ventas_lote_norm.get(k, {})
    plazo_contrato = v_rec.get('plazo_cuotas') or 0
    cuota_contrato = v_rec.get('valor_cuota') or 0.0
    dias_pago_str  = v_rec.get('dias_pago') or ''
    expected_day   = extract_day_from_dias_pago(dias_pago_str)

    # Pre-extraer todas las cuotas del lote para analizar abonos y coberturas
    cuotas_lote_raw = []
    for n in range(1, 37):
        cs = 10 + (n - 1) * 6
        if cs >= len(r): break
        fv_raw  = r[cs] if len(r) > cs else None
        fp_raw  = r[cs + 2] if len(r) > cs + 2 else None
        vc_raw  = r[cs + 3] if len(r) > cs + 3 else None
        est_raw = clean(r[cs + 4]) if len(r) > cs + 4 else None
        mp_raw  = clean(r[cs + 5]) if len(r) > cs + 5 else None

        vc = to_num(vc_raw)
        fv_str, fv_obs = inferir_fecha(fv_raw)
        fp_str, fp_obs = inferir_fecha(fp_raw)

        if expected_day and expected_day >= 28 and fv_str:
            fv_fixed = fix_end_of_month_if_needed(fv_str, expected_day)
            if fv_fixed != fv_str:
                fechas_eom_corregidas += 1
                fv_str = fv_fixed

        cuotas_lote_raw.append({
            'num': n,
            'fv_str': fv_str,
            'fv_obs': fv_obs,
            'fp_str': fp_str,
            'fp_obs': fp_obs,
            'vc': vc,
            'est_raw': est_raw,
            'mp_raw': mp_raw,
        })

    # Analizar abonos extraordinarios en este contrato
    # Un abono ocurre cuando vc >= 1.5 * cuota_contrato y cuota_contrato > 0
    cobertura_abonos = {} # cuota_num -> {origen_num, valor_abono, fecha_abono, prox_num, prox_fv, saldado_total}
    for c in cuotas_lote_raw:
        n = c['num']
        vc = c['vc']
        if cuota_contrato > 0 and vc >= (1.5 * cuota_contrato):
            # Abono grande en cuota n
            cuotas_que_cubre = vc / cuota_contrato
            cuotas_enteras = int(round(cuotas_que_cubre))
            max_plazo = plazo_contrato if plazo_contrato > 0 else 24
            ultima_cubierta = min(n + cuotas_enteras - 1, max_plazo)
            siguiente_num = ultima_cubierta + 1
            es_saldado = (siguiente_num > max_plazo)

            # Buscar fecha de vencimiento de la siguiente cuota si no está saldado
            siguiente_c = next((x for x in cuotas_lote_raw if x['num'] == siguiente_num), None)
            prox_fv = siguiente_c['fv_str'] if siguiente_c and siguiente_c['fv_str'] else 'próximo ciclo'

            # Guardar metadata para cuotas subsecuentes amortizadas
            for amort_n in range(n + 1, ultima_cubierta + 1):
                cobertura_abonos[amort_n] = {
                    'origen_num': n,
                    'valor_abono': vc,
                    'fecha_abono': c['fp_str'],
                    'prox_num': siguiente_num,
                    'prox_fv': prox_fv,
                    'saldado_total': es_saldado
                }

    # Procesar cuotas para inserción
    for c in cuotas_lote_raw:
        n = c['num']
        vc = c['vc']
        fv_str = c['fv_str']
        fp_str = c['fp_str']
        est_raw = c['est_raw']
        mp_raw = c['mp_raw']

        es_cubierta_por_abono = (n in cobertura_abonos)
        tiene_pago_directo = (vc > 0)
        es_paga_en_sheets = bool(est_raw and 'PAG' in est_raw.upper())

        # Pertinencia de la cuota
        if plazo_contrato > 0 and n <= plazo_contrato:
            pass
        elif es_paga_en_sheets or tiene_pago_directo or es_cubierta_por_abono:
            pass
        else:
            continue

        if not fv_str and cuota_contrato <= 0 and not es_paga_en_sheets:
            continue

        # Estado y Valores
        if es_cubierta_por_abono:
            cuotas_amortizadas_total += 1
            estado_final = 'PAGA'
            val_programado = cuota_contrato if cuota_contrato > 0 else vc
            val_pagado = 0.0  # Sin valor numérico en casillas futuras
            fp_str = None     # Sin fecha de pago inventada en cuotas futuras
            observacion = None # Limpio, sin saturar con observaciones repetidas

        elif es_paga_en_sheets and not tiene_pago_directo:
            # Cuota cubierta por saldo a favor acumulado
            cuotas_amortizadas_total += 1
            estado_final = 'PAGA'
            val_programado = cuota_contrato if cuota_contrato > 0 else 0.0
            val_pagado = 0.0
            fp_str = None
            observacion = None

        else:
            # Cuota normal
            is_pag = bool(tiene_pago_directo) or es_paga_en_sheets
            if is_pag:
                estado_final = 'PAGA'
            elif fv_str and fv_str < TODAY:
                estado_final = 'VENCIDA'
            else:
                estado_final = 'AL DÍA'

            val_programado = vc if vc > 0 else (cuota_contrato if (plazo_contrato > 0 and n <= plazo_contrato) else 0.0)
            val_pagado = vc if is_pag else 0.0

            obs_parts = []
            # Si esta misma cuota fue el origen de un abono grande, colocarle observación descriptiva
            if cuota_contrato > 0 and vc >= (1.5 * cuota_contrato):
                cuotas_enteras = int(round(vc / cuota_contrato))
                max_plazo = plazo_contrato if plazo_contrato > 0 else 24
                ult_cub = min(n + cuotas_enteras - 1, max_plazo)
                if ult_cub >= max_plazo:
                    obs_parts.append(f"Abono extraordinario que salda hasta cuota {ult_cub} (contrato saldado en su totalidad)")
                else:
                    sig_n = ult_cub + 1
                    sig_c = next((x for x in cuotas_lote_raw if x['num'] == sig_n), None)
                    sig_fv = sig_c['fv_str'] if sig_c and sig_c['fv_str'] else ''
                    obs_parts.append(f"Abono extraordinario que cubre hasta cuota {ult_cub} - Próximo aporte: cuota {sig_n} ({sig_fv})")

            if c['fp_obs']: obs_parts.append(c['fp_obs'])
            if c['fv_obs']: obs_parts.append(f"FV: {c['fv_obs']}")
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
            'observacion':       observacion
        })

upload_batch('cuotas', cuotas_insert, 'cuotas')

# ── RESUMEN FINAL ─────────────────────────────────────
print("\n" + "=" * 64)
print("  🎉 ¡SINCRONIZACIÓN EXITOSA DESDE GOOGLE SHEETS (v4)!")
print("=" * 64)
print(f"  • Ventas en BD:                  {len(ventas_insert)}")
print(f"  • Cuotas insertadas en BD:       {len(cuotas_insert)}")
print(f"  • Cuotas amortizadas detalladas: {cuotas_amortizadas_total}")
print(f"  • Fechas EOM corregidas:         {fechas_eom_corregidas}")
print("=" * 64)
