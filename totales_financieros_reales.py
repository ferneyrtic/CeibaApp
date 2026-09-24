"""
Auditoría completa de totales financieros entre PROYECCIÓN y CARTERA TOTAL
"""
import openpyxl, sys
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
wb = openpyxl.load_workbook(FILE, data_only=True)
ws_p = wb['PROYECCIÓN']
ws_cart = wb['CARTERA TOTAL']

def to_num(val):
    if val is None: return 0.0
    try:
        if isinstance(val, (int, float)): return float(val)
        s = str(val).replace('$','').replace(',','').strip()
        if s.startswith('#') or s in ('','None','nan'): return 0.0
        return float(s)
    except: return 0.0

# 1. Totales de CARTERA TOTAL
total_venta_cart = 0.0
total_inicial_cart = 0.0
total_financiado_cart = 0.0
total_cuotas_pagas_cart = 0.0
total_recaudo_cart = 0.0
total_saldo_cart = 0.0

for r in ws_cart.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    pv = to_num(r[4])
    ci = to_num(r[5])
    sf = to_num(r[6])
    cp = to_num(r[7])
    tp = to_num(r[8])
    sal = to_num(r[9])

    total_venta_cart += pv
    total_inicial_cart += ci
    total_financiado_cart += sf
    total_cuotas_pagas_cart += cp
    total_recaudo_cart += tp
    total_saldo_cart += sal

# 2. Totales de PROYECCIÓN
col_hs = openpyxl.utils.column_index_from_string('HS')
total_hs_proy = 0.0
total_cuotas_contadas = 0
total_pagadas_contadas = 0
total_vencidas_contadas = 0
total_al_dia_contadas = 0

for r in ws_p.iter_rows(min_row=4, values_only=True):
    if not any(r): continue
    hs = to_num(r[col_hs - 1]) if col_hs <= len(r) else 0.0
    total_hs_proy += hs

    for n in range(1, 37):
        c_start = 10 + (n - 1) * 6
        if c_start >= len(r): break
        f_v = r[c_start]
        f_p = r[c_start + 2]
        v_c = to_num(r[c_start + 3])
        est = str(r[c_start + 4]).strip().upper() if r[c_start + 4] else ''

        if not f_v and v_c <= 0 and not est: break

        total_cuotas_contadas += 1
        if 'PAG' in est or (f_p and v_c > 0):
            total_pagadas_contadas += 1
        elif 'VENC' in est:
            total_vencidas_contadas += 1
        else:
            total_al_dia_contadas += 1

print("================================================================")
print("  TOTALES FINANCIEROS CONSOLIDADOS (CARTERA TOTAL vs PROYECCIÓN)")
print("================================================================")
print(f"• Total Valor de Venta (Cartera Total):      ${total_venta_cart:>16,.0f}")
print(f"• Total Cuotas Iniciales (Cartera Total):   ${total_inicial_cart:>16,.0f}")
print(f"• Total Saldo Financiado (Cartera Total):    ${total_financiado_cart:>16,.0f}")
print(f"• Total Cuotas Pagadas (Cartera Total Col G):${total_cuotas_pagas_cart:>16,.0f}")
print(f"• Total Cuotas Pagadas (PROYECCIÓN Col HS):  ${total_hs_proy:>16,.0f}")
print(f"• Diferencia PROYECCIÓN vs CARTERA TOTAL:    ${abs(total_hs_proy - total_cuotas_pagas_cart):>16,.0f}")
print(f"• Total Recaudo Real (Inicial + Cuotas):     ${total_recaudo_cart:>16,.0f}")
print(f"• Saldo Pendiente por Cobrar a Clientes:     ${total_saldo_cart:>16,.0f}")
print("----------------------------------------------------------------")
print(f"• Total Cuotas individuales proyectadas:      {total_cuotas_contadas:>16,}")
print(f"• Cuotas Pagadas registradas:                 {total_pagadas_contadas:>16,}")
print(f"• Cuotas Vencidas en mora:                    {total_vencidas_contadas:>16,}")
print(f"• Cuotas Al Día / Futuras:                    {total_al_dia_contadas:>16,}")
