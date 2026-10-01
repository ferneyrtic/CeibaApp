"""
Script para aplicar la nueva fórmula inteligente de ESTADO CUOTA en la hoja PROYECCIÓN de Google Sheets.
Aplica cuota por cuota para las filas 4 a 513 de forma segura y eficiente.
"""
import gspread
from google.oauth2.service_account import Credentials
import sys, time

sys.stdout.reconfigure(encoding='utf-8')

SPREADSHEET_ID = '1H7u5aiE3m8GPcGp0zN4D_DzcyCMph6hmvIt22i0FYsA'
CREDENTIALS_FILE = 'service_account.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

creds = Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)
gc = gspread.authorize(creds)
sh = gc.open_by_key(SPREADSHEET_ID)
proy = sh.worksheet('PROYECCIÓN')

def col_letter(n):
    result = ""
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        result = chr(65 + remainder) + result
    return result

headers = proy.row_values(3)
NUM_ROWS = 513 # Filas 4 a 513 (510 filas)

print("Mapeando columnas de cuota...")
cuotas_info = []

for idx in range(10, len(headers)):
    h = headers[idx].strip() if idx < len(headers) else ''
    if 'ESTADO' in h.upper() and idx >= 14:
        col_num = idx + 1
        col_let = col_letter(col_num)
        col_venc = col_letter(col_num - 4)
        col_dias = col_letter(col_num - 3)
        col_pago = col_letter(col_num - 2)
        
        cuota_num = len(cuotas_info) + 1
        cuotas_info.append({
            'num': cuota_num,
            'col_estado': col_let,
            'col_venc': col_venc,
            'col_dias': col_dias,
            'col_pago': col_pago,
        })

print(f"Total cuotas a procesar: {len(cuotas_info)}")

print("\nIniciando actualización en lotes de Google Sheets...")
inicio = time.time()

for c in cuotas_info:
    c_num = c['num']
    col_est = c['col_estado']
    col_v = c['col_venc']
    col_d = c['col_dias']
    col_p = c['col_pago']
    
    # Generar array de fórmulas para filas 4 a NUM_ROWS
    formulas_columna = []
    for r in range(4, NUM_ROWS + 1):
        # Fórmula inteligente con tolerancia de $1,000 COP para redondeos
        f = f'=IF({col_v}{r}="";"SIN ESTADO";IF(OR({col_p}{r}<>"";AND($J{r}>0;$HS{r}>=({c_num}*$J{r}-1000)));"PAGA";IF({col_d}{r}>0;"VENCIDA";IF({col_d}{r}>=-5;"POR VENCER";"AL DÍA"))))'
        formulas_columna.append([f])
    
    rango = f'{col_est}4:{col_est}{NUM_ROWS}'
    proy.update(rango, formulas_columna, raw=False)
    print(f"  ✓ Cuota {c_num:2d} ({col_est}): {len(formulas_columna)} celdas actualizadas")
    
    # Pausa ligera para no superar el rate limit de Google API (60 req/min)
    time.sleep(1.1)

tiempo_total = round(time.time() - inicio, 1)
print(f"\n🎉 ¡Actualización completada exitosamente en {tiempo_total} segundos!")
