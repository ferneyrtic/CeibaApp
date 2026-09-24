"""
Migración con service_role key (bypass RLS).
NOTA: Necesitas la SERVICE ROLE KEY de Supabase para esto.
Settings -> API -> service_role (secret)
"""
import sys, json, math, time
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://qatfoxmarddsocnwycgy.supabase.co"
# ⚠️ Reemplaza esto con tu service_role key de Supabase Settings → API
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s"
OUTPUT_DIR  = "migration_output"
BATCH_SIZE  = 100

import urllib.request, urllib.error

def req(method, path, data=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates,return=minimal",
    }
    body = json.dumps(data, ensure_ascii=False, default=str).encode('utf-8') if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as res:
            return res.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]

def upload(table, records, label):
    total   = len(records)
    batches = math.ceil(total / BATCH_SIZE)
    ok = fail = 0
    print(f"\n  Subiendo {total} {label}...")
    for i in range(batches):
        batch = records[i*BATCH_SIZE:(i+1)*BATCH_SIZE]
        status, err = req('POST', table, batch)
        if status in (200, 201):
            ok += len(batch)
        else:
            fail += len(batch)
            print(f"    Batch {i+1} ERROR {status}: {err}")
        pct = round(((i+1)/batches)*100)
        print(f"    {pct}% ({min((i+1)*BATCH_SIZE,total)}/{total})", end='\r')
        time.sleep(0.05)
    print(f"    OK: {ok}  Errores: {fail}                    ")

def clean(r):
    return {k: (None if (v is None or str(v) in ['None','nan','NaT','']) else v) for k, v in r.items()}

def main():
    if SERVICE_KEY == "REEMPLAZAR_CON_SERVICE_ROLE_KEY":
        print("ERROR: Necesitas pegar tu service_role key en este script.")
        print("Donde encontrarla:")
        print("  Supabase Dashboard -> Settings -> API -> service_role (secret)")
        return

    # Vendedores
    vend = json.load(open(f"{OUTPUT_DIR}/vendedores.json", encoding='utf-8'))
    upload("vendedores", [clean(v) for v in vend], "vendedores")

    # Clientes
    cli = json.load(open(f"{OUTPUT_DIR}/clientes.json", encoding='utf-8'))
    cli_clean = [clean({"doc_cliente":str(c.get("doc_cliente","")).strip(),"nombre":c.get("nombre"),"celular":c.get("celular"),"direccion":c.get("direccion"),"ciudad":c.get("ciudad")}) for c in cli if str(c.get("doc_cliente","")).strip()]
    upload("clientes", cli_clean, "clientes")

    # Obtener IDs de clientes
    url = f"{SUPABASE_URL}/rest/v1/clientes?select=id,doc_cliente&limit=1000"
    headers = {"apikey":SERVICE_KEY,"Authorization":f"Bearer {SERVICE_KEY}"}
    r = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(r) as res:
        cli_ids = {c["doc_cliente"]:c["id"] for c in json.loads(res.read())}
    print(f"\n  {len(cli_ids)} clientes en BD")

    # Ventas
    ventas_raw = json.load(open(f"{OUTPUT_DIR}/ventas.json", encoding='utf-8'))
    ventas = []
    for v in ventas_raw:
        fv   = v.get("fecha_venta")
        fpci = v.get("fecha_pago_cuota_inicial")
        try: plazo = int(float(v.get("plazo_cuotas") or 0)) or None
        except: plazo = None
        def num(x):
            try: return float(x) if x else 0.0
            except: return 0.0
        doc = str(v.get("doc_cliente","") or "").strip()
        rec = {
            "estado":                   v.get("estado") or "VENDIDO",
            "precio_venta":             num(v.get("precio_venta")),
            "fecha_venta":              str(fv)[:10] if fv and str(fv) not in ['None','nan'] else None,
            "valor_cuota_inicial":      num(v.get("valor_cuota_inicial")),
            "fecha_pago_cuota_inicial": str(fpci)[:10] if fpci and str(fpci) not in ['None','nan'] else None,
            "medio_pago":               v.get("medio_pago"),
            "saldo_financiado":         num(v.get("saldo_financiado")),
            "plazo_cuotas":             plazo,
            "valor_cuota":              num(v.get("valor_cuota")),
            "dias_pago":                v.get("dias_pago"),
            "vendedor_nombre":          v.get("vendedor"),
            "comision_vendedor":        num(v.get("comision_vendedor")),
            "abonos":                   num(v.get("abonos")),
            "descuentos":               num(v.get("descuentos")),
            "saldo":                    num(v.get("saldo")),
        }
        if doc in cli_ids:
            rec["cliente_id"] = cli_ids[doc]
        ventas.append(clean(rec))
    upload("ventas", ventas, "ventas")

    print("\n" + "="*50)
    print("  MIGRACION COMPLETADA")
    print("="*50)
    print(f"  Vendedores: {len(vend)}")
    print(f"  Clientes:   {len(cli_clean)}")
    print(f"  Ventas:     {len(ventas)}")

if __name__ == "__main__": main()
