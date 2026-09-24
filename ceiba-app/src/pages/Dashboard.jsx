import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Building2, HandCoins, Wallet, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, DollarSign, RefreshCw
} from 'lucide-react';
import { getDashboardKpis } from '../lib/api/dashboard';
import { kpis as mockKpis } from '../data/mockData';
import { formatCOP, formatNumber } from '../utils/helpers';

const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

const EMPTY_KPIS = {
  totalLotes: 0, lotesVendidos: 0, lotesDisponibles: 0, lotesNegociacion: 0,
  lotesApartados: 0, lotesNoAptos: 0,
  totalRecaudado: 0, totalProyectado: 0, totalSaldoPendiente: 0,
  cuotasVencidas: 0, cuotasPorVencer: 0, carteraMora: 0,
  ingresosMes: { labels: [], recaudado: [], proyectado: [] },
  ventasPorVendedor: [],
  estadoCartera: [
    { name: 'Al Día', value: 0, color: '#16a34a' },
    { name: 'Con Saldo', value: 0, color: '#d97706' },
    { name: 'Sin Gestión', value: 0, color: '#dc2626' },
  ],
};

const TooltipCOP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid #e2ece2', borderRadius:8, padding:'10px 14px', fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
      <p style={{ color:'#6b7280', marginBottom:6, fontWeight:600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight:700 }}>
          {p.name}: {formatCOP(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [kpis, setKpis]       = useState(EMPTY_KPIS);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    getDashboardKpis()
      .then(data => setKpis(data))
      .catch(err => {
        console.error('Error cargando KPIs:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const chartData = (kpis.ingresosMes?.labels || []).map((label, i) => ({
    label,
    Recaudado:  kpis.ingresosMes.recaudado[i],
    Proyectado: kpis.ingresosMes.proyectado[i],
  }));

  const lotePct      = pct(kpis.lotesVendidos,    kpis.totalLotes);
  const recaudadoPct = pct(kpis.totalRecaudado, kpis.totalProyectado);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12, color:'var(--text-muted)' }}>
      <RefreshCw size={20} style={{ animation:'spin 1s linear infinite' }} />
      <span>Cargando datos...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div>
      {/* Mora alerts */}
      {kpis.carteraMora > 0 && (
        <div className="alert-banner red" style={{ marginBottom: 20 }}>
          <AlertTriangle size={16} />
          <span>
            <strong>{kpis.carteraMora} clientes en mora</strong> registrados para seguimiento de cobro.
            {kpis.cuotasPorVencer > 0 && ` · ${kpis.cuotasPorVencer} cuotas vencen esta semana.`}
          </span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Building2 size={18} /></div>
          <div className="kpi-value">{formatNumber(kpis.totalLotes)}</div>
          <div className="kpi-label">Total de Lotes</div>
          <div className="kpi-change up">
            <CheckCircle2 size={11} />
            {kpis.lotesVendidos} vendidos ({lotePct}%)
          </div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-icon green"><DollarSign size={18} /></div>
          <div className="kpi-value" style={{ fontSize:18 }}>{formatCOP(kpis.totalRecaudado)}</div>
          <div className="kpi-label">Total Recaudado</div>
          <div className="kpi-change up">
            <TrendingUp size={11} />
            {recaudadoPct}% del proyectado
          </div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-icon purple"><HandCoins size={18} /></div>
          <div className="kpi-value" style={{ fontSize:18 }}>{formatCOP(kpis.totalSaldoPendiente)}</div>
          <div className="kpi-label">Cartera por Cobrar</div>
          <div className="kpi-change warn">
            <Clock size={11} />
            {kpis.conSaldo} clientes con saldo activo
          </div>
        </div>

        <div className="kpi-card yellow">
          <div className="kpi-icon yellow"><Clock size={18} /></div>
          <div className="kpi-value">{kpis.cuotasPorVencer}</div>
          <div className="kpi-label">Cuotas por Vencer (7 días)</div>
          <div className="kpi-change warn">
            <Clock size={11} />
            {kpis.cuotasMesActual || 0} cuotas en 30 días
          </div>
        </div>

        <div className="kpi-card red">
          <div className="kpi-icon red"><AlertTriangle size={18} /></div>
          <div className="kpi-value">{kpis.carteraMora}</div>
          <div className="kpi-label">Clientes en Mora</div>
          <div className="kpi-change down">
            de {kpis.lotesVendidos} contratos vendidos ({kpis.clientesAlDia} al día)
          </div>
        </div>


        <div className="kpi-card blue">
          <div className="kpi-icon cyan"><Wallet size={18} /></div>
          <div className="kpi-value">{kpis.lotesDisponibles}</div>
          <div className="kpi-label">Lotes Disponibles</div>
          <div className="kpi-change up">
            <Building2 size={11} />
            {kpis.lotesNegociacion} en negociación
          </div>
        </div>
      </div>


      {/* Progress bars */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24 }}>
          <div>
            <div className="progress-label">
              <span>Lotes vendidos</span>
              <span style={{ color:'var(--text-primary)', fontWeight:700 }}>{lotePct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width:`${lotePct}%`, background:'var(--green)' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
              {kpis.lotesVendidos} de {kpis.totalLotes} lotes
            </div>
          </div>
          <div>
            <div className="progress-label">
              <span>Cartera recaudada</span>
              <span style={{ color:'var(--text-primary)', fontWeight:700 }}>{recaudadoPct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width:`${recaudadoPct}%`, background:'var(--accent)' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
              {formatCOP(kpis.totalRecaudado)} de {formatCOP(kpis.totalProyectado)}
            </div>
          </div>
          <div>
            <div className="progress-label">
              <span>Cuotas al día</span>
              <span style={{ color:'var(--text-primary)', fontWeight:700 }}>
                {pct(kpis.estadoCartera[0].value, kpis.estadoCartera.reduce((a,c)=>a+c.value,0))}%
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width:`${pct(kpis.estadoCartera[0].value, kpis.estadoCartera.reduce((a,c)=>a+c.value,0))}%`, background:'var(--green)' }} />
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
              {kpis.estadoCartera[0].value} de {kpis.estadoCartera.reduce((a,c)=>a+c.value,0)} cuotas activas
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Ingresos vs Proyección */}
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <div className="chart-title">Ingresos Recaudados vs. Proyección</div>
          <div className="chart-sub">Últimos 6 meses (en COP)</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradPro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2ece2" />
              <XAxis dataKey="label" tick={{ fill:'#6b7280', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#6b7280', fontSize:10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v/1000000).toFixed(0)}M`} />
              <Tooltip content={<TooltipCOP />} />
              <Legend wrapperStyle={{ fontSize:12, paddingTop:12, color:'#374151' }} />
              <Area type="monotone" dataKey="Proyectado" stroke="#8b5cf6" fill="url(#gradPro)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Recaudado"  stroke="#3b82f6" fill="url(#gradRec)" strokeWidth={2.5} dot={{ r:3, fill:'#3b82f6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas por vendedor */}
        <div className="chart-card">
          <div className="chart-title">Ventas por Vendedor</div>
          <div className="chart-sub">Unidades vendidas por asesor</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={kpis.ventasPorVendedor} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2ece2" horizontal={false} />
              <XAxis type="number" tick={{ fill:'#6b7280', fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill:'#374151', fontSize:11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                formatter={(v) => [v, 'Ventas']}
                contentStyle={{ background:'#fff', border:'1px solid #e2ece2', borderRadius:8, fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="ventas" fill="#3b82f6" radius={[0,4,4,0]}>
                {kpis.ventasPorVendedor.map((_, i) => (
                  <Cell key={i} fill={['#3b82f6','#8b5cf6','#06b6d4','#22c55e','#f59e0b','#ef4444'][i % 6]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Estado cartera */}
        <div className="chart-card">
          <div className="chart-title">Estado de Cuotas</div>
          <div className="chart-sub">Distribución de la cartera activa</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={kpis.estadoCartera} cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                paddingAngle={3} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                labelLine={{ stroke:'#475569', strokeWidth:1 }}
              >
                {kpis.estadoCartera.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [v + ' cuotas', n]}
                contentStyle={{ background:'#fff', border:'1px solid #e2ece2', borderRadius:8, fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Estado lotes summary */}
      <div className="card">
        <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:'var(--text-primary)' }}>Inventario de Lotes</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12 }}>
          {[
            { label:'Vendidos',       val: kpis.lotesVendidos,    color:'#22c55e', bg:'rgba(34,197,94,0.1)' },
            { label:'Disponibles',    val: kpis.lotesDisponibles,  color:'#3b82f6', bg:'rgba(59,130,246,0.1)' },
            { label:'En Negociación', val: kpis.lotesNegociacion,  color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
            { label:'Apartados',      val: kpis.lotesApartados,    color:'#8b5cf6', bg:'rgba(139,92,246,0.1)' },
            { label:'No Aptos',       val: kpis.lotesNoAptos,      color:'#ef4444', bg:'rgba(239,68,68,0.1)' },
          ].map(s => (
            <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.color}30`, borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
