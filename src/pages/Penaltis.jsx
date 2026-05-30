import { useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getInitials, POSICION_CONFIG } from '../utils';

const TIPOS = [
  { value: 'falta_injustificada', label: 'Falta injustificada', emoji: '🍺', esDoce: true },
  { value: 'cancelacion_tardia',  label: 'Cancelación tardía',  emoji: '⏰' },
  { value: 'no_show',             label: 'No se presentó',      emoji: '👻' },
  { value: 'otro',                label: 'Otro',                emoji: '📋' },
];

export default function Penaltis({ jugadores, penaltis, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [jugadorId, setJugadorId] = useState('');
  const [tipo, setTipo] = useState('falta_injustificada');
  const [monto, setMonto] = useState('1');
  const [descripcion, setDescripcion] = useState('');

  const tipoActual = TIPOS.find(t => t.value === tipo);

  const activos = jugadores.filter(j => j.activo !== false);

  async function guardar() {
    if (!jugadorId || !monto) return;
    const j = jugadores.find(x => x.id === jugadorId);
    await addDoc(collection(db, 'penaltis'), {
      jugadorId,
      nombre: j?.nombre ?? 'Desconocido',
      tipo,
      monto: parseInt(monto, 10),
      descripcion: descripcion.trim(),
      pagado: false,
      createdAt: serverTimestamp(),
    });
    setShowForm(false);
    setJugadorId('');
    setMonto('1');
    setDescripcion('');
    setTipo('falta_injustificada');
  }

  async function togglePagado(p) {
    await updateDoc(doc(db, 'penaltis', p.id), { pagado: !p.pagado });
  }

  const pendientes = penaltis.filter(p => !p.pagado);
  const cobradas   = penaltis.filter(p => p.pagado);
  const totalDoces = pendientes.filter(p => TIPOS.find(t => t.value === p.tipo)?.esDoce).reduce((s, p) => s + (p.monto ?? 0), 0);

  // Group pending by player, preserving insertion order
  const grupos = [];
  const seenIds = {};
  pendientes.forEach(p => {
    if (!seenIds[p.jugadorId]) {
      seenIds[p.jugadorId] = { nombre: p.nombre, total: 0, doces: 0, items: [] };
      grupos.push(p.jugadorId);
    }
    const t = TIPOS.find(x => x.value === p.tipo);
    seenIds[p.jugadorId].items.push(p);
    if (t?.esDoce) seenIds[p.jugadorId].doces += p.monto ?? 0;
  });

  // All-time deuda summary per player (pending only)
  const deudaSummary = Object.entries(seenIds)
    .map(([id, info]) => ({
      id,
      nombre: info.nombre,
      doces: info.doces,
      count: info.items.length,
    }))
    .sort((a, b) => b.doces - a.doces || b.count - a.count);

  return (
    <div className="page">
      <div className="page-title">🟨 <span>Penaltis</span></div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div className="stat-box">
          <div className="stat-num" style={{ color: 'var(--red2)' }}>{pendientes.length}</div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-box">
          <div className="stat-num" style={{ letterSpacing: 0 }}>🍺 ×{totalDoces}</div>
          <div className="stat-label">Doces pendientes</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="section-label" style={{ marginBottom: 0, marginTop: 0, border: 'none' }}>
          {pendientes.length > 0 ? `Deudas (${pendientes.length})` : 'Sin deudas'}
        </div>
        <button className="btn btn-gold btn-sm" onClick={() => setShowForm(true)}>+ Penalti</button>
      </div>

      {pendientes.length === 0 && cobradas.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🟩</span>
          <div className="empty-text">Sin penaltis registrados</div>
        </div>
      )}

      {/* Grouped pending penalties */}
      {grupos.map(jugId => {
        const info = seenIds[jugId];
        const j = jugadores.find(x => x.id === jugId);
        const cfg = POSICION_CONFIG[j?.posicion] ?? POSICION_CONFIG.defensa;
        return (
          <div key={jugId} style={{ marginBottom: 12 }}>
            {/* Player header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, padding: '0 2px' }}>
              <div className="player-avatar" style={{ width: 28, height: 28, minWidth: 28, fontSize: 11, borderColor: cfg.color, color: cfg.color }}>
                {getInitials(info.nombre)}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text1)', flex: 1 }}>{info.nombre}</div>
              {info.doces > 0 && (
                <div style={{ fontSize: 11, fontFamily: 'Rajdhani', fontWeight: 700, color: 'var(--red2)', letterSpacing: 0 }}>
                  🍺 ×{info.doces}
                </div>
              )}
            </div>
            {/* Individual penalty cards indented */}
            <div style={{ paddingLeft: 36 }}>
              {info.items.map(p => <PenaltiCard key={p.id} p={p} onToggle={togglePagado} showName={false} />)}
            </div>
          </div>
        );
      })}

      {cobradas.length > 0 && (
        <>
          <div className="section-label">Pagadas ({cobradas.length})</div>
          {cobradas.map(p => <PenaltiCard key={p.id} p={p} onToggle={togglePagado} />)}
        </>
      )}

      {showForm && createPortal(
        <div className="overlay" style={{ alignItems: 'center', padding: '0 12px' }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ borderRadius: 16, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div className="modal-title">
              Nueva Penalti
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Jugador</label>
              <select
                className="form-input"
                value={jugadorId}
                onChange={e => setJugadorId(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {activos.map(j => (
                  <option key={j.id} value={j.id}>{j.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    className={`pos-option ${tipo === t.value ? 'selected' : ''}`}
                    onClick={() => { setTipo(t.value); setMonto(t.esDoce ? '1' : ''); }}
                    style={{ flex: 1, fontSize: 10 }}
                  >
                    {t.emoji}<br />{t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                {tipoActual?.esDoce ? 'Cantidad de doces 🍺' : 'Monto (S/)'}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  className="form-input"
                  type="number"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  placeholder={tipoActual?.esDoce ? 'Ej: 1' : 'Ej: 20'}
                  min="1"
                  style={{ flex: 1 }}
                />
                <span style={{
                  fontSize: 13, fontWeight: 700, fontFamily: 'Rajdhani',
                  color: 'var(--text3)', letterSpacing: 0.5, flexShrink: 0,
                }}>
                  {tipoActual?.esDoce ? '🍺 doces' : 'S/'}
                </span>
              </div>
              {tipoActual?.esDoce && (
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, fontFamily: 'Rajdhani' }}>
                  Falta injustificada = 1 doce de cerveza para la parrilla
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Descripción (opcional)</label>
              <input
                className="form-input"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Ej: Canceló 2 horas antes"
              />
            </div>

            <button
              className="btn btn-gold btn-full"
              onClick={guardar}
              disabled={!jugadorId || !monto}
              style={{ marginTop: 4 }}
            >
              Registrar penalti
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function PenaltiCard({ p, onToggle, showName = true }) {
  const tipoInfo = TIPOS.find(t => t.value === p.tipo) ?? TIPOS[TIPOS.length - 1];
  const esDoce = tipoInfo.esDoce;
  const fecha = p.createdAt?.toDate?.()
    ? p.createdAt.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    : '';

  return (
    <div className={`penalty-card ${p.pagado ? 'pagado' : ''}`}>
      <div style={{ fontSize: 22 }}>{tipoInfo.emoji}</div>
      <div className="penalty-info">
        {showName && <div className="penalty-name">{p.nombre}</div>}
        <div className="penalty-meta">{tipoInfo.label}{fecha ? ` · ${fecha}` : ''}</div>
        {p.descripcion && <div className="penalty-meta" style={{ fontStyle: 'italic' }}>{p.descripcion}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {esDoce ? (
          <div className="penalty-amount" style={{ letterSpacing: 0 }}>
            🍺 ×{p.monto ?? 1}
          </div>
        ) : (
          <div className="penalty-amount">S/ {(p.monto ?? 0).toLocaleString()}</div>
        )}
        <button
          className={`btn btn-sm ${p.pagado ? 'btn-outline' : 'btn-gold'}`}
          onClick={() => onToggle(p)}
          style={{ fontSize: 10, padding: '4px 10px' }}
        >
          {p.pagado ? (esDoce ? 'Trajo' : 'Pagado') : 'Pagó'}
        </button>
      </div>
    </div>
  );
}
