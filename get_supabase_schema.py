import urllib.request, json, ssl

ctx = ssl.create_default_context()
BASE = 'https://qatfoxmarddsocnwycgy.supabase.co/rest/v1/'
KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGZveG1hcmRkc29jbnd5Y2d5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE1NTI0MiwiZXhwIjoyMDk4NzMxMjQyfQ.cR2f5MTxRt3Tl0ZzDQJ0fFtFFnVelWq0sE5bV4chp0s'

req = urllib.request.Request(BASE, headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
    spec = json.loads(r.read())

for table in ['ventas', 'cuotas', 'lotes', 'clientes', 'vendedores', 'proyectos']:
    defs = spec.get('definitions', {}).get(table, {}).get('properties', {})
    print(f"\n=== TABLA: {table} ===")
    for col, prop in defs.items():
        t = prop.get('type')
        f = prop.get('format', '')
        print(f"  • {col}: {t} ({f})")
