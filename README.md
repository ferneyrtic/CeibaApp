# 🌴 Sistema de Gestión de Pagos y Cartera - Condominio La Ceiba

Aplicación web empresarial para la gestión inmobiliaria, cartera de créditos directos, cierres mensuales de caja real, comisiones por asesor y administración de lotes.

---

## 🚀 Despliegue en Vercel

1. Importa este repositorio en tu cuenta de [Vercel](https://vercel.com).
2. En la pantalla de configuración del proyecto:
   - **Root Directory:** Selecciona `ceiba-app` (o haz clic en "Edit" y escribe `ceiba-app`).
   - **Framework Preset:** Vite (se detecta automáticamente).
   - **Build Command:** `vite build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
3. Variables de Entorno (Opcionales, ya cuenta con fallback de conexión):
   - `VITE_SUPABASE_URL`: URL del proyecto Supabase.
   - `VITE_SUPABASE_ANON_KEY`: Llave pública anon de Supabase.
4. Haz clic en **Deploy**.

---

## 💻 Ejecución Local

### Requisitos
- Node.js 18+ o superior
- npm

### Pasos
```bash
# Entrar a la aplicación web
cd ceiba-app

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Ejecutar suite de pruebas
npm test

# Compilar para producción
npm run build
```

---

## 📁 Estructura del Proyecto

- `ceiba-app/`: Aplicación frontend en React 19 + Vite + Tailwind/CSS + Lucide Icons + Supabase SDK.
  - `src/pages/`: Vistas de Dashboard, Cierre Mensual, Cartera, Lotes, Ventas, Clientes, Reportes y Comisiones.
  - `src/lib/`: Conexión con Supabase, lógica de amortización, cascada de cuotas y exportación de reportes.
  - `tests/`: Suite de 34 pruebas automatizadas en Vitest.
  - `vercel.json`: Reglas de enrutamiento SPA para Vercel.
- `solucion_supabase.sql`: Script SQL con índices de rendimiento y políticas RLS optimizadas.
- `auditoria_*.py`: Scripts de auditoría forense y reconciliación contra bases de datos Excel.
