"""
Migración de VENTAS a Supabase — versión corregida.
Todos los registros tienen exactamente las mismas columnas.
"""
import sys, json, math, time, urllib.request, urllib.error
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://qatfoxmarddsocnwycgy.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s"
OUTPUT_DIR   = "migration_output"
BATCH_SIZE   = 50

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates,return=minimal",
}

def post_batch(table, records):
    url  = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(records, ensure_ascii=False, default=str).encode('utf-8')
    req  = urllib.request.Request(url, data=body, headers=HEADERS, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

def num(x):
    try:
        v = float(x)
        return None if (v != v) else v   # NaN check
    except:
        return None

def safe_date(v):
    if not v or str(v) in ['None', 'nan', 'NaT', '']: return None
    s = str(v)[:10]
    # Rechazar fechas inválidas obvias como 30/02
    parts = s.split('-')
    if len(parts) == 3:
        try:
            y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
            if 1 <= m <= 12 and 1 <= d <= 31 and 2000 <= y <= 2100:
                return s
        except:
            pass
    return None

def safe_str(v):
    if v is None or str(v) in ['None', 'nan', 'NaT', '']: return None
    return str(v).strip() or None

# ---- Obtener IDs de clientes ----
print("Obteniendo clientes desde Supabase...")
url = f"{SUPABASE_URL}/rest/v1/clientes?select=id,doc_cliente&limit=1000"
req = urllib.request.Request(url, headers=HEADERS)
with urllib.request.urlopen(req) as r:
    cli_ids = {c["doc_cliente"]: c["id"] for c in json.loads(r.read())}
print(f"  {len(cli_ids)} clientes en BD\n")

# ---- Leer ventas ----
ventas_raw = json.load(open(f"{OUTPUT_DIR}/ventas.json", encoding='utf-8'))

# Todas las ventas tienen EXACTAMENTE las mismas columnas
COLS = [
    "estado", "precio_venta", "fecha_venta",
    "valor_cuota_inicial", "fecha_pago_cuota_inicial",
    "medio_pago", "saldo_financiado", "plazo_cuotas",
    "valor_cuota", "dias_pago", "vendedor_nombre",
    "comision_vendedor", "abonos", "descuentos", "saldo",
    "cliente_id",
]

ventas = []
skipped = 0
for v in ventas_raw:
    doc   = safe_str(v.get("doc_cliente"))
    plazo = v.get("plazo_cuotas")
    try:
        plazo = int(float(plazo)) if plazo and str(plazo) not in ['None','nan'] else None
    except:
        plazo = None

    rec = {
        "estado":                   safe_str(v.get("estado")) or "VENDIDO",
        "precio_venta":             num(v.get("precio_venta")),
        "fecha_venta":              safe_date(v.get("fecha_venta")),
        "valor_cuota_inicial":      num(v.get("valor_cuota_inicial")),
        "fecha_pago_cuota_inicial": safe_date(v.get("fecha_pago_cuota_inicial")),
        "medio_pago":               safe_str(v.get("medio_pago")),
        "saldo_financiado":         num(v.get("saldo_financiado")),
        "plazo_cuotas":             plazo,
        "valor_cuota":              num(v.get("valor_cuota")),
        "dias_pago":                safe_str(v.get("dias_pago")),
        "vendedor_nombre":          safe_str(v.get("vendedor")),
        "comision_vendedor":        num(v.get("comision_vendedor")),
        "abonos":                   num(v.get("abonos")),
        "descuentos":               num(v.get("descuentos")),
        "saldo":                    num(v.get("saldo")),
        "cliente_id":               cli_ids.get(doc) if doc else None,
    }
    # Verificar que todas las columnas estén presentes
    assert set(rec.keys()) == set(COLS), f"Columnas incorrectas: {rec.keys()}"
    ventas.append(rec)

print(f"Subiendo {len(ventas)} ventas (skipped: {skipped})...")
total   = len(ventas)
batches = math.ceil(total / BATCH_SIZE)
ok = fail = 0

for i in range(batches):
    batch  = ventas[i*BATCH_SIZE:(i+1)*BATCH_SIZE]
    status, err = post_batch("ventas", batch)
    end = min((i+1)*BATCH_SIZE, total)
    pct = round((end/total)*100)

    if status in (200, 201):
        ok += len(batch)
        print(f"  [{pct:3d}%] {end}/{total} OK", end='\r')
    else:
        fail += len(batch)
        print(f"\n  Batch {i+1} ERROR {status}: {err}")
    time.sleep(0.05)

print(f"\n  OK: {ok}  Errores: {fail}          ")

print("\n" + "="*50)
if fail == 0:
    print("  VENTAS MIGRADAS EXITOSAMENTE")
else:
    print(f"  COMPLETADO — {ok} ventas OK, {fail} con error")
print("="*50)
print(f"  Total ventas: {len(ventas)}")
print()
print("Abre http://localhost:5173 e inicia sesion")
