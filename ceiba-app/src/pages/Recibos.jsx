import React, { useState } from 'react';
import RecibosListView from '../components/RecibosListView';
import ReciboCajaView from '../components/ReciboCajaView';

export default function Recibos({ onNavigateToCartera }) {
  const [reciboParaVer, setReciboParaVer] = useState(null);

  return (
    <div className="page-container" style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          🧾 Historial y Registro Oficial de Recibos
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Consulta, búsqueda, visualización y exportación de recibos de caja emitidos del proyecto La Ceiba
        </p>
      </div>

      <RecibosListView
        onVerRecibo={(recibo) => setReciboParaVer(recibo)}
        onVerExtracto={(idLote, ventaId) => {
          if (onNavigateToCartera) {
            onNavigateToCartera(idLote, ventaId);
          }
        }}
      />

      {reciboParaVer && (
        <ReciboCajaView
          recibo={reciboParaVer}
          onClose={() => setReciboParaVer(null)}
        />
      )}
    </div>
  );
}
