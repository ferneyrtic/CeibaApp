"""
Investigar por qué hay una diferencia de $43,849,600 entre PROYECCIÓN (Col HS) y lo subido
"""
import openpyxl, sys
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
wb = openpyxl.load_workbook(FILE, data_only=True)
p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]

def to_num(val):
    if val is None: return 0.0
    try:
        if isinstance(val, (int, float)): return float(val)
        s = str(val).replace('$','').replace(',','').strip()
        if s.startswith('#') or s in ('','None','nan'): return 0.0
        return float(s)
    except: return 0.0

def clean_str(val):
    if val is None: return None
    s = str(val).strip()
    return s if s and s.lower() not in ('none','nan','') else None

col_hs = openpyxl.utils.column_index_from_string('HS')

diferencias_por_lote = []
total_diferencia = 0.0

for row_idx, r in enumerate(ws_p.iter_rows(min_row=4, values_only=True), start=4):
    if not any(r): continue
    raw_id = clean_str(r[2])
    if not raw_id: continue

    hs_val = to_num(r[col_hs - 1]) if col_hs <= len(r) else 0.0

    # Cómo calculó upload_all_cuotas:
    plazo_str = r[7]
    plazo = int(to_num(plazo_str)) if to_num(plazo_str) else 36

    sum_calculada = 0.0
    cuotas_info = []

    for n in range(1, 45):
        c_start = 10 + (n - 1) * 6
        if c_start >= len(r): break
        f_venc = r[c_start]
        f_pago = r[c_start + 2]
        v_cuota = to_num(r[c_start + 3])
        est_c = clean_str(r[c_start + 4])

        # En upload_all_cuotas pusimos:
        # for n in range(1, min(plazo_max + 1, 45)):
        # if not f_venc and v_cuota <= 0 and not f_pago: break
        # is_pag = bool(f_pago and v_cuota > 0) or (est_c and 'PAG' in est_c.upper())
        # val_pagado = v_cuota if is_pag else 0.0

        is_pag = bool(f_pago and v_cuota > 0) or (est_c and 'PAG' in est_c.upper())
        val_pagado = v_cuota if is_pag else 0.0

        # Ver si se contó en upload_all_cuotas:
        dentro_de_plazo = (n <= min(plazo, 44))
        if dentro_de_plazo and (f_venc or v_cuota > 0 or f_pago):
            sum_calculada += val_pagado
        elif is_pag:
            # Cuota pagada que quedó FUERA de plazo o después del break!
            cuotas_info.append((n, f_venc, f_pago, v_cuota, est_c, 'FUERA_DE_PLAZO'))

    dif = hs_val - sum_calculada
    if abs(dif) > 1:
        diferencias_por_lote.append({
            'fila': row_idx,
            'lote': raw_id,
            'plazo': plazo,
            'hs_excel': hs_val,
            'sum_calculada': sum_calculada,
            'diferencia': dif,
            'cuotas_fuera': cuotas_info
        })
        total_diferencia += dif

print(f"Total lotes con diferencia: {len(diferencias_por_lote)}")
print(f"Suma total de diferencias: ${total_diferencia:,.2f}")
print("\nDetalle de los lotes con diferencia:")
for d in diferencias_por_lote:
    print(f"• Fila {d['fila']:<3} | Lote: {d['lote']:<16} | Plazo: {d['plazo']} | HS Excel: ${d['hs_excel']:>11,.0f} | Subido: ${d['sum_calculada']:>11,.0f} | Dif: ${d['diferencia']:>11,.0f}")
    if d['cuotas_fuera']:
        print(f"   Cuotas fuera:", d['cuotas_fuera'])
