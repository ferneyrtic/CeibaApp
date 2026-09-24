import pandas as pd
import json
import warnings
import math
warnings.filterwarnings('ignore')

file_path = "Base de datos - La Ceiba (3).xlsx"

def safe(v):
    if v is None: return None
    if isinstance(v, float) and math.isnan(v): return None
    if hasattr(v, 'isoformat'): return str(v)[:10]
    if isinstance(v, (int, float)): return v
    return str(v).strip() if str(v).strip() else None

# ===== LISTADO =====
raw = pd.read_excel(file_path, sheet_name='LISTADO', header=None)
# Find header row
header_row = None
for i, row in raw.iterrows():
    row_vals = [str(v) for v in row if str(v) not in ['nan', 'NaT', 'None']]
    if 'ESTADO' in row_vals and 'ID LOTE' in row_vals:
        header_row = i
        break

print(f"Header row in LISTADO: {header_row}")
df_l = pd.read_excel(file_path, sheet_name='LISTADO', skiprows=header_row)
print("LISTADO columns clean:", list(df_l.columns))
lotes = []
for _, row in df_l.iterrows():
    cols = list(df_l.columns)
    lote = {}
    for c in cols:
        lote[str(c).strip()] = safe(row[c])
    lotes.append(lote)

print(f"Lotes total: {len(lotes)}")
print("Sample lote:", json.dumps(lotes[1], indent=2, default=str))

# ===== VENTAS =====
raw_v = pd.read_excel(file_path, sheet_name='VENTAS', header=None)
header_row_v = None
for i, row in raw_v.iterrows():
    row_vals = [str(v) for v in row if str(v) not in ['nan', 'NaT', 'None']]
    if 'ESTADO' in row_vals and 'VENDEDOR' in row_vals:
        header_row_v = i
        break
print(f"\nHeader row in VENTAS: {header_row_v}")
df_v = pd.read_excel(file_path, sheet_name='VENTAS', skiprows=header_row_v)
print("VENTAS columns clean:", list(df_v.columns))
ventas = []
for _, row in df_v.iterrows():
    venta = {}
    for c in df_v.columns:
        venta[str(c).strip()] = safe(row[c])
    ventas.append(venta)
print(f"Ventas total: {len(ventas)}")
print("Sample venta:", json.dumps(ventas[1], indent=2, default=str))

# ===== CARTERA =====
raw_c = pd.read_excel(file_path, sheet_name='CARTERA TOTAL', header=None)
header_row_c = None
for i, row in raw_c.iterrows():
    row_vals = [str(v) for v in row if str(v) not in ['nan', 'NaT', 'None']]
    if 'SALDO' in row_vals and 'ID LOTE' in row_vals:
        header_row_c = i
        break
print(f"\nHeader row in CARTERA: {header_row_c}")
df_c = pd.read_excel(file_path, sheet_name='CARTERA TOTAL', skiprows=header_row_c)
print("CARTERA columns clean:", list(df_c.columns))
