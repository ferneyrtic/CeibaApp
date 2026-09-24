"""
Inspección profunda de las 407 cuotas con fecha de pago y los 8 casos de COBRANZA
"""
import openpyxl, sys, json
sys.stdout.reconfigure(encoding='utf-8')

FILE = 'Base de datos - La Ceiba ultima versión 2208.xlsx'
wb = openpyxl.load_workbook(FILE, data_only=True)

ws_v = wb['VENTAS']
p_name = [s for s in wb.sheetnames if 'PROY' in s.upper()][0]
ws_p = wb[p_name]
ws_cob = wb['COBRANZA']
ws_cart = wb['CARTERA TOTAL']

# 1. Revisar los 8 casos de discrepancia PROYECCIÓN vs COBRANZA
from reconciliar_cuotas_4_vias import discrepancias_proy_vs_cobranza, cuotas_con_fecha_pago_pero_no_pagas, discrepancias_abonos_vs_proy_hs

print("=== 1. LOS 8 CASOS DE DISCREPANCIA ENTRE PROYECCIÓN Y COBRANZA ===")
for d in discrepancias_proy_vs_cobranza:
    print(d)

print("\n=== 2. MUESTRA DE LAS CUOTAS CON FECHA DE PAGO PERO ESTADO DIFERENTE A 'PAGA' ===")
estados_distintos = {}
for c in cuotas_con_fecha_pago_pero_no_pagas:
    est = c['estado']
    estados_distintos[est] = estados_distintos.get(est, 0) + 1

print("Distribución de estados en cuotas con fecha de pago:", estados_distintos)
print("\nMuestra de primeros 10 casos:")
for c in cuotas_con_fecha_pago_pero_no_pagas[:10]:
    print(f"• Lote: {c['lote']:<16} | Cuota: {c['cuota']:<2} | Fecha Pago: {c['f_pago']} | Valor: ${c['valor']:>10,.0f} | Estado en Celda: '{c['estado']}'")

print("\n=== 3. ANÁLISIS DE VENTAS.abonos vs PROYECCIÓN (Primeros 5 casos) ===")
for d in discrepancias_abonos_vs_proy_hs[:5]:
    nom = (d['cliente'] or '—')[:26]
    print(f"• Lote: {d['lote']:<16} | {nom:<26} | Abonos VENTAS: ${d['abonos_ventas']:>12,.0f} | Total PROYECCIÓN HS: ${d['total_proy_hs']:>12,.0f} | Dif: ${d['diferencia']:>12,.0f}")
