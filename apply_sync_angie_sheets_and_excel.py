import openpyxl, gspread, sys
from google.oauth2.service_account import Credentials

sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión.xlsx'
SPREADSHEET_ID = '1H7u5aiE3m8GPcGp0zN4D_DzcyCMph6hmvIt22i0FYsA'
CREDENTIALS_FILE = 'service_account.json'

print("=== 1. ACTUALIZANDO GOOGLE SHEETS PROYECCIÓN (FILA 78 - LC1 - 9 - 6) ===")
creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=['https://www.googleapis.com/auth/spreadsheets'])
gc = gspread.authorize(creds)
sh = gc.open_by_key(SPREADSHEET_ID)

ws_p = sh.worksheet('PROYECCIÓN')

# Cuota 9: BI78 a BL78 (cols 61 a 64)
# Cuota 10: BO78 a BR78 (cols 67 a 70)
# Cuota 11: BU78 a BX78 (cols 73 a 76)
updates = [
    # Cuota 9
    {'range': 'BI78:BL78', 'values': [['27/10/2026', 500000, 'PAGA', 'TRANSFERENCIA']]},
    # Cuota 10
    {'range': 'BO78:BR78', 'values': [['28/10/2026', 1000000, 'PAGA', 'TRANSFERENCIA']]},
    # Cuota 11
    {'range': 'BU78:BX78', 'values': [['05/11/2026', 1000000, 'PAGA', 'TRANSFERENCIA']]},
]

print("Enviando actualizaciones por lote a Google Sheets...")
ws_p.batch_update(updates, value_input_option='USER_ENTERED')
print("✓ Google Sheets PROYECCIÓN actualizado con éxito.")

# Verificación en Google Sheets
r78 = ws_p.row_values(78)
print("Verificación Google Sheets:")
print("C9 :", r78[60:64])
print("C10:", r78[66:70])
print("C11:", r78[72:76])


print("\n=== 2. ACTUALIZANDO EXCEL MAESTRO LOCAL ===")
wb = openpyxl.load_workbook(FILE)
ws_loc_p = wb['PROYECCIÓN']

# Fila 78 (LC1 - 9 - 6)
# Cuota 9
ws_loc_p.cell(78, 61).value = 46322  # 2026-10-27
ws_loc_p.cell(78, 62).value = 500000
ws_loc_p.cell(78, 63).value = 'PAGA'
ws_loc_p.cell(78, 64).value = 'TRANSFERENCIA'

# Cuota 10
ws_loc_p.cell(78, 67).value = 46323  # 2026-10-28
ws_loc_p.cell(78, 68).value = 1000000
ws_loc_p.cell(78, 69).value = 'PAGA'
ws_loc_p.cell(78, 70).value = 'TRANSFERENCIA'

# Cuota 11
ws_loc_p.cell(78, 73).value = 46331  # 2026-11-05
ws_loc_p.cell(78, 74).value = 1000000
ws_loc_p.cell(78, 75).value = 'PAGA'
ws_loc_p.cell(78, 76).value = 'TRANSFERENCIA'

wb.save(FILE)
print("✓ Excel maestro local guardado exitosamente.")

# Verificación Excel
wb_check = openpyxl.load_workbook(FILE, data_only=True)
ws_chk = wb_check['PROYECCIÓN']
print("Verificación Excel:")
print("C9 :", [ws_chk.cell(78, c).value for c in range(61, 65)])
print("C10:", [ws_chk.cell(78, c).value for c in range(67, 71)])
print("C11:", [ws_chk.cell(78, c).value for c in range(73, 77)])
