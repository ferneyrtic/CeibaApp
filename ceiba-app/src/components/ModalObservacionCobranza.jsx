import React, { useState, useEffect } from 'react';
import { X, Phone, PhoneCall, Calendar, ClipboardList, Clock, CheckCircle2, User, AlertCircle, Plus, History } from 'lucide-react';
import { guardarObservacionCobranza } from '../lib/api/cobranzaApi';
import { formatDate } from '../utils/helpers';

const OPCIONES_RESPUESTA = [
  'SOLICITA PLAZO',
  'INDICA QUE EL SIGUIENTE PAGO REALIZA LOS PAGOS ATRASADOS',
  'NO RESPONDE',
  'COMPROMISO DE PAGO ACORDADO',
  'MANIFIESTA DIFICULTAD ECONÓMICA',
  'SE LE ENVIÓ DESISTIMIENTO',
  'PRESENTA INCONFORMIDAD',
  'RECORDATORIO DE PAGO REALIZADO',
  'NÚMERO EQUIVOCADO / FUERA DE SERVICIO',
  'OTRO'
];

const OPCIONES_GESTION = [
  'LLAMADA TELEFONICA',
  'MENSAJE POR WHATSAPP',
  'VISITA DIRECTA',
  'CORREO ELECTRÓNICO'
];

export default function ModalObservacionCobranza({
  isOpen,
  onClose,
  venta,
  observacionActual,
  usuarioActual,
  onGuardado
}) {
  if (!isOpen || !venta) return null;

  const idLote = venta.id_lote || venta.lotes?.id_lote || '';
  const loteId = venta.lote_id || venta.lotes?.id || null;
  const clienteNombre = venta.cliente_nombre || venta.clientes?.nombre || 'Cliente';
  const telefono = venta.clientes?.celular || venta.celular || '';
  const cleanPhone = telefono ? String(telefono).replace(/\s+/g, '') : '';

  const [gestion, setGestion] = useState('LLAMADA TELEFONICA');
  const [respuesta, setRespuesta] = useState(OPCIONES_RESPUESTA[0]);
  const [respuestaCustom, setRespuestaCustom] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [notaDetallada, setNotaDetallada] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(true);

  // Inicializar o sincronizar cuando cambia
  useEffect(() => {
    if (observacionActual) {
      if (observacionActual.gestion) setGestion(observacionActual.gestion);
      if (observacionActual.respuesta) {
        if (OPCIONES_RESPUESTA.includes(observacionActual.respuesta)) {
          setRespuesta(observacionActual.respuesta);
        } else {
          setRespuesta('OTRO');
          setRespuestaCustom(observacionActual.respuesta);
        }
      }
    }
  }, [observacionActual]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);

    const respuestaFinal = respuesta === 'OTRO'
      ? (respuestaCustom.trim() || 'OBSERVACIÓN REGISTRADA')
      : respuesta;

    try {
      const resultado = await guardarObservacionCobranza({
        id_lote: idLote,
        lote_id: loteId,
        cliente: clienteNombre,
        gestion,
        respuesta: respuestaFinal,
        fecha,
        observacion_adicional: notaDetallada.trim() || null
      }, usuarioActual || 'Soporte Mora');

      if (onGuardado) {
        onGuardado(resultado);
      }
      onClose();
    } catch (err) {
      console.error('Error guardando observación:', err);
      alert('Error al guardar la observación de cobranza: ' + (err.message || err));
    } finally {
      setGuardando(false);
    }
  };

  const historial = observacionActual?.historial || [];

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: 580, width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: '#fef3c7', color: '#b45309',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Gestión de Cobranza & Llamada
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>Lote: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{idLote}</strong></span>
                <span>·</span>
                <span>Titular: <strong>{clienteNombre}</strong></span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: 6, borderRadius: '50%' }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tarjeta de Contacto Telefónico */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Teléfono para Llamada Directa
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={14} color="#2563eb" />
              {telefono ? telefono : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin teléfono registrado</span>}
            </div>
          </div>
          {telefono && (
            <a
              href={`tel:${cleanPhone}`}
              className="btn btn-primary"
              style={{
                fontSize: 12,
                padding: '6px 12px',
                background: '#2563eb',
                borderColor: '#2563eb',
                gap: 6,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <PhoneCall size={14} /> Llamar ahora
            </a>
          )}
        </div>

        {/* Observación Actual Destacada */}
        {observacionActual && (observacionActual.respuesta || observacionActual.texto_resumen) && (
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: '#92400e', letterSpacing: '0.5px' }}>
                Última Gestión Registrada
              </span>
              {observacionActual.fecha && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>
                  📅 {observacionActual.fecha}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>
              {observacionActual.respuesta || observacionActual.texto_resumen}
            </div>
            {observacionActual.gestion && (
              <div style={{ fontSize: 11, color: '#92400e', marginTop: 3 }}>
                Canal: <strong>{observacionActual.gestion}</strong>
              </div>
            )}
          </div>
        )}

        {/* Historial de Gestiones */}
        {historial.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8, cursor: 'pointer'
              }}
              onClick={() => setMostrarHistorial(!mostrarHistorial)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={14} color="#64748b" />
                Historial de Contacto ({historial.length})
              </div>
              <span style={{ fontSize: 11, color: '#3b82f6' }}>
                {mostrarHistorial ? 'Ocultar' : 'Ver'}
              </span>
            </div>

            {mostrarHistorial && (
              <div style={{
                maxHeight: 140,
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '8px 12px',
                background: '#f8fafc',
                fontSize: 11.5
              }}>
                {historial.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '6px 0',
                      borderBottom: idx < historial.length - 1 ? '1px solid #f1f5f9' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <strong>{h.fecha || 'Sin fecha'}</strong>
                      <span>{h.gestion || 'Llamada'} · {h.autor || 'Cobranza'}</span>
                    </div>
                    <div style={{ color: '#0f172a', fontWeight: 600 }}>
                      {h.respuesta}
                    </div>
                    {h.nota && (
                      <div style={{ color: '#475569', fontStyle: 'italic' }}>
                        "{h.nota}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Formulario para Registrar Nueva Gestión */}
        <form onSubmit={handleSubmit}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#0f172a',
            borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 12
          }}>
            Registrar o Actualizar Gestión de Hoy
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Medio de Contacto
              </label>
              <select
                className="input"
                style={{ width: '100%', fontSize: 12 }}
                value={gestion}
                onChange={e => setGestion(e.target.value)}
              >
                {OPCIONES_GESTION.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Fecha de Gestión
              </label>
              <input
                type="date"
                className="input"
                style={{ width: '100%', fontSize: 12 }}
                value={fecha}
                onChange={e => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Respuesta / Estado del Cliente
            </label>
            <select
              className="input"
              style={{ width: '100%', fontSize: 12 }}
              value={respuesta}
              onChange={e => setRespuesta(e.target.value)}
            >
              {OPCIONES_RESPUESTA.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {respuesta === 'OTRO' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Detalla la respuesta del cliente
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%', fontSize: 12 }}
                placeholder="Ej: Acordó pagar el viernes 30"
                value={respuestaCustom}
                onChange={e => setRespuestaCustom(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Observaciones / Acuerdos Específicos (Opcional)
            </label>
            <textarea
              className="input"
              rows={2}
              style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
              placeholder="Ej: Cliente informa que consignará $1.000.000 el 30 de octubre directamente a la cuenta..."
              value={notaDetallada}
              onChange={e => setNotaDetallada(e.target.value)}
            />
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#b45309', borderColor: '#b45309', gap: 6, fontWeight: 700 }}
              disabled={guardando}
            >
              {guardando ? 'Guardando...' : '💾 Guardar Observación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
