import openpyxl, gspread, sys
from google.oauth2.service_account import Credentials

sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión.xlsx'
SPREADSHEET_ID = '1H7u5aiE3m8GPcGp0zN4D_DzcyCMph6hmvIt22i0FYsA'
CREDENTIALS_FILE = 'service_account.json'

print("=== 1. ACTUALIZANDO GOOGLE SHEETS ===")
creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=['https://www.googleapis.com/auth/spreadsheets'])
gc = gspread.authorize(creds)
sh = gc.open_by_key(SPREADSHEET_ID)

ws_v = sh.worksheet('VENTAS')
ws_p = sh.worksheet('PROYECCIÓN')

# VENTAS row 185
print("Actualizando días de pago en VENTAS (fila 185)...")
ws_v.update_cell(185, 13, '05 DE CADA MES')

# PROYECCIÓN row 186
print("Actualizando días de pago en PROYECCIÓN (fila 186)...")
ws_p.update_cell(186, 9, '05 DE CADA MES')

# Compute updates for the 24 cuotas in row 186 of PROYECCIÓN
updates = []
# Cuota 1: Col 11 (K)
updates.append({
    'range': 'K186',
    'values': [['=DATE(2026;11;5)']]
})

prev_col = 'K'
for i in range(2, 25):
    col_idx = 11 + (i - 1) * 6
    col_letter = openpyxl.utils.get_column_letter(col_idx)
    formula = f'=IF(N($H186)<{i};"";EDATE({prev_col}186;1))'
    updates.append({
        'range': f'{col_letter}186',
        'values': [[formula]]
    })
    prev_col = col_letter

print(f"Enviando {len(updates)} fórmulas de cuotas a Google Sheets PROYECCIÓN...")
ws_p.batch_update(updates, value_input_option='USER_ENTERED')
print("✓ Google Sheets PROYECCIÓN actualizado con éxito.")

# Verificar valores en Google Sheets
print("\n--- Verificación en Google Sheets PROYECCIÓN fila 186 ---")
row_vals = ws_p.row_values(186)
for i in range(1, 25):
    col_idx = 11 + (i - 1) * 6
    val_date = row_vals[col_idx - 1] if col_idx - 1 < len(row_vals) else ''
    estado_idx = col_idx + 4
    val_estado = row_vals[estado_idx - 1] if estado_idx - 1 < len(row_vals) else ''
    print(f"Cuota {i} (Col {col_idx}): Fecha = {val_date}, Estado = {val_estado}")


print("\n=== 2. ACTUALIZANDO EXCEL MAESTRO LOCAL ===")
wb = openpyxl.load_workbook(FILE)
ws_loc_v = wb['VENTAS']
ws_loc_p = wb['PROYECCIÓN']

# VENTAS row 185
ws_loc_v.cell(185, 1).value = 183
ws_loc_v.cell(185, 2).value = 'LC1 - 19 - 10 '
ws_loc_v.cell(185, 3).value = 'VENDIDO'
ws_loc_v.cell(185, 4).value = 30000000
ws_loc_v.cell(185, 5).value = 0
ws_loc_v.cell(185, 6).value = 46287  # 22/09/2026
ws_loc_v.cell(185, 7).value = 4000000
ws_loc_v.cell(185, 8).value = 46286  # 21/09/2026
ws_loc_v.cell(185, 9).value = 'TRANSFERENCIA'
ws_loc_v.cell(185, 10).value = 26000000
ws_loc_v.cell(185, 11).value = 24
ws_loc_v.cell(185, 12).value = 1083300
ws_loc_v.cell(185, 13).value = '05 DE CADA MES'
ws_loc_v.cell(185, 14).value = 1192786196
ws_loc_v.cell(185, 15).value = 'MAIKOL JULIAN ARDILA OSMA'
ws_loc_v.cell(185, 16).value = '310 8501968'
ws_loc_v.cell(185, 18).value = 'BOGOTA'
ws_loc_v.cell(185, 19).value = 'DAVID FELIPE'

# PROYECCIÓN row 186
ws_loc_p.cell(186, 2).value = 183
ws_loc_p.cell(186, 3).value = 'LC1 - 19 - 10 '
ws_loc_p.cell(186, 4).value = 'VENDIDO'
ws_loc_p.cell(186, 5).value = 30000000
ws_loc_p.cell(186, 6).value = 26000000
ws_loc_p.cell(186, 7).value = 46287  # Fecha venta 22/09/2026
ws_loc_p.cell(186, 8).value = 24
ws_loc_p.cell(186, 9).value = '05 DE CADA MES'
ws_loc_p.cell(186, 10).value = 1083300

# Cuota 1 en Excel (Excel serial date for 2026-11-05 = 46331)
# O fórmula =DATE(2026,11,5)
ws_loc_p.cell(186, 11).value = '=DATE(2026,11,5)'
prev_col = 'K'
for i in range(2, 25):
    col_idx = 11 + (i - 1) * 6
    col_letter = openpyxl.utils.get_column_letter(col_idx)
    ws_loc_p.cell(186, col_idx).value = f'=IF(N($H186)<{i},"",EDATE({prev_col}186,1))'
    # Estado cuota formula
    # Columna estado es col_idx + 4
    estado_col = col_idx + 4
    dias_col = openpyxl.utils.get_column_letter(col_idx + 1)
    pago_col = openpyxl.utils.get_column_letter(col_idx + 2)
    # Copiamos la fórmula de estado estándar
    ws_loc_p.cell(186, col_idx + 1).value = f'=IF({col_letter}186="","",TODAY()-{col_letter}186)'
    ws_loc_p.cell(186, estado_col).value = f'=IF({col_letter}186="","SIN ESTADO",IF(OR({pago_col}186<>"",AND($J186>0,$HS186>=(1*$J186-1000))),"PAGA",IF({dias_col}186>0,"VENCIDA",IF({dias_col}186>=-5,"POR VENCER","AL DÍA"))))'
    prev_col = col_letter

wb.save(FILE)
print("✓ Excel maestro local actualizado exitosamente.")
