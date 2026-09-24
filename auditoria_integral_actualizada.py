"""
Auditoría integral de TODA la base de datos actualizada (04-sep-2026)
Detecta discrepancias entre hojas, saldos negativos, fórmulas rotas y casos especiales
"""
import openpyxl, sys, re
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
wb = openpyxl.load_workbook(FILE, data_only=True)

ws_l = wb['LISTADO']
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

col_hs = openpyxl.utils.column_index_from_string('HS')

# Cargar todas las hojas
listado = {}
for r in ws_l.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    raw = clean_str(r[3])
    if not raw or raw == 'ID LOTE': continue
    listado[norm(raw)] = {'raw': raw, 'estado': clean_str(r[11]), 'precio': to_num(r[13])}

ventas = {}
for r in ws_v.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    raw = clean_str(r[1])
    if not raw or raw == 'ID LOTE': continue
    ventas[norm(raw)] = {
        'raw': raw, 'estado': clean_str(r[2]), 'precio': to_num(r[3]),
        'inicial': to_num(r[6]), 'sf': to_num(r[9]), 'plazo': int(to_num(r[10])) if to_num(r[10]) else 0,
        'cuota': to_num(r[11]), 'doc': clean_str(r[13]), 'cliente': clean_str(r[14]),
        'vendedor': clean_str(r[18]), 'comision': to_num(r[19]), 'abonos_comision': to_num(r[20])
    }

proy = {}
for r in ws_p.iter_rows(min_row=4, values_only=True):
    if not any(r): continue
    raw = clean_str(r[2])
    if not raw or raw == 'ID LOTE': continue
    hs_val = to_num(r[col_hs - 1]) if col_hs <= len(r) else 0.0
    proy[norm(raw)] = {
        'raw': raw, 'estado': clean_str(r[3]), 'precio': to_num(r[4]),
        'sf': to_num(r[5]), 'plazo': int(to_num(r[7])) if to_num(r[7]) else 0,
        'cuota': to_num(r[9]), 'total_pagado': hs_val
    }

cartera = {}
for r in ws_cart.iter_rows(min_row=3, values_only=True):
    if not any(r): continue
    raw = clean_str(r[2])
    if not raw or raw == 'ID LOTE': continue
    cartera[norm(raw)] = {
        'raw': raw, 'estado': clean_str(r[3]), 'precio': to_num(r[4]),
        'inicial': to_num(r[5]), 'sf': to_num(r[6]), 'cuotas_pagadas': to_num(r[7]),
        'total_pagado': to_num(r[8]), 'saldo': to_num(r[9])
    }

print(f"Total registros cargados: LISTADO={len(listado)}, VENTAS={len(ventas)}, PROYECCIÓN={len(proy)}, CARTERA TOTAL={len(cartera)}")

# ── AUDITORÍA COMPLETA ──
errores_estado = []
errores_precio = []
errores_descuadre_financiero = []
errores_saldo_negativo = []
errores_proy_vs_cartera = []
casos_sin_cliente_con_pagos = []
casos_contado_con_cuotas = []

for k, v in ventas.items():
    l = listado.get(k)
    p = proy.get(k)
    c = cartera.get(k)
    raw = v['raw']

    # 1. Estados entre LISTADO y VENTAS
    if l and l['estado'] != v['estado']:
        errores_estado.append(f"{raw}: LISTADO='{l['estado']}' vs VENTAS='{v['estado']}'")

    # 2. Precios entre LISTADO y VENTAS
    if l and abs(l['precio'] - v['precio']) > 1 and v['estado'] == 'VENDIDO':
        errores_precio.append(f"{raw}: LISTADO=${l['precio']:,.0f} vs VENTAS=${v['precio']:,.0f}")

    # 3. Descuadre financiero en VENTAS (Precio != Inicial + Financiado)
    if v['precio'] > 0 and v['inicial'] > 0 and v['sf'] > 0:
        dif_vf = abs(v['precio'] - (v['inicial'] + v['sf']))
        if dif_vf > 100:
            errores_descuadre_financiero.append(f"{raw}: Precio(${v['precio']:,.0f}) != Inicial(${v['inicial']:,.0f}) + SF(${v['sf']:,.0f}) | Dif=${dif_vf:,.0f}")

    # 4. Saldos negativos en CARTERA TOTAL (Total Pagado > Precio Venta)
    if c and c['saldo'] < -1000:
        errores_saldo_negativo.append({
            'lote': raw, 'cliente': v.get('cliente'), 'estado': c['estado'],
            'venta': c['precio'], 'inicial': c['inicial'], 'cuotas_pagadas': c['cuotas_pagadas'],
            'total_pagado': c['total_pagado'], 'saldo': c['saldo']
        })

    # 5. Proyección vs Cartera Total (Cuotas pagadas)
    if p and c:
        dif_pc = abs(p['total_pagado'] - c['cuotas_pagadas'])
        if dif_pc > 1000:
            errores_proy_vs_cartera.append(f"{raw}: PROY=${p['total_pagado']:,.0f} vs CARTERA=${c['cuotas_pagadas']:,.0f}")

    # 6. Pagos registrados pero sin cliente
    if p and p['total_pagado'] > 0 and not v.get('cliente'):
        casos_sin_cliente_con_pagos.append({
            'lote': raw, 'estado': v['estado'], 'pagado': p['total_pagado']
        })

    # 7. Marcado como contado (inicial = precio o SF=0) pero con cuotas pagadas
    if v['estado'] == 'VENDIDO' and v['sf'] == 0 and v['inicial'] > 0 and p and p['total_pagado'] > 0:
        casos_contado_con_cuotas.append({
            'lote': raw, 'cliente': v.get('cliente'), 'precio': v['precio'],
            'inicial': v['inicial'], 'cuotas_pagadas': p['total_pagado']
        })

print("\n" + "="*70)
print("  REPORTE COMPLETO DE CONSISTENCIA Y DISCREPANCIAS")
print("="*70)
print(f"1. Discrepancias de Estado (LISTADO vs VENTAS):        {len(errores_estado)} casos")
print(f"2. Discrepancias de Precio Venta (LISTADO vs VENTAS):  {len(errores_precio)} casos")
print(f"3. Descuadres Financieros (Precio != Inicial + SF):   {len(errores_descuadre_financiero)} casos")
print(f"4. Discrepancias PROYECCIÓN vs CARTERA TOTAL:          {len(errores_proy_vs_cartera)} casos")
print(f"5. Casos con Saldo Negativo (sobrepagados en fórmula):{len(errores_saldo_negativo)} casos")
print(f"6. Lotes con pagos pero sin cliente registrado:       {len(casos_sin_cliente_con_pagos)} casos")
print(f"7. Lotes de Contado pero con Cuotas en Proyección:    {len(casos_contado_con_cuotas)} casos")

if errores_descuadre_financiero:
    print("\n--- DETALLE DESCUADRES FINANCIEROS EN VENTAS ---")
    for e in errores_descuadre_financiero: print("•", e)

if errores_saldo_negativo:
    print("\n--- DETALLE SALDOS NEGATIVOS EN CARTERA TOTAL ---")
    for s in errores_saldo_negativo:
        print(f"• {s['lote']:<16} | Cliente: {(s['cliente'] or '— SIN CLIENTE —')[:25]:<25} | Venta: ${s['venta']:>10,.0f} | Inicial: ${s['inicial']:>10,.0f} | Cuotas: ${s['cuotas_pagadas']:>10,.0f} | Saldo: ${s['saldo']:>11,.0f}")

if casos_sin_cliente_con_pagos:
    print("\n--- DETALLE PAGOS SIN CLIENTE ---")
    for cp in casos_sin_cliente_con_pagos:
        print(f"• {cp['lote']:<16} | Estado: {cp['estado']:<16} | Total Pagado: ${cp['pagado']:>10,.0f}")

if casos_contado_con_cuotas:
    print("\n--- DETALLE CONTADO CON CUOTAS EN PROYECCIÓN ---")
    for cc in casos_contado_con_cuotas:
        print(f"• {cc['lote']:<16} | Cliente: {(cc['cliente'] or '—')[:25]:<25} | Precio: ${cc['precio']:>10,.0f} | Inicial: ${cc['inicial']:>10,.0f} | Cuotas Proy: ${cc['cuotas_pagadas']:>10,.0f}")
