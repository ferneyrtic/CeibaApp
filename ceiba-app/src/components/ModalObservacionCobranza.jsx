import React, { useState, useEffect } from 'react';
import { X, Phone, PhoneCall, Calendar, ClipboardList, Clock, CheckCircle2, User, AlertCircle, Plus } from 'lucide-react';
import Modal from './Modal';
import { guardarObservacionCobranza, getEstiloObservacionCobranza } from '../lib/api/cobranzaApi';
import { formatDate } from '../utils/helpers';

const OPCIONES_RESPUESTA = [
  'VERIFICAR PAGO',
  'NO NECESITA',
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
  'CORREO ELECTRÓNICO',
  'VERIFICAR PAGO',
  'NO NECESITA'
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
  const [respuesta, setRespuesta] = useState('SOLICITA PLAZO');
  const [respuestaCustom, setRespuestaCustom] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [notaDetallada, setNotaDetallada] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Inicializar o sincronizar cuando cambia
  useEffect(() => {
    if (observacionActual) {
      if (observacionActual.gestion) {
        setGestion(observacionActual.gestion);
      }
      if (observacionActual.fecha) {
        setFecha(observacionActual.fecha);
      }
      const notaPrevia = observacionActual.nota || observacionActual.observacion_adicional || observacionActual.texto_resumen || '';
      setNotaDetallada(notaPrevia);

      if (observacionActual.respuesta) {
        if (OPCIONES_RESPUESTA.includes(observacionActual.respuesta)) {
          setRespuesta(observacionActual.respuesta);
        } else {
          setRespuesta('OTRO');
          setRespuestaCustom(observacionActual.respuesta);
        }
      }
    } else {
      setGestion('LLAMADA TELEFONICA');
      setRespuesta('SOLICITA PLAZO');
      setRespuestaCustom('');
      setNotaDetallada('');
      setFecha(new Date().toISOString().slice(0, 10));
    }
  }, [observacionActual, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);

    const respuestaFinal = respuesta === 'OTRO'
      ? (respuestaCustom.trim() || 'OBSERVACIÓN REGISTRADA')
      : respuesta;

    const notaLimpia = notaDetallada.trim();

    try {
      const resultado = await guardarObservacionCobranza({
        id_lote: idLote,
        lote_id: loteId,
        cliente: clienteNombre,
        gestion,
        respuesta: respuestaFinal,
        nota: notaLimpia || null,
        observacion_adicional: notaLimpia || null,
        fecha
      }, usuarioActual || 'Diana (Soporte)');

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

  const estiloActual = getEstiloObservacionCobranza(observacionActual);
  const estiloForm = getEstiloObservacionCobranza(respuesta === 'OTRO' ? (respuestaCustom || 'OTRO') : respuesta);

  return (
    <Modal onClose={onClose} maxWidth={560} zIndex={100010}>
      <div>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8,
              background: estiloForm.bg, color: estiloForm.colorDark,
              border: `1px solid ${estiloForm.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ClipboardList size={22} color={estiloForm.iconColor} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Observación de Cobranza & Seguimiento
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
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
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div>
            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Teléfono para Llamada Directa
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={14} color="#2563eb" />
              {telefono ? telefono : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 500 }}>Sin teléfono registrado</span>}
            </div>
          </div>
          {telefono && (
            <a
              href={`tel:${cleanPhone}`}
              className="btn btn-primary"
              style={{
                fontSize: 12,
                padding: '5px 12px',
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

        {/* Observación Actual Destacada si ya existe */}
        {observacionActual && (observacionActual.respuesta || observacionActual.texto_resumen || observacionActual.nota) && (
          <div style={{
            background: estiloActual.bg,
            border: `1px solid ${estiloActual.border}`,
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: estiloActual.badgeBg,
                  color: estiloActual.badgeColor
                }}>
                  {estiloActual.label}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: estiloActual.colorDark, letterSpacing: '0.5px' }}>
                  Observación Actual en Sistema
                </span>
              </div>
              {observacionActual.fecha && (
                <span style={{ fontSize: 11, fontWeight: 700, color: estiloActual.color }}>
                  📅 {observacionActual.fecha}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: estiloActual.colorDark }}>
              {observacionActual.respuesta || observacionActual.texto_resumen}
            </div>
            {(observacionActual.nota || observacionActual.observacion_adicional) && (
              <div style={{
                fontSize: 12.5,
                color: estiloActual.colorText,
                fontWeight: 600,
                marginTop: 6,
                background: '#fff',
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${estiloActual.border}`
              }}>
                "{observacionActual.nota || observacionActual.observacion_adicional}"
              </div>
            )}
            {observacionActual.gestion && (
              <div style={{ fontSize: 11, color: estiloActual.colorDark, marginTop: 4 }}>
                Medio: <strong>{observacionActual.gestion}</strong>
              </div>
            )}
          </div>
        )}

        {/* Formulario para Registrar / Actualizar Observación */}
        <form onSubmit={handleSubmit}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#0f172a',
            borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginBottom: 12
          }}>
            Actualizar Observación y Acuerdo
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
                Fecha Realizada
              </label>
              <input
                type="date"
                className="input"
                style={{ width: '100%', fontSize: 12 }}
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Respuesta / Estado del Cliente
            </label>
            <select
              className="input"
              style={{
                width: '100%',
                fontSize: 12,
                fontWeight: 700,
                borderColor: estiloForm.border,
                background: estiloForm.bg,
                color: estiloForm.colorDark
              }}
              value={respuesta}
              onChange={e => setRespuesta(e.target.value)}
            >
              {OPCIONES_RESPUESTA.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {/* Indicador visual semafórico según la opción seleccionada */}
            <div style={{
              fontSize: 11,
              marginTop: 6,
              padding: '4px 10px',
              borderRadius: 6,
              background: estiloForm.bg,
              color: estiloForm.colorDark,
              border: `1px solid ${estiloForm.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 600
            }}>
              <span>{estiloForm.pillDesc}</span>
            </div>
          </div>

          {respuesta === 'OTRO' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                Escribe la respuesta del cliente
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
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              Observación Específica / Nota del Acuerdo (Lo que dijo el cliente)
            </label>
            <textarea
              className="input"
              rows={3}
              style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
              placeholder="Ej: Cliente informa que consignará $4.000.000 el viernes 30 porque vendió un ganado. No volver a llamar antes del 30..."
              value={notaDetallada}
              onChange={e => setNotaDetallada(e.target.value)}
            />
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Esta nota se guardará y será visible para Diana y para cualquiera que revise el lote después.
            </div>
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
              style={{
                background: estiloForm.badgeBg,
                borderColor: estiloForm.badgeBg,
                color: estiloForm.badgeColor,
                gap: 6,
                fontWeight: 700
              }}
              disabled={guardando}
            >
              {guardando ? 'Guardando...' : '💾 Guardar Observación'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
