import openpyxl, sys
from datetime import datetime
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
wb = openpyxl.load_workbook(FILE, data_only=True)

def to_num(val):
    if val is None: return 0.0
    if isinstance(val, (int, float)): return float(val)
    if isinstance(val, datetime): return 0.0
    try:
        s = str(val).replace('$','').replace(',','').strip()
        return float(s) if s and not s.startswith('#') else 0.0
    except: return 0.0

p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]
col_hs = openpyxl.utils.column_index_from_string('HS')

print(f'Hoja proyeccion: {p_name}')
print('\n=== PROYECCION: LC1 - 6 - 2 ===')
for idx in range(4, 600):
    raw = ws_p.cell(idx, 3).value
    if raw and '6 - 2' in str(raw) and 'LC1' in str(raw):
        hs_v = ws_p.cell(idx, col_hs).value
        print(f'Fila {idx} | Total Pagado (HS{idx}) = ${to_num(hs_v):,.0f}')
        
        # Leer cuotas
        for n in range(1, 14):
            cs = 10 + (n-1)*6
            col_val_l = openpyxl.utils.get_column_letter(cs+3+1)  # +1 because 0-based vs 1-based
            col_fv_l  = openpyxl.utils.get_column_letter(cs+1)
            col_fp_l  = openpyxl.utils.get_column_letter(cs+3)
            
            fv  = ws_p.cell(idx, cs+1).value
            fp  = ws_p.cell(idx, cs+3).value
            vc  = ws_p.cell(idx, cs+4).value
            est = ws_p.cell(idx, cs+5).value
            
            if fv or fp or vc or est:
                fp_str = str(fp)[:10] if fp else 'sin fecha'
                vc_num = to_num(vc)
                print(f'  Cuota {n:>2} | FechaVencim: {str(fv)[:10] if fv else "—"} | FechaPago: {fp_str:<12} | Valor: ${vc_num:>12,.0f} | Est: {est}')
        break
