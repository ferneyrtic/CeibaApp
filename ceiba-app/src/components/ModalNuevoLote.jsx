import React, { useState, useMemo } from 'react';
import { Tag, Plus, Check, X, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { createLote } from '../lib/api/lotes';
import { registrarAccion } from '../lib/api/auditApi';
import { formatCOP } from '../utils/helpers';
import Modal from './Modal';

const ESTADOS_DISPONIBLES = [
  'DISPONIBLE',
  'EN NEGOCIACIÓN',
  'APARTADO',
  'NO APTO PARA VENTA'
];

export default function ModalNuevoLote({
  existingLotes = [],
  onClose,
  onSuccess
}) {
  const [etapa, setEtapa] = useState(1);
  const [manzana, setManzana] = useState('');
  const [lote, setLote] = useState('');
  const [customIdLote, setCustomIdLote] = useState('');
  const [isCustomId, setIsCustomId] = useState(false);

  const [areaM2, setAreaM2] = useState('');
  const [precioLote, setPrecioLote] = useState('');
  const [precioM2, setPrecioM2] = useState('');
  const [isCustomPrecioM2, setIsCustomPrecioM2] = useState(false);

  const [estado, setEstado] = useState('DISPONIBLE');
  const [observacion, setObservacion] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // ID Lote auto-generado: ej. "LC1 - 3 - 10"
  const generatedIdLote = useMemo(() => {
    if (!manzana || !lote) return '';
    return `LC${etapa} - ${manzana.trim()} - ${lote.trim()}`;
  }, [etapa, manzana, lote]);

  const finalIdLote = isCustomId ? customIdLote.trim() : generatedIdLote;

  // Cálculo automático del precio por m2
  const calcPrecioM2 = useMemo(() => {
    const a = Number(areaM2) || 0;
    const p = Number(precioLote) || 0;
    if (a <= 0 || p <= 0) return 0;
    return Math.round(p / a);
  }, [areaM2, precioLote]);

  const finalPrecioM2 = isCustomPrecioM2 ? (Number(precioM2) || 0) : calcPrecioM2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!finalIdLote) {
      setErrorMsg('Debe definir la Manzana y Lote para generar el código identificador.');
      return;
    }

    // Validar si ya existe
    const exists = existingLotes.some(
      l => (l.id_lote || '').toLowerCase().replace(/\s+/g, '') === finalIdLote.toLowerCase().replace(/\s+/g, '')
    );
    if (exists) {
      setErrorMsg(`Ya existe un lote registrado con el identificador "${finalIdLote}".`);
      return;
    }

    const aNum = Number(areaM2) || 0;
    if (aNum <= 0) {
      setErrorMsg('El área en m² debe ser un número positivo.');
      return;
    }

    const pNum = Number(precioLote) || 0;
    if (pNum <= 0) {
      setErrorMsg('El precio de lista del lote debe ser mayor a $0.');
      return;
    }

    setSubmitting(true);
    try {
      const loteData = {
        proyecto_id: '949b448b-c4bb-4f6c-b1fc-01449af7fb63', // La Ceiba
        etapa: Number(etapa),
        manzana: manzana.trim(),
        lote: lote.trim(),
        id_lote: finalIdLote,
        area_m2: aNum,
        precio_lote: pNum,
        precio_m2: finalPrecioM2,
        precio_venta: pNum,
        estado: estado || 'DISPONIBLE',
        observacion: observacion.trim() || null,
        contrato: 'NO',
        porcentaje_escriturado: 0,
      };

      const created = await createLote(loteData);

      // Registrar auditoría
      try {
        await registrarAccion({
          modulo: 'LOTES',
          accion: 'LOTE_CREADO',
          lote_id: created.id,
          lote_id_str: finalIdLote,
          descripcion: `Nuevo lote creado: ${finalIdLote} (Etapa ${etapa}, Mz ${manzana}, Lote ${lote}, ${aNum} m², Precio: $${pNum.toLocaleString('es-CO')})`,
          detalles: loteData,
        });
      } catch (logErr) {
        console.warn('Aviso guardando log de creación de lote:', logErr);
      }

      if (onSuccess) {
        onSuccess(created);
      }
    } catch (err) {
      console.error('Error al crear lote:', err);
      setErrorMsg(err.message || 'Error guardando el lote en Supabase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 16,
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}>
            <Tag size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              Crear Nuevo Lote (Ítem)
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Registra un nuevo lote disponible en el catálogo comercial del Proyecto La Ceiba
            </div>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', borderRadius: 8 }}
          onClick={onClose}
          disabled={submitting}
        >
          <X size={18} />
        </button>
      </div>

      {errorMsg && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <div>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Ubicación y Nomenclatura */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 14
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            📍 Ubicación y Nomenclatura
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Etapa *
              </label>
              <select
                className="form-control"
                value={etapa}
                onChange={e => setEtapa(Number(e.target.value))}
                style={{ fontWeight: 700 }}
              >
                <option value={1}>Etapa 1</option>
                <option value={2}>Etapa 2</option>
                <option value={3}>Etapa 3</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Manzana *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej. 14"
                value={manzana}
                onChange={e => setManzana(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Número de Lote *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej. 8"
                value={lote}
                onChange={e => setLote(e.target.value)}
                required
              />
            </div>
          </div>

          {/* ID Lote preview */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
                Código Identificador (ID Lote) *
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!isCustomId) setCustomIdLote(generatedIdLote);
                  setIsCustomId(!isCustomId);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isCustomId ? 'Generar automáticamente' : 'Personalizar código'}
              </button>
            </div>

            {isCustomId ? (
              <input
                type="text"
                className="form-control"
                value={customIdLote}
                onChange={e => setCustomIdLote(e.target.value)}
                style={{ fontWeight: 700, fontFamily: 'monospace' }}
                placeholder="Ej. LC1 - 14 - 8"
                required
              />
            ) : (
              <div style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 14,
                fontWeight: 800,
                fontFamily: 'monospace',
                color: finalIdLote ? '#0369a1' : '#94a3b8'
              }}>
                {finalIdLote || 'LC[Etapa] - [Manzana] - [Lote]'}
              </div>
            )}
          </div>
        </div>

        {/* Métricas y Precios */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 14
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            📏 Dimensiones y Precios de Lista
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Área (m²) *
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="Ej. 160.00"
                value={areaM2}
                onChange={e => setAreaM2(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 4 }}>
                Precio de Lista (COP) *
              </label>
              <input
                type="number"
                step="1000"
                className="form-control"
                placeholder="Ej. 28000000"
                value={precioLote}
                onChange={e => setPrecioLote(e.target.value)}
                style={{ fontWeight: 700, color: '#16a34a' }}
                required
              />
              {Number(precioLote) > 0 && (
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2, fontWeight: 600 }}>
                  {formatCOP(Number(precioLote))}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Precio por m² (COP)
              </label>
              <div style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 700,
                color: '#334155'
              }}>
                {formatCOP(finalPrecioM2)} / m²
              </div>
            </div>
          </div>
        </div>

        {/* Estado Inicial y Observación */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Estado Comercial Inicial
            </label>
            <select
              className="form-control"
              value={estado}
              onChange={e => setEstado(e.target.value)}
              style={{ fontWeight: 700 }}
            >
              {ESTADOS_DISPONIBLES.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Observaciones (Opcional)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej. Lote esquinero con vista a la cordillera"
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
            />
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          borderTop: '1px solid var(--border)',
          paddingTop: 16
        }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 20px',
              fontWeight: 700
            }}
          >
            {submitting ? (
              <>
                <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                Creando Lote...
              </>
            ) : (
              <>
                <Check size={16} />
                Guardar Nuevo Lote
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
