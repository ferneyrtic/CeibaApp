import React, { useState } from 'react';
import { UserCheck, X, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import { updateCliente } from '../lib/api/clientes';

export default function ModalEditarCliente({ cliente, onClose, onSuccess }) {
  const [nombre, setNombre] = useState(cliente?.nombre || '');
  const [docCliente, setDocCliente] = useState(cliente?.doc_cliente || '');
  const [celular, setCelular] = useState(cliente?.celular || '');
  const [ciudad, setCiudad] = useState(cliente?.ciudad || '');
  const [direccion, setDireccion] = useState(cliente?.direccion || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('El nombre del cliente es obligatorio');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateCliente(cliente.id, {
        nombre: nombre.trim(),
        doc_cliente: docCliente ? docCliente.trim() : null,
        celular: celular ? celular.trim() : null,
        ciudad: ciudad ? ciudad.trim() : null,
        direccion: direccion ? direccion.trim() : null,
      });
      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error actualizando cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={18} color="var(--accent)" />
          Editar Información del Cliente
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="alert-banner red" style={{ marginBottom: 14 }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Nombre y Apellidos: *
          </label>
          <input
            type="text"
            className="search-input"
            style={{ width: '100%' }}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            placeholder="Ej: Pedro Pérez"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Cédula / Documento:
            </label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              value={docCliente}
              onChange={e => setDocCliente(e.target.value)}
              placeholder="Ej: 79872109"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Teléfono Celular:
            </label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              value={celular}
              onChange={e => setCelular(e.target.value)}
              placeholder="Ej: 3201234567"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Ciudad:
            </label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              value={ciudad}
              onChange={e => setCiudad(e.target.value)}
              placeholder="Ej: Villavicencio"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Dirección:
            </label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              value={direccion}
              onChange={e => setDireccion(e.target.value)}
              placeholder="Ej: Cra 15 # 20-30"
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
