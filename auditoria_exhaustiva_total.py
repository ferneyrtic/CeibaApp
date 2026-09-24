"""
AUDITORÍA EXHAUSTIVA MAESTRA - 04-SEP-2026 15:12
Revisa ABSOLUTAMENTE TODO: cada fila, cada columna, cada cuota, cada cruce entre hojas.
"""
import openpyxl, sys, re, calendar
from datetime import datetime, date

sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
print(f"Cargando {FILE}...")
wb_d = openpyxl.load_workbook(FILE, data_only=True)
wb_f = openpyxl.load_workbook(FILE, data_only=False)

ws_l   = wb_d['LISTADO']
ws_v   = wb_d['VENTAS']
ws_vf  = wb_f['VENTAS']
p_name = [s for s in wb_d.sheetnames if 'PROY' in s.upper()][0]
ws_p   = wb_d[p_name]
ws_cart= wb_d['CARTERA TOTAL']

def to_num(val):
    if val is None: return 0.0
    try:
        if isinstance(val, (int, float)): return float(val)
        s = str(val).replace('$','').replace(',','').strip()
        if s.startswith('#') or s in ('','None','nan'): return 0.0
        return float(s)
    except: return 0.0

def clean(val):
    if val is None: return None
    s = str(val).strip()
    return s if s and s.lower() not in ('none','nan','') else None

def norm(val):
    if not val: return ''
    s = str(val).strip().upper()
    return re.sub(r'\s+', ' ', s).replace(' - ','-').replace(' -','-').replace('- ','-')

col_hs = openpyxl.utils.column_index_from_string('HS')

# ══════════════════════════════════════════════════════════════
# PASO 1: CARGAR Y NORMALIZAR TODOS LOS DATOS
# ══════════════════════════════════════════════════════════════
listado = {}
for idx, r in enumerate(ws_l.iter_rows(min_row=3, values_only=True), 3):
    if not any(r): continue
    raw = clean(r[3])
    if not raw or raw == 'ID LOTE': continue
    k = norm(raw)
    listado[k] = {'fila': idx, 'raw': raw, 'estado': clean(r[11]) or 'DISPONIBLE',
                  'precio_lote': to_num(r[10]), 'precio_venta': to_num(r[13])}

ventas = {}
div_errors_in_ventas = []
for idx, r in enumerate(ws_v.iter_rows(min_row=3, values_only=True), 3):
    if not any(r): continue
    raw = clean(r[1])
    if not raw or raw == 'ID LOTE': continue
    k = norm(raw)
    
    estado  = clean(r[2]) or 'DISPONIBLE'
    pv      = to_num(r[3])
    ci      = to_num(r[6])
    sf      = to_num(r[9])
    plazo_r = ws_vf.cell(idx, 11).value
    cuota_r = ws_vf.cell(idx, 12).value
    plazo   = to_num(plazo_r)
    cuota   = to_num(cuota_r)
    doc     = clean(r[13])
    if doc and doc.endswith('.0'): doc = doc[:-2]
    cli     = clean(r[14])
    vend    = clean(r[18])
    com     = to_num(r[19])
    abo     = to_num(r[20])
    desc    = to_num(r[21])
    
    is_div_cuota  = str(cuota_r).startswith('#DIV') if cuota_r else False
    is_div_plazo  = str(plazo_r).startswith('#DIV') if plazo_r else False
    
    es_vendido   = estado == 'VENDIDO'
    es_cedido    = 'CEDIDO' in estado.upper()
    es_contado   = es_vendido and ci > 0 and sf == 0
    es_financiado= (sf > 0) and (es_vendido or es_cedido)
    
    ventas[k] = {
        'fila': idx, 'raw': raw, 'estado': estado, 'pv': pv,
        'ci': ci, 'sf': sf, 'plazo': int(plazo) if plazo else 0,
        'cuota': cuota, 'doc': doc, 'cli': cli, 'vend': vend,
        'com': com, 'abo': abo, 'desc': desc,
        'es_contado': es_contado, 'es_financiado': es_financiado,
        'is_div_cuota': is_div_cuota, 'is_div_plazo': is_div_plazo,
    }
    
    if (is_div_cuota or is_div_plazo) and es_vendido and not es_contado:
        div_errors_in_ventas.append((idx, raw, cli, estado, str(cuota_r)))

proy = {}
cuotas_raw = {}
for idx, r in enumerate(ws_p.iter_rows(min_row=4, values_only=True), 4):
    if not any(r): continue
    raw = clean(r[2])
    if not raw or raw == 'ID LOTE': continue
    k = norm(raw)
    hs_val = to_num(r[col_hs - 1]) if col_hs <= len(r) else 0.0
    
    pagadas = 0; pagas_sum = 0.0
    vencidas = 0; aldia = 0; total_cuotas_registradas = 0
    cuotas_list = []
    
    for n in range(1, 37):
        cs = 10 + (n - 1) * 6
        if cs >= len(r): break
        fv  = r[cs]
        fp  = r[cs + 2]
        vc  = to_num(r[cs + 3])
        est = clean(r[cs + 4])
        mp  = clean(r[cs + 5])
        
        if not fv and not fp and vc <= 0 and not est:
            continue
        total_cuotas_registradas += 1
        is_pag = bool(fp and vc > 0) or (est and 'PAG' in est.upper())
        
        if is_pag:
            pagadas += 1
            pagas_sum += vc
        elif est and 'VENC' in est.upper():
            vencidas += 1
        else:
            aldia += 1
        
        cuotas_list.append({
            'n': n, 'fv': str(fv)[:10] if fv else None,
            'fp': str(fp)[:10] if fp else None,
            'vc': vc, 'est': est, 'mp': mp, 'is_pag': is_pag
        })
    
    proy[k] = {
        'fila': idx, 'raw': raw, 'estado': clean(r[3]),
        'pv': to_num(r[4]), 'sf': to_num(r[5]),
        'plazo': int(to_num(r[7])) if to_num(r[7]) else 0,
        'cuota': to_num(r[9]), 'hs_total': hs_val,
        'pagadas': pagadas, 'pagas_sum': pagas_sum,
        'vencidas': vencidas, 'aldia': aldia,
        'total_cuotas': total_cuotas_registradas,
        'cuotas': cuotas_list
    }

cartera = {}
for idx, r in enumerate(ws_cart.iter_rows(min_row=3, values_only=True), 3):
    if not any(r): continue
    raw = clean(r[2])
    if not raw or raw == 'ID LOTE': continue
    k = norm(raw)
    cartera[k] = {
        'fila': idx, 'raw': raw, 'precio': to_num(r[4]),
        'ci': to_num(r[5]), 'sf': to_num(r[6]),
        'cuotas_pag': to_num(r[7]), 'total_pag': to_num(r[8]),
        'saldo': to_num(r[9])
    }

print(f"✓ Datos cargados: LISTADO={len(listado)}, VENTAS={len(ventas)}, PROYECCIÓN={len(proy)}, CARTERA={len(cartera)}")

# ══════════════════════════════════════════════════════════════
# PASO 2: PRUEBAS EXHAUSTIVAS
# ══════════════════════════════════════════════════════════════

E = []  # Errores reales — deben corregirse
A = []  # Alertas informativas — ya explicadas o aceptadas por negocio

# -- 2.1 Estados cruzados LISTADO vs VENTAS
for k, v in ventas.items():
    l = listado.get(k)
    if l and l['estado'] != v['estado']:
        E.append(f"[ESTADO] Fila {v['fila']}: {v['raw']} → LISTADO='{l['estado']}' vs VENTAS='{v['estado']}'")

# -- 2.2 Precio de venta LISTADO vs VENTAS (solo para VENDIDOS, ignorando casos de negocio ya explicados)
casos_negocio_precio_ok = {
    norm('LC2 - 43 - 4 Y 5'), norm('LC2 - 43 - 4'), norm('LC2 - 43 - 5'),
    norm('LC1 - 20 - 3'),  # descuento asumido por asesor
}
for k, v in ventas.items():
    if k in casos_negocio_precio_ok: continue
    l = listado.get(k)
    if l and v['estado'] == 'VENDIDO' and abs(l['precio_venta'] - v['pv']) > 1000:
        A.append(f"[PRECIO_DIF] Fila {v['fila']}: {v['raw']} ({v['cli'] or '—'}) → LISTADO=${l['precio_venta']:,.0f} vs VENTAS=${v['pv']:,.0f}")

# -- 2.3 Descuadre financiero: Precio ≠ Inicial + Financiado
for k, v in ventas.items():
    if v['pv'] > 0 and v['ci'] > 0 and v['sf'] > 0:
        dif = abs(v['pv'] - (v['ci'] + v['sf']))
        if dif > 500:
            E.append(f"[DESCUADRE_FIN] Fila {v['fila']}: {v['raw']} ({v['cli']}) → PV=${v['pv']:,.0f} ≠ CI=${v['ci']:,.0f} + SF=${v['sf']:,.0f} | Dif=${dif:,.0f}")

# -- 2.4 Cuota mensual descuadrada vs Saldo Financiado / Plazo
for k, v in ventas.items():
    if v['es_financiado'] and v['plazo'] > 0 and v['cuota'] > 0 and not v['is_div_cuota']:
        total_cuotas_calc = v['cuota'] * v['plazo']
        dif = abs(total_cuotas_calc - v['sf'])
        pct = (dif / v['sf']) if v['sf'] > 0 else 0
        if dif > 500000 and pct > 0.02:  # >2% de tolerancia
            E.append(f"[CUOTA_DESCUADRE] Fila {v['fila']}: {v['raw']} ({v['cli']}) → Cuota(${v['cuota']:,.0f} × {v['plazo']}) = ${total_cuotas_calc:,.0f} vs SF=${v['sf']:,.0f} | Dif=${dif:,.0f}")

# -- 2.5 Vendidos financiados sin cédula (excluyendo casos de negocio conocidos)
casos_sin_cedula_ok = {norm('LC2 - 27 - 12')}  # pendiente de asignación de titular
for k, v in ventas.items():
    if k in casos_sin_cedula_ok: continue
    if v['es_financiado'] and not v['doc']:
        E.append(f"[SIN_CEDULA] Fila {v['fila']}: {v['raw']} ({v['cli'] or '—SIN NOMBRE—'}) → Vendido financiado sin cédula")

# -- 2.6 Vendidos financiados sin nombre de cliente
for k, v in ventas.items():
    if k in casos_sin_cedula_ok: continue
    if v['estado'] == 'VENDIDO' and not v['cli'] and 'CEDIDO' not in v['estado'].upper():
        E.append(f"[SIN_NOMBRE] Fila {v['fila']}: {v['raw']} → Vendido sin nombre de cliente")

# -- 2.7 #DIV/0! en ventas VENDIDAS y financiadas (excluyendo disponibles y contado)
for d in div_errors_in_ventas:
    E.append(f"[DIV_ZERO] Fila {d[0]}: {d[1]} ({d[2]}) → Error #DIV/0! en cuota (Plazo vacío, estado={d[3]})")

# -- 2.8 Diferencia PROYECCIÓN (Col HS) vs CARTERA TOTAL
for k, p in proy.items():
    c = cartera.get(k)
    if c and abs(p['hs_total'] - c['cuotas_pag']) > 1000:
        E.append(f"[PROY_vs_CART] Fila {p['fila']}: {p['raw']} → PROY HS=${p['hs_total']:,.0f} vs CARTERA=${c['cuotas_pag']:,.0f}")

# -- 2.9 Saldos negativos reales (sobrepagados) – excluyendo casos de negocio
casos_saldo_negativo_ok = {
    norm('LC2 - 28 - 2'), norm('LC2 - 28 - 3'),  # dinero en tránsito
    norm('LC1 - 20 - 3'),  # descuento asesor
}
for k, c in cartera.items():
    if k in casos_saldo_negativo_ok: continue
    if c['saldo'] < -1000:
        v = ventas.get(k)
        E.append(f"[SALDO_NEGATIVO] Fila {c['fila']}: {c['raw']} ({(v.get('cli') if v else '') or '—'}) → Saldo=${c['saldo']:,.0f}")

# -- 2.10 Pagos registrados en PROYECCIÓN para lotes DISPONIBLES/EN NEGOCIACIÓN
casos_dinero_transito = {norm('LC2 - 28 - 2'), norm('LC2 - 28 - 3')}
for k, p in proy.items():
    if k in casos_dinero_transito: continue
    v = ventas.get(k)
    if v and v['estado'] in ('DISPONIBLE', 'EN NEGOCIACIÓN') and p['hs_total'] > 0:
        A.append(f"[PAGO_HUERFANO] Fila {p['fila']}: {p['raw']} → Estado={v['estado']}, Pagado=${p['hs_total']:,.0f}")

# -- 2.11 Cuotas en proyección con valor = 0 pero marcadas como PAGADA
for k, p in proy.items():
    for cq in p['cuotas']:
        if cq['is_pag'] and cq['vc'] <= 0 and not cq['fp']:
            A.append(f"[CUOTA_PAGA_SIN_VALOR] {p['raw']} C{cq['n']}: Marcada PAGA pero valor=$0 y sin fecha de pago")

# -- 2.12 Cuota con fecha de pago en el futuro (probable error de digitación de año)
hoy = '2026-09-04'
for k, p in proy.items():
    for cq in p['cuotas']:
        if cq['fp'] and cq['fp'] > '2026-12-31' and cq['is_pag']:
            A.append(f"[FECHA_FUTURA] {p['raw']} C{cq['n']}: Fecha de pago futura {cq['fp']} (¿error de año?)")

# -- 2.13 Estado entre VENTAS y PROYECCIÓN
for k, v in ventas.items():
    p = proy.get(k)
    if p and p['estado'] and v['estado'] != p['estado']:
        A.append(f"[ESTADO_PROY] Fila {v['fila']}: {v['raw']} → VENTAS='{v['estado']}' vs PROYECCIÓN='{p['estado']}'")

# -- 2.14 Comisión de vendedor sin vendedor asignado (solo para lotes financiados)
for k, v in ventas.items():
    if v['es_financiado'] and v['com'] > 0 and not v['vend']:
        A.append(f"[COM_SIN_VEND] Fila {v['fila']}: {v['raw']} → Comisión=${v['com']:,.0f} pero sin vendedor")

# ══════════════════════════════════════════════════════════════
# PASO 3: TOTALES CONSOLIDADOS PARA CARTERA PROPIA
# ══════════════════════════════════════════════════════════════
total_pv = sum(v['pv'] for v in ventas.values() if v['estado'] == 'VENDIDO')
total_ci = sum(v['ci'] for v in ventas.values() if v['estado'] == 'VENDIDO')
total_sf = sum(v['sf'] for v in ventas.values() if v['estado'] == 'VENDIDO')
total_cuotas_pag = sum(p['pagas_sum'] for p in proy.values())
total_vencidas_c = sum(p['vencidas'] for p in proy.values())
total_pagadas_c  = sum(p['pagadas'] for p in proy.values())

lotes_vendidos   = sum(1 for v in ventas.values() if v['estado'] == 'VENDIDO')
lotes_financiados= sum(1 for v in ventas.values() if v['es_financiado'])
lotes_contado    = sum(1 for v in ventas.values() if v['es_contado'])
lotes_disponibles= sum(1 for v in ventas.values() if v['estado'] == 'DISPONIBLE')
lotes_negociacion= sum(1 for v in ventas.values() if v['estado'] == 'EN NEGOCIACIÓN')
lotes_cedidos    = sum(1 for v in ventas.values() if 'CEDIDO' in v['estado'].upper())
lotes_no_apto    = sum(1 for v in ventas.values() if 'NO APTO' in v['estado'].upper())

# ══════════════════════════════════════════════════════════════
# PASO 4: IMPRIMIR REPORTE
# ══════════════════════════════════════════════════════════════
SEP = "="*72
sep = "-"*72

print("\n" + SEP)
print("  ✦  AUDITORÍA EXHAUSTIVA — RESULTADO FINAL  ✦")
print(SEP)

print(f"\n{'ERRORES REALES (requieren corrección antes del cargue)':>60}")
print(f"  TOTAL ERRORES: {len(E)}")
if E:
    for e in E: print(f"  ❌ {e}")
else:
    print("  ✅ NO HAY ERRORES REALES EN LA BASE DE DATOS.")

print(f"\n{'ALERTAS INFORMATIVAS (ya documentadas, no bloquean el cargue)':>60}")
print(f"  TOTAL ALERTAS: {len(A)}")
if A:
    for a in A: print(f"  ⚠️  {a}")

print("\n" + sep)
print("  INVENTARIO DE LOTES (511 total)")
print(sep)
print(f"  ✔ VENDIDOS:            {lotes_vendidos:>4} ({lotes_financiados} financiados, {lotes_contado} de contado, {lotes_cedidos} cedidos)")
print(f"  ◻ DISPONIBLES:         {lotes_disponibles:>4}")
print(f"  ≈ EN NEGOCIACIÓN:      {lotes_negociacion:>4}")
print(f"  ✖ NO APTOS PARA VENTA: {lotes_no_apto:>4}")

print("\n" + sep)
print("  CONSOLIDADO FINANCIERO — BASE PARA CARTERA TOTAL PROPIA")
print(sep)
print(f"  Total Valor Ventas:        ${total_pv:>16,.0f}")
print(f"  Total Cuotas Iniciales:    ${total_ci:>16,.0f}")
print(f"  Total Saldo Financiado:    ${total_sf:>16,.0f}")
print(f"  ─────────────────────────────────────────────────────")
print(f"  Total Cuotas Pagadas:      ${total_cuotas_pag:>16,.0f}")
print(f"  Total Recaudo (CI+Cuotas): ${total_ci + total_cuotas_pag:>16,.0f}")
print(f"  Saldo Pendiente Clientes:  ${total_sf - total_cuotas_pag:>16,.0f}")
print(f"  ─────────────────────────────────────────────────────")
print(f"  Total Cuotas Registradas:  {total_pagadas_c + total_vencidas_c:>16,}")
print(f"  Cuotas Pagadas:            {total_pagadas_c:>16,}")
print(f"  Cuotas Vencidas (en mora): {total_vencidas_c:>16,}")

print("\n" + sep)
print("  VEREDCITO")
print(sep)
if len(E) == 0:
    print("  🟢 LUZ VERDE: Base de datos verificada y aprobada para cargue al sistema.")
    print(f"     {len(A)} alertas informativas documentadas no bloquean la migración.")
else:
    print(f"  🔴 LUZ ROJA: {len(E)} errores deben corregirse antes del cargue.")
print(SEP)
