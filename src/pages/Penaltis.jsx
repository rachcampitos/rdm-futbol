import { useState } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getInitials, POSICION_CONFIG } from '../utils';

const TIPOS = [
  { value: 'cancelacion_tardia', label: 'Cancelación tardía', emoji: '⏰' },
  { value: 'no_show',            label: 'No se presentó',    emoji: '👻' },
  { value: 'otro',               label: 'Otro',              emoji: '📋' },
];

export default function Penaltis({ jugadores, penaltis }) {
  const [showForm, setShowForm] = useState(false);
  const [jugadorId, setJugadorId] = useState('');
  const [tipo, setTipo] = useState('cancelacion_tardia');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');

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
    setMonto('');
    setDescripcion('');
    setTipo('cancelacion_tardia');
  }

  async function togglePagado(p) {
    await updateDoc(doc(db, 'penaltis', p.id), { pagado: !p.pagado });
  }

  const pendientes = penaltis.filter(p => !p.pagado);
  const cobradas   = penaltis.filter(p => p.pagado);
  const totalDeuda = pendientes.reduce((s, p) => s + (p.monto ?? 0), 0);

  // Group by player
  const porJugador = {};
  pendientes.forEach(p => {
    if (!porJugador[p.jugadorId]) porJugador[p.jugadorId] = { nombre: p.nombre, total: 0, count: 0 };
    porJugador[p.jugadorId].total += p.monto ?? 0;
    porJugador[p.jugadorId].count += 1;
  });

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
          <div className="stat-num">S/ {totalDeuda.toLocaleString()}</div>
          <div className="stat-label">Total deuda</div>
        </div>
      </div>

      {/* Debt per player */}
      {Object.keys(porJugador).length > 0 && (
        <>
          <div className="section-label">Deudores</div>
          {Object.entries(porJugador).map(([id, info]) => {
            const j = jugadores.find(x => x.id === id);
            const cfg = POSICION_CONFIG[j?.posicion] ?? POSICION_CONFIG.defensa;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, marginBottom: 7 }}>
                <div className="player-avatar" style={{ borderColor: cfg.color, color: cfg.color }}>
                  {getInitials(info.nombre)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{info.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{info.count} penalti{info.count > 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: 'var(--red2)' }}>
                  S/ {info.total.toLocaleString()}
                </div>
              </div>
            );
          })}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="section-label" style={{ marginBottom: 0, marginTop: 0, border: 'none' }}>
          Historial ({pendientes.length} pendientes)
        </div>
        <button className="btn btn-gold btn-sm" onClick={() => setShowForm(true)}>+ Penalti</button>
      </div>

      {pendientes.length === 0 && cobradas.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🟩</span>
          <div className="empty-text">Sin penaltis registrados</div>
        </div>
      )}

      {pendientes.map(p => <PenaltiCard key={p.id} p={p} onToggle={togglePagado} />)}

      {cobradas.length > 0 && (
        <>
          <div className="section-label">Cobradas ({cobradas.length})</div>
          {cobradas.map(p => <PenaltiCard key={p.id} p={p} onToggle={togglePagado} />)}
        </>
      )}

      {showForm && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
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
                    onClick={() => setTipo(t.value)}
                    style={{ flex: 1, fontSize: 10 }}
                  >
                    {t.emoji}<br />{t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Monto (S/)</label>
              <input
                className="form-input"
                type="number"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="Ej: 20"
              />
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
        </div>
      )}
    </div>
  );
}

function PenaltiCard({ p, onToggle }) {
  const tipoInfo = TIPOS.find(t => t.value === p.tipo) ?? TIPOS[2];
  const fecha = p.createdAt?.toDate?.()
    ? p.createdAt.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    : '';

  return (
    <div className={`penalty-card ${p.pagado ? 'pagado' : ''}`}>
      <div style={{ fontSize: 22 }}>{tipoInfo.emoji}</div>
      <div className="penalty-info">
        <div className="penalty-name">{p.nombre}</div>
        <div className="penalty-meta">{tipoInfo.label}{fecha ? ` · ${fecha}` : ''}</div>
        {p.descripcion && <div className="penalty-meta" style={{ fontStyle: 'italic' }}>{p.descripcion}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div className="penalty-amount">S/ {(p.monto ?? 0).toLocaleString()}</div>
        <button
          className={`btn btn-sm ${p.pagado ? 'btn-outline' : 'btn-gold'}`}
          onClick={() => onToggle(p)}
          style={{ fontSize: 10, padding: '4px 10px' }}
        >
          {p.pagado ? 'Cobrado' : 'Cobrar'}
        </button>
      </div>
    </div>
  );
}
