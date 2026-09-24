"""
SCRIPT DE MIGRACIÓN: Base de datos La Ceiba (Excel → Supabase/PostgreSQL)
=========================================================================
Este script lee el archivo Excel original y genera:
1. Datos normalizados en JSON (para revisar antes de importar)
2. Sentencias SQL INSERT (para importar a PostgreSQL/Supabase)

USO:
  python migrate.py

PREREQUISITOS:
  pip install openpyxl pandas supabase
  (El cliente supabase solo se necesita si se usa importación directa)
"""

import pandas as pd
import json
import math
import re
import warnings
from datetime import datetime, date
warnings.filterwarnings('ignore')

FILE_PATH = "Base de datos - La Ceiba (3).xlsx"
OUTPUT_DIR = "migration_output"

import os
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# UTILIDADES
# ============================================================
def safe(v):
    """Convierte valores de pandas a tipos Python limpios."""
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    if isinstance(v, (datetime, date)): return str(v)[:10]
    if hasattr(v, 'isoformat'): return str(v)[:10]
    if isinstance(v, (int,)): return int(v)
    if isinstance(v, float): return round(float(v), 2)
    s = str(v).strip()
    return s if s and s not in ['nan', 'NaT', 'None', 'NaN'] else None

def find_header_row(df, required_cols):
    """Encuentra la fila que contiene los encabezados reales."""
    for i, row in df.iterrows():
        vals = [str(v).strip().upper() for v in row if str(v) not in ['nan','NaT','None']]
        if all(any(req.upper() in v for v in vals) for req in required_cols):
            return i
    return None

# ============================================================
# 1. LEER VENTAS
# ============================================================
print("📖 Leyendo hoja VENTAS...")
raw_v = pd.read_excel(FILE_PATH, sheet_name='VENTAS', header=None)
hr_v = find_header_row(raw_v, ['ESTADO', 'VENDEDOR', 'ID LOTE'])
df_v = pd.read_excel(FILE_PATH, sheet_name='VENTAS', skiprows=hr_v)
df_v.columns = [str(c).strip() for c in df_v.columns]

# Mapeo de columnas reales a nombres normalizados
COL_MAP_VENTAS = {
    'ITEM': 'item',
    'ID LOTE ': 'id_lote',
    'ID LOTE': 'id_lote',
    'ESTADO': 'estado',
    'PRECIO DE VENTA': 'precio_venta',
    'APARTADOS': 'apartados',
    'FECHA DE VENTA': 'fecha_venta',
    'VALOR CUOTA INICIAL': 'valor_cuota_inicial',
    'FECHA DE PAGO DE LA CUOTA INICIAL': 'fecha_pago_cuota_inicial',
    'MEDIO DE PAGO': 'medio_pago',
    'SALDO FINANCIADO': 'saldo_financiado',
    'PLAZO/CUOTAS': 'plazo_cuotas',
    'VALOR CUOTA': 'valor_cuota',
    'DIAS DE PAGO': 'dias_pago',
    '# DOC CLIENTE': 'doc_cliente',
    'NOMBRE Y APELLIDOS': 'nombre_cliente',
    'CELULAR': 'celular',
    'DIRECCIÓN': 'direccion',
    'DIRECCI\u00d3N': 'direccion',
    'CIUDAD': 'ciudad',
    'VENDEDOR': 'vendedor',
    'COMISIÓN VENDEDOR': 'comision_vendedor',
    'COMISI\u00d3N VENDEDOR': 'comision_vendedor',
    'ABONOS': 'abonos',
    'DESCUENTOS': 'descuentos',
    'SALDO': 'saldo',
}

ventas = []
for _, row in df_v.iterrows():
    r = {}
    for col_orig, col_norm in COL_MAP_VENTAS.items():
        if col_orig in df_v.columns:
            r[col_norm] = safe(row.get(col_orig))
    # Skip filas vacías
    if not r.get('id_lote') or not r.get('estado'):
        continue
    # Asegura que ID lote esté limpio
    r['id_lote'] = str(r['id_lote']).strip() if r.get('id_lote') else None
    ventas.append(r)

print(f"  ✅ {len(ventas)} ventas encontradas")

# ============================================================
# 2. EXTRAER CLIENTES únicos
# ============================================================
print("👥 Extrayendo clientes...")
clientes_map = {}
for v in ventas:
    doc = str(v.get('doc_cliente','') or '').strip()
    if doc and doc not in clientes_map:
        clientes_map[doc] = {
            'doc_cliente': doc,
            'nombre': v.get('nombre_cliente'),
            'celular': v.get('celular'),
            'direccion': v.get('direccion'),
            'ciudad': v.get('ciudad'),
        }
clientes = list(clientes_map.values())
print(f"  ✅ {len(clientes)} clientes únicos")

# ============================================================
# 3. EXTRAER VENDEDORES únicos
# ============================================================
print("🧑‍💼 Extrayendo vendedores...")
vendedores_set = set(v.get('vendedor','') for v in ventas if v.get('vendedor'))
vendedores = [{'nombre': name} for name in sorted(vendedores_set)]
print(f"  ✅ {len(vendedores)} vendedores únicos: {[v['nombre'] for v in vendedores]}")

# ============================================================
# 4. GUARDAR JSONs
# ============================================================
print("\n💾 Guardando archivos JSON...")

with open(f"{OUTPUT_DIR}/ventas.json", 'w', encoding='utf-8') as f:
    json.dump(ventas, f, ensure_ascii=False, indent=2, default=str)
print(f"  ✅ {OUTPUT_DIR}/ventas.json")

with open(f"{OUTPUT_DIR}/clientes.json", 'w', encoding='utf-8') as f:
    json.dump(clientes, f, ensure_ascii=False, indent=2, default=str)
print(f"  ✅ {OUTPUT_DIR}/clientes.json")

with open(f"{OUTPUT_DIR}/vendedores.json", 'w', encoding='utf-8') as f:
    json.dump(vendedores, f, ensure_ascii=False, indent=2, default=str)
print(f"  ✅ {OUTPUT_DIR}/vendedores.json")

# ============================================================
# 5. GENERAR SQL INSERTS
# ============================================================
print("\n🗄️  Generando SQL...")

def sql_val(v):
    if v is None: return 'NULL'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

sql_lines = []

sql_lines.append("-- =============================================")
sql_lines.append("-- MIGRACIÓN: La Ceiba — Generado automáticamente")
sql_lines.append(f"-- {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
sql_lines.append("-- =============================================\n")

sql_lines.append("-- VENDEDORES")
for v in vendedores:
    sql_lines.append(f"INSERT INTO vendedores (nombre) VALUES ({sql_val(v['nombre'])}) ON CONFLICT DO NOTHING;")

sql_lines.append("\n-- CLIENTES")
for c in clientes:
    sql_lines.append(
        f"INSERT INTO clientes (doc_cliente, nombre, celular, direccion, ciudad) "
        f"VALUES ({sql_val(c['doc_cliente'])}, {sql_val(c['nombre'])}, "
        f"{sql_val(c['celular'])}, {sql_val(c['direccion'])}, {sql_val(c['ciudad'])}) "
        f"ON CONFLICT (doc_cliente) DO NOTHING;"
    )

sql_lines.append("\n-- VENTAS")
for v in ventas:
    sql_lines.append(
        f"INSERT INTO ventas (id_lote, estado, precio_venta, apartados, fecha_venta, "
        f"valor_cuota_inicial, fecha_pago_cuota_inicial, medio_pago, saldo_financiado, "
        f"plazo_cuotas, valor_cuota, dias_pago, doc_cliente, nombre_cliente, celular, "
        f"direccion, ciudad, vendedor, comision_vendedor, abonos, descuentos, saldo) VALUES ("
        f"{sql_val(v.get('id_lote'))}, {sql_val(v.get('estado'))}, {sql_val(v.get('precio_venta'))}, "
        f"{sql_val(v.get('apartados'))}, {sql_val(v.get('fecha_venta'))}, "
        f"{sql_val(v.get('valor_cuota_inicial'))}, {sql_val(v.get('fecha_pago_cuota_inicial'))}, "
        f"{sql_val(v.get('medio_pago'))}, {sql_val(v.get('saldo_financiado'))}, "
        f"{sql_val(v.get('plazo_cuotas'))}, {sql_val(v.get('valor_cuota'))}, "
        f"{sql_val(v.get('dias_pago'))}, {sql_val(v.get('doc_cliente'))}, {sql_val(v.get('nombre_cliente'))}, "
        f"{sql_val(v.get('celular'))}, {sql_val(v.get('direccion'))}, {sql_val(v.get('ciudad'))}, "
        f"{sql_val(v.get('vendedor'))}, {sql_val(v.get('comision_vendedor'))}, "
        f"{sql_val(v.get('abonos'))}, {sql_val(v.get('descuentos'))}, {sql_val(v.get('saldo'))});"
    )

with open(f"{OUTPUT_DIR}/migration.sql", 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))
print(f"  ✅ {OUTPUT_DIR}/migration.sql")

# ============================================================
# RESUMEN
# ============================================================
print("\n" + "="*50)
print("✅ MIGRACIÓN COMPLETADA")
print("="*50)
print(f"  Ventas exportadas:    {len(ventas)}")
print(f"  Clientes únicos:      {len(clientes)}")
print(f"  Vendedores únicos:    {len(vendedores)}")
print(f"\nArchivos en: ./{OUTPUT_DIR}/")
print("  - ventas.json")
print("  - clientes.json")
print("  - vendedores.json")
print("  - migration.sql")
print("\nPróximo paso: Ejecutar migration.sql en Supabase SQL Editor")
