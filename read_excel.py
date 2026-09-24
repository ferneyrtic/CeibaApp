import pandas as pd
import json
import warnings
warnings.filterwarnings('ignore')

file_path = "Base de datos - La Ceiba (3).xlsx"

xl = pd.ExcelFile(file_path)
print("Hojas encontradas:", xl.sheet_names)

for sheet in xl.sheet_names:
    print(f"\n{'='*60}")
    print(f"HOJA: {sheet}")
    df = pd.read_excel(file_path, sheet_name=sheet, header=None)
    print(f"Dimensiones: {df.shape}")
    print("Primeras 5 filas:")
    print(df.head(5).to_string())
