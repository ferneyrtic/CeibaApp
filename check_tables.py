"""Verifica que las tablas existan en Supabase antes de migrar."""
import sys
sys.stdout.reconfigure(encoding='utf-8')

SUPABASE_URL = "https://qatfoxmarddsocnwycgy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTUyNDIsImV4cCI6MjA5ODczMTI0Mn0.7kRWYrRHT0zFgFD24SDF3nHwOS0kz_v-DYvME3lP6Uk"

import urllib.request, json

tables = ["proyectos", "lotes", "clientes", "vendedores", "ventas", "cuotas"]
headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

print("Verificando tablas en Supabase...\n")
all_ok = True
for table in tables:
    url = f"{SUPABASE_URL}/rest/v1/{table}?limit=1"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"  OK  {table}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "relation" in body and "does not exist" in body:
            print(f"  NO  {table}  <- TABLA NO EXISTE")
            all_ok = False
        else:
            print(f"  ??  {table}  <- {e.code}: {body[:80]}")
            all_ok = False
    except Exception as e:
        print(f"  ERR {table}  <- {e}")
        all_ok = False

print()
if all_ok:
    print("RESULTADO: Todas las tablas existen. Listo para migrar.")
else:
    print("RESULTADO: Faltan tablas. Debes ejecutar el schema.sql primero en Supabase.")
    print()
    print("COMO HACERLO:")
    print("1. Ve a https://supabase.com -> tu proyecto")
    print("2. Menu izquierdo -> SQL Editor")
    print("3. Crea un 'New query'")
    print("4. Copia y pega el contenido del archivo schema.sql")
    print(f"   Archivo: C:\\Users\\Ferney 5CA\\.gemini\\antigravity\\brain\\79041d62-ce3d-474f-945b-af4b645291de\\schema.sql")
    print("5. Click en 'Run' (boton verde)")
