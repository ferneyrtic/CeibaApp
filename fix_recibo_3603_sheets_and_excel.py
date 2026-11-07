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

# Fila 220: LC2 - 24 - 6 (Jaime Suarez)
print("Actualizando fila 220 en Google Sheets VENTAS a JAIME SUAREZ...")
ws_v.update_cell(220, 15, 'JAIME SUAREZ')

# Verificación en Google Sheets
val_check = ws_v.cell(220, 15).value
print(f"✓ Google Sheets VENTAS fila 220 verificado: {val_check}")


print("\n=== 2. ACTUALIZANDO EXCEL MAESTRO LOCAL ===")
wb = openpyxl.load_workbook(FILE)
ws_loc_v = wb['VENTAS']

print("Actualizando celda O220 en Excel maestro a JAIME SUAREZ...")
ws_loc_v.cell(220, 15).value = 'JAIME SUAREZ'

wb.save(FILE)
print("✓ Excel maestro local guardado exitosamente.")

# Verificación en Excel maestro
wb_check = openpyxl.load_workbook(FILE, data_only=True)
ws_chk_v = wb_check['VENTAS']
print(f"✓ Excel maestro VENTAS fila 220 verificado: {ws_chk_v.cell(220, 15).value}")
