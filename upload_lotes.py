"""Migración de LOTES desde el Excel directamente a Supabase."""
import sys, json, math, time, urllib.request, urllib.error
import pandas as pd
import warnings
warnings.filterwarnings('ignore')
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://qatfoxmarddsocnwycgy.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s"
FILE_PATH    = "Base de datos - La Ceiba (3).xlsx"
BATCH_SIZE   = 50

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal",
}

VALID_ESTADOS = {'VENDIDO','DISPONIBLE','EN NEGOCIACIÓN','APARTADO','NO APTO PARA VENTA'}

def safe_str(v):
    if v is None or str(v) in ['None','nan','NaT','']: return None
    return str(v).strip() or None

def safe_num(v):
    try:
        f = float(v)
        return None if (f != f) else round(f, 2)
    except: return None

def safe_date(v):
    if not v or str(v) in ['None','nan','NaT','']: return None
    s = str(v)[:10]
    parts = s.split('-')
    if len(parts) == 3:
        try:
            y,m,d = int(parts[0]),int(parts[1]),int(parts[2])
            if 2000<=y<=2100 and 1<=m<=12 and 1<=d<=31: return s
        except: pass
    return None

def post_batch(table, records):
    url  = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(records, ensure_ascii=False, default=str).encode('utf-8')
    req  = urllib.request.Request(url, data=body, headers=HEADERS, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, None
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

# ---- Obtener proyecto_id ----
print("Obteniendo proyecto La Ceiba...")
r = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/proyectos?select=id,nombre&limit=5",
    headers=HEADERS)
with urllib.request.urlopen(r) as res:
    proyectos = json.loads(res.read())

proyecto_id = None
for p in proyectos:
    if 'ceiba' in p['nombre'].lower():
        proyecto_id = p['id']
        print(f"  Proyecto: {p['nombre']} → {proyecto_id}")
        break

if not proyecto_id:
    # Crear proyecto si no existe
    body = json.dumps([{"nombre":"La Ceiba","descripcion":"Proyecto inmobiliario"}]).encode()
    req  = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/proyectos", data=body, headers=HEADERS, method='POST')
    with urllib.request.urlopen(req) as res:
        pass
    # Obtener de nuevo
    r = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/proyectos?select=id,nombre&limit=1", headers=HEADERS)
    with urllib.request.urlopen(r) as res:
        proyecto_id = json.loads(res.read())[0]['id']
    print(f"  Proyecto creado: {proyecto_id}")

# ---- Leer Excel ----
print("\nLeyendo hoja LISTADO del Excel...")
raw = pd.read_excel(FILE_PATH, sheet_name='LISTADO', header=None)

# Detectar fila de encabezados (buscar fila con ESTADO y AREA)
header_row = None
for i, row in raw.iterrows():
    vals = [str(v).strip().upper() for v in row if str(v) not in ['nan','NaT','None']]
    if sum(1 for v in vals if 'ESTADO' in v or 'LOTE' in v or 'AREA' in v) >= 3:
        header_row = i
        break

if header_row is None:
    # Fallback: fila 1
    header_row = 1

print(f"  Encabezados en fila {header_row}")
df = pd.read_excel(FILE_PATH, sheet_name='LISTADO', skiprows=header_row)
df.columns = [str(c).strip() for c in df.columns]
print(f"  Columnas: {list(df.columns)}")
print(f"  Filas: {len(df)}")

# ---- Mapear columnas ----
# Las columnas reales del Excel (según descripción)
# ÍTEM, PROYECTO, ID LOTE, ETAPA, #LOTES, MANZANA, LOTE, AREA (M2),
# PRECIO M2, PRECIO DE LOTE, ESTADO, CONTRATO, PRECIO DE VENTA,
# ESCRITURA, FECHA DE ESCRITURA, % ESCRITURADO, A NOMBRE DE, OBSERVACIÓN

def find_col(df, options):
    """Encuentra la primera columna que coincida con alguna de las opciones."""
    cols_upper = {c.upper().strip(): c for c in df.columns}
    for opt in options:
        opt_u = opt.upper().strip()
        if opt_u in cols_upper:
            return cols_upper[opt_u]
        # Búsqueda parcial
        for cu, c in cols_upper.items():
            if opt_u in cu or cu in opt_u:
                return c
    return None

col_item     = find_col(df, ['ÍTEM','ITEM','ÍTЕМ'])
col_proyecto = find_col(df, ['PROYECTO'])
col_id_lote  = find_col(df, ['ID LOTE','IDLOTE'])
col_etapa    = find_col(df, ['ETAPA'])
col_manzana  = find_col(df, ['MANZANA'])
col_lote     = find_col(df, ['LOTE'])
col_area     = find_col(df, ['AREA','ÁREA','AREA (M2)','ÁREA (M2)'])
col_precio_m2= find_col(df, ['PRECIO M2','PRECIO M²','PRECIO/M2'])
col_p_lote   = find_col(df, ['PRECIO DE LOTE','PRECIO LOTE'])
col_estado   = find_col(df, ['ESTADO'])
col_contrato = find_col(df, ['CONTRATO'])
col_p_venta  = find_col(df, ['PRECIO DE VENTA','PRECIO VENTA'])
col_escritura= find_col(df, ['ESCRITURA'])
col_fecha_esc= find_col(df, ['FECHA DE ESCRITURA','FECHA ESCRITURA'])
col_pct_esc  = find_col(df, ['% ESCRITURADO','ESCRITURADO'])
col_propiet  = find_col(df, ['A NOMBRE DE','PROPIETARIO','NOMBRE'])
col_obs      = find_col(df, ['OBSERVACIÓN','OBSERVACION'])

print(f"\n  Columna ID LOTE: '{col_id_lote}'")
print(f"  Columna ESTADO:  '{col_estado}'")
print(f"  Columna AREA:    '{col_area}'")

# ---- Construir lotes ----
lotes = []
seen_ids = set()

for _, row in df.iterrows():
    id_lote = safe_str(row.get(col_id_lote)) if col_id_lote else None
    if not id_lote or id_lote in seen_ids:
        continue
    seen_ids.add(id_lote)

    estado_raw = safe_str(row.get(col_estado)) if col_estado else None
    # Normalizar estado
    if estado_raw:
        e_up = estado_raw.upper()
        if 'VENDIDO' in e_up:            estado = 'VENDIDO'
        elif 'DISPONIBLE' in e_up:       estado = 'DISPONIBLE'
        elif 'NEGOCI' in e_up:           estado = 'EN NEGOCIACIÓN'
        elif 'APARTADO' in e_up:         estado = 'APARTADO'
        elif 'NO APTO' in e_up:          estado = 'NO APTO PARA VENTA'
        else:                            estado = 'DISPONIBLE'
    else:
        estado = 'DISPONIBLE'

    lote = {
        "proyecto_id": proyecto_id,
        "id_lote":     id_lote,
        "etapa":       int(float(row.get(col_etapa,1) or 1)) if col_etapa else 1,
        "manzana":     safe_str(row.get(col_manzana)) if col_manzana else None,
        "lote":        safe_str(row.get(col_lote)) if col_lote else None,
        "area_m2":     safe_num(row.get(col_area)) if col_area else None,
        "precio_m2":   safe_num(row.get(col_precio_m2)) if col_precio_m2 else None,
        "precio_lote": safe_num(row.get(col_p_lote)) if col_p_lote else None,
        "estado":      estado,
        "contrato":    safe_str(row.get(col_contrato)) if col_contrato else None,
        "precio_venta":safe_num(row.get(col_p_venta)) if col_p_venta else None,
        "escritura":   safe_str(row.get(col_escritura)) if col_escritura else None,
        "fecha_escritura": safe_date(row.get(col_fecha_esc)) if col_fecha_esc else None,
        "porcentaje_escriturado": safe_num(row.get(col_pct_esc)) if col_pct_esc else None,
        "propietario": safe_str(row.get(col_propiet)) if col_propiet else None,
        "observacion": safe_str(row.get(col_obs)) if col_obs else None,
    }
    lotes.append(lote)

print(f"\n  {len(lotes)} lotes listos para subir")
print(f"  Ejemplo: {json.dumps(lotes[0], ensure_ascii=False, default=str)}")

# ---- Subir ----
total   = len(lotes)
batches = math.ceil(total / BATCH_SIZE)
ok = fail = 0

print(f"\nSubiendo {total} lotes...")
for i in range(batches):
    batch  = lotes[i*BATCH_SIZE:(i+1)*BATCH_SIZE]
    status, err = post_batch("lotes", batch)
    end = min((i+1)*BATCH_SIZE, total)
    pct = round((end/total)*100)
    if status in (200,201):
        ok += len(batch)
        print(f"  [{pct:3d}%] {end}/{total} OK", end='\r')
    else:
        fail += len(batch)
        print(f"\n  Batch {i+1} ERROR {status}: {err}")
    time.sleep(0.05)

print(f"\n  OK: {ok}  Errores: {fail}          ")
print("\n" + "="*50)
print(f"  LOTES: {ok} migrados exitosamente")
print("="*50)
