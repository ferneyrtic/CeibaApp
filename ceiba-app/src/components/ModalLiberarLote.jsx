import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert, Flame } from 'lucide-react';
import Modal from './Modal';
import { liberarLoteADisponible } from '../lib/api/loteLifecycleApi';

export default function ModalLiberarLote({
  lote,
  venta = null,
  cuotas = [],
  recibos = [],
  user,
  onClose,
  onSuccess,
}) {
  const [paso, setPaso] = useState(1); // 1: Motivo + primera advertencia chistosa | 2: "Estas segura SEGURA?"
  const [motivo, setMotivo] = useState('');
  const [resolucionDinero, setResolucionDinero] = useState('No devolutivo / Arras perdidas');
  const [palabraConfirm, setPalabraConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleLiberar = async () => {
    setErrorMsg(null);
    if (palabraConfirm.trim().toUpperCase() !== 'LIBERAR') {
      setErrorMsg('Escribe exactamente la palabra LIBERAR para confirmar.');
      return;
    }
    setSubmitting(true);
    try {
      const snap = await liberarLoteADisponible({
        lote,
        venta,
        cuotas,
        recibos,
        motivo,
        resolucion_dinero: resolucionDinero,
        usuario: user,
      });
      onSuccess?.(snap);
      onClose?.();
    } catch (err) {
      setErrorMsg(err.message || 'Error al liberar el lote.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Liberar Lote — ${lote?.id_lote || ''}`} onClose={onClose} width="540px">
      {paso === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            padding: 14, borderRadius: 12, background: '#fef2f2', border: '1.5px solid #fca5a5',
            display: 'flex', gap: 12, alignItems: 'flex-start'
          }}>
            <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.5 }}>
              <strong>¡Ojo al dato! Vas a devolver este lote a DISPONIBLE.</strong>
              <div style={{ marginTop: 4 }}>
                Se limpiará la venta/reserva actual del lote <strong>{lote?.id_lote}</strong>, pero tranquilo(a):
                guardaremos un <strong>histórico completo del desistimiento</strong> y tus <strong>recibos contables
                conservarán su consecutivo intacto</strong> para que la contadora no sufra un infarto.
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Motivo de la liberación / desistimiento *</label>
            <textarea
              className="input"
              rows={3}
              required
              placeholder="Ej: Vencimiento de plazo de arras sin firma de contrato / Desistimiento voluntario del cliente..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              style={{ marginTop: 4, resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Resolución del dinero recaudado</label>
            <select
              className="input"
              value={resolucionDinero}
              onChange={e => setResolucionDinero(e.target.value)}
              style={{ marginTop: 4 }}
            >
              <option value="No devolutivo / Arras perdidas">No devolutivo / Arras perdidas</option>
              <option value="Desistimiento con acuerdo de devolución">Desistimiento con acuerdo de devolución</option>
              <option value="Traslado / Cruce hacia otro lote">Traslado / Cruce hacia otro lote</option>
              <option value="Corrección administrativa / Sin dinero">Corrección administrativa / Sin dinero</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
              disabled={!motivo.trim()}
              onClick={() => setPaso(2)}
            >
              Continuar...
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, #fff1f2 0%, #fef3c7 100%)',
            border: '2px dashed #ef4444', textAlign: 'center'
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>😱🔥</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#991b1b' }}>
              ¿Estás segura, SEGURA, SEGURÍSIMA?
            </div>
            <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 6, lineHeight: 1.5 }}>
              Porque si borramos esto sin estar 100% convencidos, <strong>¡se va a armar un chicharrón monumental!</strong> 🐷💥
              <br />
              <span style={{ fontSize: 11.5, color: '#92400e' }}>
                (Menos mal el historial y los recibos quedan guardados en la bóveda por si acaso 😉)
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
              Para demostrar que no te tembló el pulso, escribe <code style={{ color: '#dc2626', fontWeight: 800 }}>LIBERAR</code>:
            </label>
            <input
              className="input"
              placeholder="LIBERAR"
              value={palabraConfirm}
              onChange={e => setPalabraConfirm(e.target.value)}
              style={{ textAlign: 'center', fontWeight: 800, letterSpacing: 2 }}
            />
          </div>

          {errorMsg && (
            <div style={{ padding: 8, borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 12 }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setPaso(1)} disabled={submitting}>
              ← Uy no, devolverme
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#dc2626', borderColor: '#dc2626', gap: 6 }}
              disabled={submitting || palabraConfirm.trim().toUpperCase() !== 'LIBERAR'}
              onClick={handleLiberar}
            >
              <RotateCcw size={14} /> {submitting ? 'Liberando...' : '¡Sí, liberar lote ya!'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
