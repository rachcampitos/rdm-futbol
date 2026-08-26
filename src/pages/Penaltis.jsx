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

// Reglas: con reemplazo = sin multa. Sin reemplazo = 1 doce (falta injustificada)
const TIPOS_SELF = [
  { value: 'con_reemplazo',       label: 'Tengo reemplazo',   emoji: '✅', sinMulta: true, desc: 'Coordiné reemplazo — sin multa' },
  { value: 'falta_injustificada', label: 'Sin reemplazo',     emoji: '🍺', esDoce: true,   desc: '1 doce para la parrilla' },
  { value: 'otro',                label: 'Otro motivo',       emoji: '📋',                 desc: 'El grupo decide la multa' },
];

export default function Penaltis({ jugadores, penaltis, isAdmin, jugadorActual, partido, weekId }) {
  // Admin form state
  const [showForm,     setShowForm]     = useState(false);
  const [jugadorId,    setJugadorId]    = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [tipo,         setTipo]         = useState('falta_injustificada');
  const [monto,        setMonto]        = useState('1');
  const [descripcion,  setDescripcion]  = useState('');

  // Self-service state
  const [showSelfForm, setShowSelfForm] = useState(false);
  const [selfTipo,     setSelfTipo]     = useState('cancelacion_tardia');
  const [selfDesc,     setSelfDesc]     = useState('');
  const [selfSaving,   setSelfSaving]   = useState(false);

  const tipoActual = TIPOS.find(t => t.value === tipo);
  const activos    = jugadores.filter(j => j.activo !== false);
  const filtrados  = activos.filter(j =>
    j.nombre.toLowerCase().includes(playerSearch.toLowerCase())
  );

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
    setPlayerSearch('');
    setMonto('1');
    setDescripcion('');
    setTipo('falta_injustificada');
  }

  async function reportarAusencia() {
    if (!jugadorActual?.id) return;
    setSelfSaving(true);
    try {
      const tipoSelf = TIPOS_SELF.find(t => t.value === selfTipo);

      // Solo crear penalti si hay multa (no crear para "con_reemplazo")
      if (!tipoSelf?.sinMulta) {
        await addDoc(collection(db, 'penaltis'), {
          jugadorId:     jugadorActual.id,
          nombre:        jugadorActual.nombre,
          tipo:          selfTipo,
          monto:         1,
          descripcion:   selfDesc.trim(),
          pagado:        false,
          createdAt:     serverTimestamp(),
          autoReportado: true,
        });
      }

      // Dar de baja en convocados si estaba confirmado esta semana
      if (partido && weekId) {
        const convocados = partido.convocados ?? [];
        const idx = convocados.findIndex(c => c.jugadorId === jugadorActual.id);
        if (idx !== -1 && convocados[idx].estado === 'confirmado') {
          const updated = [...convocados];
          updated[idx] = { ...updated[idx], estado: 'baja' };
          await updateDoc(doc(db, 'partidos', weekId), { convocados: updated });
        }
      }

      setShowSelfForm(false);
      setSelfDesc('');
    } finally {
      setSelfSaving(false);
    }
  }

  async function togglePagado(p) {
    await updateDoc(doc(db, 'penaltis', p.id), { pagado: !p.pagado });
  }

  const pendientes  = penaltis.filter(p => !p.pagado);
  const cobradas    = penaltis.filter(p => p.pagado);
  const totalDoces  = pendientes.filter(p => TIPOS.find(t => t.value === p.tipo)?.esDoce).reduce((s, p) => s + (p.monto ?? 0), 0);
  const misPenaltis = penaltis.filter(p => p.jugadorId === jugadorActual?.id && !p.pagado);

  // Group pending by player
  const grupos  = [];
  const seenIds = {};
  pendientes.forEach(p => {
    if (!seenIds[p.jugadorId]) {
      seenIds[p.jugadorId] = { nombre: p.nombre, doces: 0, items: [] };
      grupos.push(p.jugadorId);
    }
    const t = TIPOS.find(x => x.value === p.tipo);
    seenIds[p.jugadorId].items.push(p);
    if (t?.esDoce) seenIds[p.jugadorId].doces += p.monto ?? 0;
  });

  return (
    <div className="page">
      <div className="page-title">🟨 <span>Penaltis</span></div>

      {/* ── SELF-SERVICE: regular user only ── */}
      {!isAdmin && jugadorActual && (
        <div style={{
          marginBottom: 16,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.18)',
          borderRadius: 14, padding: '14px 14px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#f87171', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', marginBottom: 10 }}>
            ¿No puedes ir esta semana?
          </div>

          {!showSelfForm ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {TIPOS_SELF.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setSelfTipo(t.value); setShowSelfForm(true); }}
                  style={{
                    padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                    border: '1.5px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.08)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{t.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fca5a5', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3 }}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div>
              {/* Tipo seleccionado */}
              {(() => {
                const t = TIPOS_SELF.find(x => x.value === selfTipo);
                return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>{t?.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', fontFamily: 'Rajdhani, sans-serif' }}>
                    {t?.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Rajdhani' }}>{t?.desc}</div>
                  <button
                    onClick={() => setShowSelfForm(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 10, cursor: 'pointer', padding: 0, fontFamily: 'Rajdhani', letterSpacing: 0.5 }}
                  >
                    ← cambiar
                  </button>
                </div>
              </div>
                );
              })()}

              {/* Nota opcional */}
              <input
                className="form-input"
                value={selfDesc}
                onChange={e => setSelfDesc(e.target.value)}
                placeholder="Nota opcional (ej: lesión, trabajo...)"
                style={{ marginBottom: 10 }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-outline btn-full"
                  onClick={() => setShowSelfForm(false)}
                  disabled={selfSaving}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-full"
                  onClick={reportarAusencia}
                  disabled={selfSaving}
                  style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' }}
                >
                  {selfSaving
                    ? 'Guardando...'
                    : selfTipo === 'con_reemplazo'
                      ? 'Bajarme sin multa ✅'
                      : selfTipo === 'falta_injustificada'
                        ? 'Confirmar — debo 1 doce 🍺'
                        : 'Confirmar ausencia'}
                </button>
              </div>
            </div>
          )}

          {/* Mis penaltis pendientes */}
          {misPenaltis.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(239,68,68,0.15)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text3)', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', marginBottom: 8 }}>
                Mis faltas pendientes
              </div>
              {misPenaltis.map(p => <PenaltiCard key={p.id} p={p} onToggle={togglePagado} showName={false} />)}
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY ── */}
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
        {isAdmin && (
          <button className="btn btn-gold btn-sm" onClick={() => setShowForm(true)}>+ Penalti</button>
        )}
      </div>

      {pendientes.length === 0 && cobradas.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🟩</span>
          <div className="empty-text">Sin penaltis registrados</div>
        </div>
      )}

      {/* Grouped pending */}
      {grupos.map(jugId => {
        const info = seenIds[jugId];
        const j    = jugadores.find(x => x.id === jugId);
        const cfg  = POSICION_CONFIG[j?.posicion] ?? POSICION_CONFIG.defensa;
        return (
          <div key={jugId} style={{ marginBottom: 12 }}>
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
            <div style={{ paddingLeft: 36 }}>
              {info.items.map(p => <PenaltiCard key={p.id} p={p} onToggle={isAdmin ? togglePagado : null} showName={false} />)}
            </div>
          </div>
        );
      })}

      {cobradas.length > 0 && (
        <>
          <div className="section-label">Pagadas ({cobradas.length})</div>
          {cobradas.map(p => <PenaltiCard key={p.id} p={p} onToggle={isAdmin ? togglePagado : null} />)}
        </>
      )}

      {/* ── ADMIN FORM ── */}
      {showForm && createPortal(
        <div className="overlay" style={{ alignItems: 'center', padding: '0 12px' }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ borderRadius: 16, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div className="modal-title">
              Nueva penalti
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            {/* Player picker */}
            <div className="form-group">
              <label className="form-label">Jugador</label>
              <input
                className="form-input"
                value={playerSearch}
                onChange={e => { setPlayerSearch(e.target.value); setJugadorId(''); }}
                placeholder="Buscar jugador..."
                autoFocus
                style={{ marginBottom: 8 }}
              />
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filtrados.map(j => {
                  const cfg = POSICION_CONFIG[j.posicion] ?? POSICION_CONFIG.defensa;
                  const sel = jugadorId === j.id;
                  return (
                    <button
                      key={j.id}
                      onClick={() => { setJugadorId(j.id); setPlayerSearch(j.nombre); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        border: sel ? '1.5px solid rgba(240,192,64,0.7)' : '1px solid rgba(255,255,255,0.07)',
                        background: sel ? 'rgba(240,192,64,0.1)' : 'rgba(255,255,255,0.04)',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div className="player-avatar" style={{ width: 30, height: 30, minWidth: 30, fontSize: 11, borderColor: cfg.color, color: cfg.color, flexShrink: 0 }}>
                        {getInitials(j.nombre)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: sel ? 'var(--gold)' : 'var(--text)' }}>{j.nombre}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{j.posicion}</div>
                      </div>
                      {sel && <span style={{ color: 'var(--gold)', fontSize: 14 }}>✓</span>}
                    </button>
                  );
                })}
                {filtrados.length === 0 && (
                  <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: 'var(--text3)', fontFamily: 'Rajdhani' }}>
                    Sin resultados
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    className={`pos-option ${tipo === t.value ? 'selected' : ''}`}
                    onClick={() => { setTipo(t.value); setMonto(t.esDoce ? '1' : ''); }}
                    style={{ fontSize: 10, padding: '8px 4px' }}
                  >
                    {t.emoji} {t.label}
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
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Rajdhani', color: 'var(--text3)', letterSpacing: 0.5, flexShrink: 0 }}>
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
  const esDoce   = tipoInfo.esDoce;
  const fecha    = p.createdAt?.toDate?.()
    ? p.createdAt.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    : '';

  return (
    <div className={`penalty-card ${p.pagado ? 'pagado' : ''}`}>
      <div style={{ fontSize: 22 }}>{tipoInfo.emoji}</div>
      <div className="penalty-info">
        {showName && <div className="penalty-name">{p.nombre}</div>}
        <div className="penalty-meta">
          {tipoInfo.label}{fecha ? ` · ${fecha}` : ''}
          {p.autoReportado && <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--text3)', fontFamily: 'Rajdhani' }}>· auto-reportado</span>}
        </div>
        {p.descripcion && <div className="penalty-meta" style={{ fontStyle: 'italic' }}>{p.descripcion}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {esDoce ? (
          <div className="penalty-amount" style={{ letterSpacing: 0 }}>🍺 ×{p.monto ?? 1}</div>
        ) : (
          <div className="penalty-amount">S/ {(p.monto ?? 0).toLocaleString()}</div>
        )}
        {onToggle && (
          <button
            className={`btn btn-sm ${p.pagado ? 'btn-outline' : 'btn-gold'}`}
            onClick={() => onToggle(p)}
            style={{ fontSize: 10, padding: '4px 10px' }}
          >
            {p.pagado ? (esDoce ? 'Trajo' : 'Pagado') : 'Pagó'}
          </button>
        )}
      </div>
    </div>
  );
}
