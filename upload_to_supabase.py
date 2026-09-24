"""
IMPORTACIÓN DIRECTA A SUPABASE
================================
Lee los JSON generados por migrate.py y los sube directamente
a Supabase usando la API REST. Sin necesidad de copiar SQL.

USO: python upload_to_supabase.py
"""
import json
import sys
import time
import math

# ---- Configuración ----
SUPABASE_URL = "https://qatfoxmarddsocnwycgy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTUyNDIsImV4cCI6MjA5ODczMTI0Mn0.7kRWYrRHT0zFgFD24SDF3nHwOS0kz_v-DYvME3lP6Uk"
OUTPUT_DIR = "migration_output"
BATCH_SIZE = 50  # Supabase acepta hasta 1000 por batch, usamos 50 para seguridad

# ---- Intentar importar supabase ----
try:
    from supabase import create_client
    USE_SUPABASE_LIB = True
except ImportError:
    import urllib.request, urllib.error
    USE_SUPABASE_LIB = False

def clean_record(r):
    """Limpia valores None/nan del diccionario."""
    out = {}
    for k, v in r.items():
        if v is None:
            out[k] = None
        elif isinstance(v, float) and math.isnan(v):
            out[k] = None
        elif v == 'None' or v == 'nan' or v == 'NaT':
            out[k] = None
        else:
            out[k] = v
    return out

def upload_batch_requests(table, records):
    """Sube usando urllib (sin librería supabase)."""
    import urllib.request
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates",
    }
    data = json.dumps(records, ensure_ascii=False, default=str).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def upload_batch_supabase(client, table, records):
    """Sube usando la librería oficial de Supabase."""
    result = client.table(table).upsert(records, ignore_duplicates=True).execute()
    return 200, result

def upload_table(client, table, records, label=""):
    total   = len(records)
    batches = math.ceil(total / BATCH_SIZE)
    errors  = []
    print(f"\n  📤 Subiendo {total} {label}...")

    for i in range(batches):
        batch  = [clean_record(r) for r in records[i*BATCH_SIZE:(i+1)*BATCH_SIZE]]
        start  = i * BATCH_SIZE
        end    = min(start + BATCH_SIZE, total)

        try:
            if USE_SUPABASE_LIB and client:
                status, _ = upload_batch_supabase(client, table, batch)
            else:
                status, body = upload_batch_requests(table, batch)
                if status not in (200, 201):
                    errors.append(f"Batch {i+1}: HTTP {status} — {body[:200]}")
                    continue
        except Exception as e:
            errors.append(f"Batch {i+1}: {str(e)[:100]}")
            continue

        pct = round((end / total) * 100)
        bar = "█" * (pct // 5) + "░" * (20 - pct // 5)
        print(f"    [{bar}] {pct}% ({end}/{total})", end='\r')
        time.sleep(0.1)  # pequeña pausa para no saturar la API

    print(f"    ✅ {total} {label} subidos exitosamente            ")
    if errors:
        print(f"    ⚠️  {len(errors)} errores:")
        for e in errors[:5]: print(f"      - {e}")

# =============================================
# MAIN
# =============================================
def main():
    print("="*55)
    print("  MIGRACIÓN → SUPABASE: La Ceiba")
    print("="*55)

    # Inicializar cliente
    client = None
    if USE_SUPABASE_LIB:
        print("  Usando librería supabase-py ✓")
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
    else:
        print("  Usando urllib directo ✓")

    # ---- 1. Vendedores ----
    with open(f"{OUTPUT_DIR}/vendedores.json", encoding='utf-8') as f:
        vendedores = json.load(f)
    upload_table(client, "vendedores", vendedores, "vendedores")

    # ---- 2. Clientes ----
    with open(f"{OUTPUT_DIR}/clientes.json", encoding='utf-8') as f:
        clientes = json.load(f)
    # Renombrar campos si es necesario
    clientes_clean = []
    for c in clientes:
        clientes_clean.append({
            "doc_cliente": str(c.get("doc_cliente","") or "").strip(),
            "nombre":      c.get("nombre"),
            "celular":     c.get("celular"),
            "direccion":   c.get("direccion"),
            "ciudad":      c.get("ciudad"),
        })
    # Filtrar sin doc_cliente
    clientes_clean = [c for c in clientes_clean if c["doc_cliente"] and c["doc_cliente"] != "None"]
    upload_table(client, "clientes", clientes_clean, "clientes")

    # ---- 3. Ventas ----
    with open(f"{OUTPUT_DIR}/ventas.json", encoding='utf-8') as f:
        ventas = json.load(f)

    ventas_clean = []
    for v in ventas:
        # Mapear columnas del JSON al schema de Supabase
        fv = v.get("fecha_venta")
        fpci = v.get("fecha_pago_cuota_inicial")
        plazo = v.get("plazo_cuotas")
        try: plazo = int(float(plazo)) if plazo else None
        except: plazo = None

        try: precio = float(v.get("precio_venta") or 0)
        except: precio = 0

        try: ci = float(v.get("valor_cuota_inicial") or 0)
        except: ci = 0

        try: sf = float(v.get("saldo_financiado") or 0)
        except: sf = 0

        try: vc = float(v.get("valor_cuota") or 0)
        except: vc = 0

        try: com = float(v.get("comision_vendedor") or 0)
        except: com = 0

        try: abo = float(v.get("abonos") or 0)
        except: abo = 0

        try: desc = float(v.get("descuentos") or 0)
        except: desc = 0

        try: saldo = float(v.get("saldo") or 0)
        except: saldo = 0

        ventas_clean.append({
            "estado":                   v.get("estado") or "VENDIDO",
            "precio_venta":             precio,
            "fecha_venta":              str(fv)[:10] if fv and str(fv) not in ['None','nan'] else None,
            "valor_cuota_inicial":      ci,
            "fecha_pago_cuota_inicial": str(fpci)[:10] if fpci and str(fpci) not in ['None','nan'] else None,
            "medio_pago":               v.get("medio_pago"),
            "saldo_financiado":         sf,
            "plazo_cuotas":             plazo,
            "valor_cuota":              vc,
            "dias_pago":                v.get("dias_pago"),
            "vendedor_nombre":          v.get("vendedor"),
            "comision_vendedor":        com,
            "abonos":                   abo,
            "descuentos":               desc,
            "saldo":                    saldo,
            # Referencia al cliente por doc
            "_doc_cliente":             str(v.get("doc_cliente","") or "").strip(),
            "_id_lote":                 str(v.get("id_lote","") or "").strip(),
        })

    # Necesitamos los IDs de clientes para hacer la relación
    print("\n  🔍 Obteniendo IDs de clientes desde Supabase...")
    if USE_SUPABASE_LIB and client:
        resp = client.table("clientes").select("id,doc_cliente").execute()
        clientes_ids = {c["doc_cliente"]: c["id"] for c in (resp.data or [])}
    else:
        import urllib.request
        url = f"{SUPABASE_URL}/rest/v1/clientes?select=id,doc_cliente&limit=1000"
        headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as r:
            clientes_ids = {c["doc_cliente"]: c["id"] for c in json.loads(r.read())}
    print(f"     {len(clientes_ids)} clientes encontrados en BD")

    # Agregar cliente_id y limpiar campos privados
    ventas_final = []
    for v in ventas_clean:
        doc = v.pop("_doc_cliente", None)
        v.pop("_id_lote", None)  # lote_id se agrega después si hay tabla lotes
        if doc and doc in clientes_ids:
            v["cliente_id"] = clientes_ids[doc]
        ventas_final.append(v)

    upload_table(client, "ventas", ventas_final, "ventas")

    # ---- RESUMEN ----
    print("\n" + "="*55)
    print("  ✅ MIGRACIÓN COMPLETADA")
    print("="*55)
    print(f"  Vendedores: {len(vendedores)}")
    print(f"  Clientes:   {len(clientes_clean)}")
    print(f"  Ventas:     {len(ventas_final)}")
    print()
    print("  Próximo paso:")
    print("  → Abre http://localhost:5173 e inicia sesión")
    print("  → El dashboard mostrará los datos reales 🎉")

if __name__ == "__main__":
    main()
