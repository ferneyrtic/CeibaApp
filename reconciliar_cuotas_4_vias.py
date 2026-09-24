"""
RECONCILIACIÓN 4-VÍAS:
VENTAS vs PROYECCIÓN vs COBRANZA vs CARTERA TOTAL
"""
import openpyxl, sys, re
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
print(f"Cargando {FILE}...")
wb = openpyxl.load_workbook(FILE, data_only=True)

ws_v = wb['VENTAS']
p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]
ws_cob = wb['COBRANZA']
ws_cart = wb['CARTERA TOTAL']

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

def norm(val):
    if not val: return ''
    s = str(val).strip().upper()
    return re.sub(r'\s+', ' ', s).replace(' - ','-').replace(' -','-').replace('- ','-')

col_hs_idx = openpyxl.utils.column_index_from_string('HS')

# 1. Leer VENTAS
ventas_data = {}
for r in ws_v.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    raw_id = clean_str(r[1])
    if not raw_id or raw_id == 'ID LOTE': continue
    k = norm(raw_id)
    ventas_data[k] = {
        'raw_id': raw_id,
        'estado': clean_str(r[2]),
        'precio_venta': to_num(r[3]),
        'cuota_inicial': to_num(r[6]),
        'saldo_financiado': to_num(r[9]),
        'plazo': int(to_num(r[10])) if to_num(r[10]) else 0,
        'valor_cuota': to_num(r[11]),
        'cliente': clean_str(r[14]),
        'abonos': to_num(r[20]),
        'saldo': to_num(r[22]),
    }

# 2. Leer PROYECCIÓN
proy_data = {}
for r in ws_p.iter_rows(min_row=4, values_only=True):
    if not any(r): continue
    raw_id = clean_str(r[2])
    if not raw_id or raw_id == 'ID LOTE': continue
    k = norm(raw_id)

    hs_val = to_num(r[col_hs_idx - 1]) if col_hs_idx <= len(r) else 0.0

    cuotas_pagas_count = 0
    cuotas_vencidas_count = 0
    cuotas_al_dia_count = 0
    suma_cuotas_pagas = 0.0
    cuotas_detalle = []

    for n in range(1, 45):
        c_start = 10 + (n - 1) * 6
        if c_start >= len(r): break
        f_venc  = r[c_start]
        f_pago  = r[c_start + 2]
        v_cuota = to_num(r[c_start + 3])
        est_c   = clean_str(r[c_start + 4])
        medio_c = clean_str(r[c_start + 5])

        if not f_venc and v_cuota <= 0 and not est_c: break

        is_paga = bool(f_pago and v_cuota > 0) or (est_c and 'PAG' in est_c.upper())
        if is_paga:
            cuotas_pagas_count += 1
            suma_cuotas_pagas += v_cuota
        elif est_c and 'VENC' in est_c.upper():
            cuotas_vencidas_count += 1
        else:
            cuotas_al_dia_count += 1

        cuotas_detalle.append({
            'n': n,
            'f_venc': str(f_venc)[:10] if f_venc else None,
            'f_pago': str(f_pago)[:10] if f_pago else None,
            'valor': v_cuota,
            'estado': est_c,
            'is_paga': is_paga,
        })

    proy_data[k] = {
        'raw_id': raw_id,
        'estado': clean_str(r[3]),
        'precio_venta': to_num(r[4]),
        'saldo_financiado': to_num(r[5]),
        'plazo': int(to_num(r[7])) if to_num(r[7]) else 0,
        'total_pagado_hs': hs_val,
        'suma_cuotas_pagas': suma_cuotas_pagas,
        'cuotas_pagas_count': cuotas_pagas_count,
        'cuotas_vencidas_count': cuotas_vencidas_count,
        'cuotas_al_dia_count': cuotas_al_dia_count,
        'total_cuotas': len(cuotas_detalle),
        'cuotas': cuotas_detalle,
    }

# 3. Leer COBRANZA
cob_data = {}
for r in ws_cob.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    raw_id = clean_str(r[2])
    if not raw_id or raw_id == 'ID LOTE': continue
    k = norm(raw_id)

    estado_promedio = clean_str(r[5])
    cuotas_cob = []
    cob_pagas = 0
    cob_vencidas = 0
    cob_al_dia = 0

    for col_i in range(6, len(r)):
        c_val = clean_str(r[col_i])
        if not c_val: continue
        cuotas_cob.append(c_val)
        if 'PAG' in c_val.upper():
            cob_pagas += 1
        elif 'VENC' in c_val.upper():
            cob_vencidas += 1
        elif 'AL D' in c_val.upper():
            cob_al_dia += 1

    cob_data[k] = {
        'raw_id': raw_id,
        'estado_promedio': estado_promedio,
        'cob_pagas': cob_pagas,
        'cob_vencidas': cob_vencidas,
        'cob_al_dia': cob_al_dia,
        'total_cuotas_cob': len(cuotas_cob),
        'cuotas': cuotas_cob,
    }

# 4. Leer CARTERA TOTAL
cart_data = {}
for r in ws_cart.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    raw_id = clean_str(r[2])
    if not raw_id or raw_id == 'ID LOTE': continue
    k = norm(raw_id)
    cart_data[k] = {
        'raw_id': raw_id,
        'precio_venta': to_num(r[4]),
        'cuota_inicial': to_num(r[5]),
        'saldo_financiado': to_num(r[6]),
        'cuotas_pagadas_monto': to_num(r[7]),
        'total_pagado': to_num(r[8]),
        'saldo': to_num(r[9]),
    }

print(f"Filas leídas: VENTAS={len(ventas_data)}, PROYECCIÓN={len(proy_data)}, COBRANZA={len(cob_data)}, CARTERA TOTAL={len(cart_data)}")

# ── COMPARACIÓN Y RECONCILIACIÓN ───────────────────────────
discrepancias_abonos_vs_proy_hs = []
discrepancias_proy_hs_vs_cartera = []
discrepancias_proy_vs_cobranza = []
cuotas_sin_fecha_pago_pero_pagas = []
cuotas_con_fecha_pago_pero_no_pagas = []

for k, p in proy_data.items():
    v = ventas_data.get(k)
    c = cart_data.get(k)
    cob = cob_data.get(k)

    raw_id = p['raw_id']

    # 1. Comparar VENTAS.abonos vs PROYECCIÓN (Columna HS / suma de cuotas)
    if v and v['saldo_financiado'] > 0:
        diff_ab = abs(v['abonos'] - p['total_pagado_hs'])
        if diff_ab > 1000:
            discrepancias_abonos_vs_proy_hs.append({
                'lote': raw_id,
                'cliente': v['cliente'],
                'abonos_ventas': v['abonos'],
                'total_proy_hs': p['total_pagado_hs'],
                'suma_cuotas': p['suma_cuotas_pagas'],
                'diferencia': diff_ab,
            })

    # 2. Comparar PROYECCIÓN (Columna HS) vs CARTERA TOTAL (Col G: cuotas_pagadas_monto)
    if c and p['saldo_financiado'] > 0:
        diff_cart = abs(p['total_pagado_hs'] - c['cuotas_pagadas_monto'])
        if diff_cart > 1000:
            discrepancias_proy_hs_vs_cartera.append({
                'lote': raw_id,
                'proy_hs': p['total_pagado_hs'],
                'cart_cuotas_pagadas': c['cuotas_pagadas_monto'],
                'diferencia': diff_cart,
            })

    # 3. Comparar PROYECCIÓN vs COBRANZA en número de cuotas pagas
    if cob and p['saldo_financiado'] > 0:
        if p['cuotas_pagas_count'] != cob['cob_pagas']:
            discrepancias_proy_vs_cobranza.append({
                'lote': raw_id,
                'pagas_proyeccion': p['cuotas_pagas_count'],
                'pagas_cobranza': cob['cob_pagas'],
                'vencidas_proy': p['cuotas_vencidas_count'],
                'vencidas_cob': cob['cob_vencidas'],
            })

    # 4. Revisar cuotas con inconsistencias de fecha o valor
    for cq in p['cuotas']:
        if cq['is_paga'] and not cq['f_pago']:
            cuotas_sin_fecha_pago_pero_pagas.append({
                'lote': raw_id,
                'cuota': cq['n'],
                'valor': cq['valor'],
                'estado': cq['estado'],
            })
        if cq['f_pago'] and not cq['is_paga']:
            cuotas_con_fecha_pago_pero_no_pagas.append({
                'lote': raw_id,
                'cuota': cq['n'],
                'f_pago': cq['f_pago'],
                'valor': cq['valor'],
                'estado': cq['estado'],
            })

print("\n" + "="*70)
print("  RESULTADOS DE LA RECONCILIACIÓN DE CUOTAS Y COBRANZA")
print("="*70)
print(f"• 1. Discrepancia VENTAS.abonos vs PROYECCIÓN (Total Pagado): {len(discrepancias_abonos_vs_proy_hs)} casos")
print(f"• 2. Discrepancia PROYECCIÓN vs CARTERA TOTAL (Cuotas Pagadas): {len(discrepancias_proy_hs_vs_cartera)} casos")
print(f"• 3. Discrepancia PROYECCIÓN vs COBRANZA (Número de cuotas pagas): {len(discrepancias_proy_vs_cobranza)} casos")
print(f"• 4. Cuotas marcadas como PAGAS pero sin fecha de pago registrada: {len(cuotas_sin_fecha_pago_pero_pagas)} cuotas")
print(f"• 5. Cuotas con fecha de pago pero no marcadas como pagas: {len(cuotas_con_fecha_pago_pero_no_pagas)} cuotas")
