"""
Sincronización Maestra desde Excel Local hacia Google Sheets:
1. LISTADO: Actualiza precios, estados y contratos cambiados.
2. VENTAS: Actualiza las 15 filas con nuevas ventas, clientes, asesores y estados.
3. PROYECCIÓN: 
   - Configura nuevos contratos con sus fórmulas de fechas y estados (LC1-7-7, LC2-28-2, LC2-39-7).
   - Actualiza pagos recientes (octubre 2026) y abonos amortizados (LC2-42-7 con abono de $6M).
   - Preserva y aplica las fórmulas inteligentes de ESTADO CUOTA.
"""
import openpyxl, gspread, re, sys, time, calendar
from datetime import datetime, date
from google.oauth2.service_account import Credentials

sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
SPREADSHEET_ID = '1H7u5aiE3m8GPcGp0zN4D_DzcyCMph6hmvIt22i0FYsA'
CREDENTIALS_FILE = 'service_account.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
gc = gspread.authorize(creds)
sh = gc.open_by_key(SPREADSHEET_ID)

print("=" * 64)
print("  🚀 SINCRONIZACIÓN EXCEL LOCAL -> GOOGLE SHEETS EN LÍNEA")
print("=" * 64)

wb = openpyxl.load_workbook(FILE, data_only=True)
wb_formula = openpyxl.load_workbook(FILE, data_only=False)

ws_l_loc = wb['LISTADO']
ws_v_loc = wb['VENTAS']
ws_p_loc = wb['PROYECCIÓN']
ws_p_form = wb_formula['PROYECCIÓN']

def col_letter(n):
    result = ""
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        result = chr(65 + remainder) + result
    return result

def fmt_cop(val):
    if val is None or val == '': return ''
    try:
        f = float(str(val).replace('$','').replace(' ','').strip())
        if f == 0: return '$  0'
        return f"$  {f:,.0f}".replace(',', '.')
    except:
        return str(val)

def fmt_date(val):
    if val is None or val == '': return ''
    if isinstance(val, (datetime, date)):
        return f"{val.day}/{val.month}/{val.year}"
    s = str(val).split('T')[0].split(' ')[0].strip()
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})', s)
    if m:
        return f"{int(m.group(3))}/{int(m.group(2))}/{int(m.group(1))}"
    return str(val)

# ════════════════════════════════════════════════════════════
# 1. ACTUALIZAR LISTADO
# ════════════════════════════════════════════════════════════
print("\n[1/3] Sincronizando hoja LISTADO...")
ws_l_rem = sh.worksheet('LISTADO')

listado_batch = []
# Rows con cambios de negocio: 52, 111, 213, 260, 328, 391, 408, 506
rows_listado = [52, 111, 213, 260, 328, 391, 408, 506]

for r in rows_listado:
    p_lote = ws_l_loc.cell(r, 11).value
    est = ws_l_loc.cell(r, 12).value
    cont = ws_l_loc.cell(r, 13).value
    p_venta = ws_l_loc.cell(r, 14).value
    
    val_k = fmt_cop(p_lote) if p_lote else ''
    val_l = str(est).strip() if est else ''
    val_m = str(cont).strip() if cont else ''
    val_n = fmt_cop(p_venta) if p_venta else ''
    
    listado_batch.append({
        'range': f'K{r}:N{r}',
        'values': [[val_k, val_l, val_m, val_n]]
    })

ws_l_rem.batch_update(listado_batch, value_input_option='USER_ENTERED')
print(f"  ✓ {len(listado_batch)} filas de LISTADO actualizadas con éxito.")

# ════════════════════════════════════════════════════════════
# 2. ACTUALIZAR VENTAS
# ════════════════════════════════════════════════════════════
print("\n[2/3] Sincronizando hoja VENTAS...")
ws_v_rem = sh.worksheet('VENTAS')

ventas_batch = []
rows_ventas = [34, 52, 111, 213, 229, 258, 260, 310, 319, 328, 349, 391, 408, 456, 506]

for r in rows_ventas:
    row_vals = []
    for c in range(1, 24):
        v = ws_v_loc.cell(r, c).value
        # Si es celda con fórmula (ej. valor cuota dividida), mantener o formatear
        if c in (4, 5, 7, 10, 12, 20, 21, 22, 23): # montos
            row_vals.append(fmt_cop(v) if v is not None and str(v) != '0' else ('$  0' if v == 0 else ''))
        elif c in (6, 8): # fechas
            if '0206' in str(v): v = '2026-05-01'
            row_vals.append(fmt_date(v) if v else '')
        elif c in (11, 14, 16): # numeros / docs / cel
            if v is not None and str(v).endswith('.0'):
                row_vals.append(str(int(float(v))))
            else:
                row_vals.append(str(v) if v is not None else '')
        else:
            row_vals.append(str(v).strip() if v is not None else '')
            
    ventas_batch.append({
        'range': f'A{r}:W{r}',
        'values': [row_vals]
    })

ws_v_rem.batch_update(ventas_batch, value_input_option='USER_ENTERED')
print(f"  ✓ {len(ventas_batch)} filas de VENTAS actualizadas con éxito.")

# ════════════════════════════════════════════════════════════
# 3. ACTUALIZAR PROYECCIÓN
# ════════════════════════════════════════════════════════════
print("\n[3/3] Sincronizando hoja PROYECCIÓN (encabezados, fórmulas de cuotas y pagos)...")
ws_p_rem = sh.worksheet('PROYECCIÓN')

# A. Filas de nuevos contratos y estados cambiados:
# 53 (LC1-7-7), 112 (LC1-13-1), 214 (LC2-23-6), 261 (LC2-28-2), 329 (LC2-33-10), 392 (LC2-38-2), 409 (LC2-39-7), 507 (LC2-47-5)
dias_por_mes = [31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, 31, 28, 31]

proy_batch = []

def generar_formulas_fila(r, plazo, primer_fv_formula, f_ci_formula=None):
    """Genera las fórmulas para FV, Días y Estado Cuota inteligente para la fila r."""
    updates = {}
    if f_ci_formula:
        updates[f'G{r}'] = f_ci_formula
        
    prev_fv = 'K'
    for n in range(1, 37):
        cs = 10 + (n - 1) * 6
        col_fv_let = col_letter(cs + 1)
        col_dias_let = col_letter(cs + 2)
        col_pago_let = col_letter(cs + 3)
        col_val_let = col_letter(cs + 4)
        col_est_let = col_letter(cs + 5)
        
        # Fórmula FV
        if n == 1:
            f_fv = f'=IF(N($H{r})<1;"";{primer_fv_formula})'
        elif n <= plazo:
            days_add = dias_por_mes[(n - 2) % len(dias_por_mes)]
            f_fv = f'=IF(N($H{r})<{n};"";IF({prev_fv}{r}="";"";{prev_fv}{r}+{days_add}))'
        else:
            f_fv = ''
        updates[f'{col_fv_let}{r}'] = f_fv
        
        # Fórmula Días
        f_dias = f'=IF({col_fv_let}{r}="";"";TODAY()-{col_fv_let}{r})' if f_fv else ''
        updates[f'{col_dias_let}{r}'] = f_dias
        
        # Fórmula Estado Inteligente
        if f_fv:
            f_est = f'=IF({col_fv_let}{r}="";"SIN ESTADO";IF(OR({col_pago_let}{r}<>"";AND($J{r}>0;$HS{r}>=({n}*$J{r}-1000)));"PAGA";IF({col_dias_let}{r}>0;"VENCIDA";IF({col_dias_let}{r}>=-5;"POR VENCER";"AL DÍA"))))'
        else:
            f_est = ''
        updates[f'{col_est_let}{r}'] = f_est
        
        if f_fv:
            prev_fv = col_fv_let
            
    return updates

# Fila 53: LC1-7-7 (VENDIDO, Didacio Rincón, $53M, Saldo $43M, 30 cuotas de $1.433.333,33, CI 5/10/2026, 5 de cada mes)
head_53 = ['VENDIDO', '$  53.000.000', '$  43.000.000', '5/10/2026', '30', '5 DE CADA MES', '1433333.333']
proy_batch.append({'range': 'D53:J53', 'values': [head_53]})
f_53 = generar_formulas_fila(53, 30, '$G53+31')
for cell_ref, form_val in f_53.items():
    if form_val: proy_batch.append({'range': cell_ref, 'values': [[form_val]]})

# Fila 214: LC2-23-6 (EN NEGOCIACIÓN)
proy_batch.append({'range': 'D214', 'values': [['EN NEGOCIACIÓN']]})

# Fila 261: LC2-28-2 (VENDIDO, Neyla Ortiz, $33M, Saldo $29M, 24 cuotas de $1.208.300, CI 29/09/2026, 15 de cada mes)
head_261 = ['VENDIDO', '$  33.000.000', '$  29.000.000', '29/9/2026', '24', '15 de cada mes', '1208300']
proy_batch.append({'range': 'D261:J261', 'values': [head_261]})
f_261 = generar_formulas_fila(261, 24, 'DATE(YEAR($G261);MONTH($G261)+1;15)')
for cell_ref, form_val in f_261.items():
    if form_val: proy_batch.append({'range': cell_ref, 'values': [[form_val]]})

# Fila 329: LC2-33-10 (EN NEGOCIACIÓN, $38M) - Limpiar pagos
head_329 = ['EN NEGOCIACIÓN', '$  38.000.000', '$  38.000.000', '', '', '', '']
proy_batch.append({'range': 'D329:J329', 'values': [head_329]})
# Limpiar celdas de pagos para fila 329
for n in range(1, 37):
    cs = 10 + (n - 1) * 6
    col_fp_let = col_letter(cs + 3)
    col_val_let = col_letter(cs + 4)
    col_mp_let = col_letter(cs + 6)
    proy_batch.append({'range': f'{col_fp_let}329:{col_mp_let}329', 'values': [['', '', '', '']]})

# Fila 392: LC2-38-2 (EN NEGOCIACIÓN)
proy_batch.append({'range': 'D392', 'values': [['EN NEGOCIACIÓN']]})

# Fila 409: LC2-39-7 (VENDIDO, Marco Fidel Perez, $28M, Saldo $24M, 24 cuotas de $1.000.000, CI 1/06/2026, 30 de cada mes)
head_409 = ['VENDIDO', '$  28.000.000', '$  24.000.000', '1/6/2026', '24', '30 DE CADA MES', '1000000']
proy_batch.append({'range': 'D409:J409', 'values': [head_409]})
f_409 = generar_formulas_fila(409, 24, '$G409+31')
for cell_ref, form_val in f_409.items():
    if form_val: proy_batch.append({'range': cell_ref, 'values': [[form_val]]})

# Fila 507: LC2-47-5 (DISPONIBLE)
proy_batch.append({'range': 'D507', 'values': [['DISPONIBLE']]})

# B. Sincronizar todos los pagos registrados en el Excel
print("  Indexando y sincronizando todos los pagos registrados...")
# Recorrer filas de PROYECCIÓN en Excel
for r in range(4, ws_p_loc.max_row + 1):
    lote = ws_p_loc.cell(r, 3).value
    if not lote: continue
    
    for n in range(1, 37):
        cs = 10 + (n - 1) * 6
        fp_raw = ws_p_loc.cell(r, cs + 3).value
        vc_raw = ws_p_loc.cell(r, cs + 4).value
        mp_raw = ws_p_loc.cell(r, cs + 6).value
        
        # Si hay pago registrado en esta cuota
        if fp_raw or vc_raw:
            col_fp_let = col_letter(cs + 3)
            col_vc_let = col_letter(cs + 4)
            col_mp_let = col_letter(cs + 6)
            
            val_fp = fmt_date(fp_raw)
            try:
                val_vc = float(str(vc_raw).replace('$','').replace(' ','').strip()) if vc_raw else ''
            except:
                val_vc = ''
            val_mp = str(mp_raw).strip() if mp_raw else ''
            
            proy_batch.append({
                'range': f'{col_fp_let}{r}',
                'values': [[val_fp]]
            })
            if val_vc != '':
                proy_batch.append({
                    'range': f'{col_vc_let}{r}',
                    'values': [[val_vc]]
                })
            if val_mp:
                proy_batch.append({
                    'range': f'{col_mp_let}{r}',
                    'values': [[val_mp]]
                })

print(f"  Total operaciones preparadas para PROYECCIÓN: {len(proy_batch)}")

# Enviar en bloques de 500 para evitar timeout y rate limits
CHUNK_SIZE = 400
for i in range(0, len(proy_batch), CHUNK_SIZE):
    chunk = proy_batch[i:i + CHUNK_SIZE]
    ws_p_rem.batch_update(chunk, value_input_option='USER_ENTERED')
    print(f"    ✓ Bloque {i // CHUNK_SIZE + 1}/{(len(proy_batch) - 1) // CHUNK_SIZE + 1} enviado ({len(chunk)} rangos)...")
    time.sleep(1.5)

print("\n" + "=" * 64)
print("  🎉 ¡GOOGLE SHEETS COMPLETAMENTE ACTUALIZADO Y SINCRONIZADO!")
print("=" * 64)
