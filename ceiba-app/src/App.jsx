import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Building2, HandCoins, Wallet, Users, BarChart3,
  Settings, TrendingUp, Bell, LogOut, Menu, X, Sun, Moon, Calculator,
  BadgeDollarSign, HardHat
} from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CierreMensual from './pages/CierreMensual';
import Comisiones from './pages/Comisiones';
import Gastos from './pages/Gastos';
import Lotes from './pages/Lotes';
import Ventas from './pages/Ventas';
import Cartera from './pages/Cartera';
import Clientes from './pages/Clientes';
import Reportes from './pages/Reportes';
import Configuracion from './pages/Configuracion';
import './index.css';

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',         icon: LayoutDashboard, section: 'PRINCIPAL' },
  { id: 'cierre',     label: 'Cierre Mensual',     icon: Calculator,      section: 'FINANZAS' },
  { id: 'comisiones', label: 'Nómina Comisiones',  icon: BadgeDollarSign, section: 'FINANZAS' },
  { id: 'gastos',     label: 'Gastos de Obra',     icon: HardHat,         section: 'FINANZAS' },
  { id: 'lotes',      label: 'Lotes',              icon: Building2,       section: 'GESTIÓN' },
  { id: 'ventas',     label: 'Ventas',             icon: HandCoins,        section: 'GESTIÓN' },
  { id: 'cartera',    label: 'Cartera',            icon: Wallet,           section: 'GESTIÓN', badge: true },
  { id: 'clientes',   label: 'Clientes',           icon: Users,            section: 'GESTIÓN' },
  { id: 'reportes',   label: 'Reportes',           icon: BarChart3,        section: 'REPORTES' },
  { id: 'config',     label: 'Configuración',      icon: Settings,         section: 'SISTEMA' },
];

const PAGE_MAP = {
  dashboard:  Dashboard,
  cierre:     CierreMensual,
  comisiones: Comisiones,
  gastos:     Gastos,
  lotes:      Lotes,
  ventas:     Ventas,
  cartera:    Cartera,
  clientes:   Clientes,
  reportes:   Reportes,
  config:     Configuracion,
};

const PAGE_META = {
  dashboard:  { title: 'Dashboard',                 sub: 'Resumen general del proyecto La Ceiba' },
  cierre:     { title: 'Cierre de Cuentas Mensual', sub: 'Control de recaudo esperado, cumplimiento contable y proyección financiera' },
  comisiones: { title: 'Nómina & Pagos de Comisionistas', sub: 'Control auditable de pagos de comisiones y registro de desembolsos a asesores' },
  gastos:     { title: 'Gastos de Obra & Operación', sub: 'Control de materiales de construcción, maquinaria, mano de obra y costos de desarrollo' },
  lotes:      { title: 'Gestión de Lotes',          sub: 'Inventario y estado de todos los lotes' },
  ventas:     { title: 'Ventas',                    sub: 'Registro y seguimiento de ventas' },
  cartera:    { title: 'Cartera & Pagos',           sub: 'Control de cuotas, pagos y mora' },
  clientes:   { title: 'Clientes',                  sub: 'Información y gestión de compradores' },
  reportes:   { title: 'Reportes',                  sub: 'Exportación y análisis de datos' },
  config:     { title: 'Configuración',             sub: 'Personalización visual y parámetros del sistema' },
};

function Sidebar({ active, onNav, user, onSignOut, isOpen, onClose, permissions, roleInfo, role }) {
  let lastSection = null;
  const initials = user?.email?.slice(0, 2).toUpperCase() || 'US';

  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.id === 'cierre' && !permissions?.canViewCierre) return false;
    if (item.id === 'config' && !permissions?.canViewConfig) return false;
    if (item.id === 'gastos' && !permissions?.canViewGastos) return false;
    return true;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img
            src="/logo.png"
            alt="La Ceiba Proyecto Campestre"
            className="sidebar-brand-img"
          />
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">LA CEIBA</div>
            <div className="sidebar-brand-sub">Proyecto Campestre</div>
          </div>
          <button
            className="mobile-close-btn"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleNavItems.map(item => {
            const showSection = item.section !== lastSection;
            lastSection = item.section;
            const Icon = item.icon;
            return (
              <React.Fragment key={item.id}>
                {showSection && <div className="nav-section-title">{item.section}</div>}
                <div
                  className={`nav-item ${active === item.id ? 'active' : ''}`}
                  onClick={() => {
                    onNav(item.id);
                    if (onClose) onClose();
                  }}
                >
                  <Icon className="nav-icon" size={16} />
                  {item.label}
                  {item.badge && <span className="notif-dot" />}
                </div>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="user-avatar" style={{ background: roleInfo?.badgeColor || 'var(--accent)', color: '#ffffff', fontWeight: 700 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 13 }}>
                  {user?.user_metadata?.nombre || user?.email?.split('@')[0]}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </div>
              </div>
              <button
                onClick={onSignOut}
                title="Cerrar sesión"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', display: 'flex', flexShrink: 0 }}
              >
                <LogOut size={16} />
              </button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '4px 8px',
              borderRadius: 6,
              background: roleInfo?.badgeBg || '#ecfdf5',
              border: `1px solid ${roleInfo?.badgeBorder || '#a7f3d0'}`,
              color: roleInfo?.badgeColor || '#059669',
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleInfo?.badgeColor || '#059669' }} />
              ROL: {roleInfo?.label || role}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ page, onToggleSidebar, theme, onToggleTheme, roleInfo }) {
  const meta = PAGE_META[page] || {};
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="mobile-hamburger-btn"
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <div>
          <div className="topbar-title">{meta.title}</div>
          <div className="topbar-sub">{meta.sub}</div>
        </div>
      </div>

      <div className="topbar-actions">
        {/* Badge de Rol actual */}
        {roleInfo && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: roleInfo.badgeBg,
            border: `1px solid ${roleInfo.badgeBorder}`,
            borderRadius: 20,
            color: roleInfo.badgeColor,
            fontSize: 11.5,
            fontWeight: 700
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleInfo.badgeColor }} />
            {roleInfo.label}
          </div>
        )}

        {/* Toggle Modo Oscuro / Claro en la barra superior */}
        <button
          className="btn btn-ghost"
          onClick={() => onToggleTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          style={{ padding: '8px', color: theme === 'dark' ? '#86efac' : 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button className="btn btn-ghost" style={{ position: 'relative', padding: '8px' }}>
          <Bell size={16} />
          <span className="notif-dot" style={{ position: 'absolute', top: 6, right: 6 }} />
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
          background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-light)',
        }}>
          <TrendingUp size={14} color="var(--accent)" />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>ACTIVO</span>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav({ active, onNav, onOpenMenu }) {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`bottom-nav-item ${active === 'dashboard' ? 'active' : ''}`}
        onClick={() => onNav('dashboard')}
      >
        <LayoutDashboard size={18} />
        <span>Inicio</span>
      </button>
      <button
        className={`bottom-nav-item ${active === 'cartera' ? 'active' : ''}`}
        onClick={() => onNav('cartera')}
      >
        <Wallet size={18} />
        <span>Cartera</span>
        <span className="notif-dot" style={{ position: 'absolute', top: 4, right: 18 }} />
      </button>
      <button
        className={`bottom-nav-item ${active === 'lotes' ? 'active' : ''}`}
        onClick={() => onNav('lotes')}
      >
        <Building2 size={18} />
        <span>Lotes</span>
      </button>
      <button
        className={`bottom-nav-item ${active === 'reportes' ? 'active' : ''}`}
        onClick={() => onNav('reportes')}
      >
        <BarChart3 size={18} />
        <span>Reportes</span>
      </button>
      <button
        className="bottom-nav-item"
        onClick={onOpenMenu}
      >
        <Menu size={18} />
        <span>Más</span>
      </button>
    </nav>
  );
}

export default function App() {
  const { user, loading, signOut, role, roleInfo, permissions } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ceiba_theme') || 'light');

  // Redirección si se intenta acceder a una sección restringida para el rol
  useEffect(() => {
    if (page === 'cierre' && !permissions?.canViewCierre) {
      setPage('dashboard');
    }
    if (page === 'config' && !permissions?.canViewConfig) {
      setPage('dashboard');
    }
    if (page === 'gastos' && !permissions?.canViewGastos) {
      setPage('dashboard');
    }
  }, [page, permissions]);

  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    localStorage.setItem('ceiba_theme', theme);
  }, [theme]);

  const handleToggleTheme = (newTheme) => {
    setTheme(newTheme);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="La Ceiba" style={{ width: 160, marginBottom: 20, opacity: 0.9 }} />
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Cargando...</div>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const PageComponent = PAGE_MAP[page] || Dashboard;

  return (
    <div className="app-layout">
      <Sidebar
        active={page}
        onNav={setPage}
        user={user}
        onSignOut={signOut}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        permissions={permissions}
        roleInfo={roleInfo}
        role={role}
      />
      <div className="main-content">
        <Topbar
          page={page}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          roleInfo={roleInfo}
        />
        {/* Marca de agua del logo */}
        <div className="watermark" aria-hidden="true">
          <img src="/logo.png" alt="" />
        </div>
        <main className="page-content fade-in" key={page}>
          <PageComponent theme={theme} onToggleTheme={handleToggleTheme} />
        </main>

        <MobileBottomNav
          active={page}
          onNav={setPage}
          onOpenMenu={() => setSidebarOpen(true)}
        />
      </div>
    </div>
  );
}
