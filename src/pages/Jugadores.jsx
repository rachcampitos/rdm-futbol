import { useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getInitials, POSICION_GRUPOS, POSICION_DETALLADA, getPosicionConfig, getPosicionLabel, calcStats, getRating, getCardTier } from '../utils';

const STAT_KEYS   = ['pac', 'tir', 'pas', 'reg', 'def', 'fis'];
const STAT_LABELS = { pac: 'PAC', tir: 'TIR', pas: 'PAS', reg: 'REG', def: 'DEF', fis: 'FIS' };
const STAT_NAMES  = { pac: 'Velocidad', tir: 'Tiro', pas: 'Pase', reg: 'Regate', def: 'Defensa', fis: 'Físico' };
const STAT_BUDGET = 450;
const STAT_MIN    = 40;
const STAT_MAX    = 99;


export default function Jugadores({ jugadores, isAdmin, rachasMap = {}, weeklyMvpId = null }) {
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState(null);
  const [nombre, setNombre]           = useState('');
  const [posiciones, setPosiciones]   = useState(['DC']);
  const [cardVariant, setCardVariant] = useState(null);
  const [editStats, setEditStats]     = useState(() => Object.fromEntries(STAT_KEYS.map(k => [k, 75])));
  const [revealId, setRevealId]       = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // holds the jugador to delete

  const totalUsado = STAT_KEYS.reduce((s, k) => s + editStats[k], 0);
  const ptsLibres  = STAT_BUDGET - totalUsado;
  const budgetColor = ptsLibres === 0 ? '#ef4444' : ptsLibres <= 10 ? '#f59e0b' : '#10b981';

  function setStat(key, delta) {
    setEditStats(prev => {
      const cur    = prev[key];
      const newVal = Math.max(STAT_MIN, Math.min(STAT_MAX, cur + delta));
      const diff   = newVal - cur;
      if (diff > 0 && ptsLibres < diff) return prev;
      return { ...prev, [key]: newVal };
    });
  }

  function setStatSlider(key, val) {
    const newVal = Number(val);
    const diff   = newVal - editStats[key];
    if (diff > 0 && ptsLibres < diff) return;
    setEditStats(prev => ({ ...prev, [key]: newVal }));
  }

  function togglePosicion(p) {
    setPosiciones(prev => {
      if (prev.includes(p)) {
        if (prev.length === 1) return prev;
        return prev.filter(pos => pos !== p);
      }
      if (prev.length >= 3) return prev;
      return [...prev, p];
    });
  }

  function openNew() {
    setEditId(null); setNombre(''); setPosiciones(['DC']);
    setCardVariant(null);
    setEditStats(Object.fromEntries(STAT_KEYS.map(k => [k, 75])));
    setShowForm(true);
  }

  function openEdit(j) {
    setEditId(j.id); setNombre(j.nombre);
    setPosiciones([j.posicion, ...(j.posicionesAlt ?? [])]);
    setCardVariant(j.cardVariant ?? null);
    const computed = calcStats(j);
    setEditStats(Object.fromEntries(STAT_KEYS.map(k => [k, computed[k]])));
    setShowForm(true);
  }

  async function guardar() {
    if (!nombre.trim()) return;
    if (editId) {
      await updateDoc(doc(db, 'jugadores', editId), {
        nombre: nombre.trim(),
        posicion: posiciones[0],
        posicionesAlt: posiciones.slice(1),
        ...editStats,
        cardVariant: cardVariant ?? null,
      });
    } else {
      await addDoc(collection(db, 'jugadores'), {
        nombre: nombre.trim(),
        posicion: posiciones[0],
        posicionesAlt: posiciones.slice(1),
        activo: true, createdAt: serverTimestamp(),
      });
    }
    setShowForm(false);
  }

  async function toggleActivo(j) {
    await updateDoc(doc(db, 'jugadores', j.id), { activo: !j.activo });
  }

  async function eliminarJugador(j) {
    setConfirmarEliminar(j);
  }

  async function confirmarEliminarJugador() {
    if (!confirmarEliminar) return;
    await deleteDoc(doc(db, 'jugadores', confirmarEliminar.id));
    setConfirmarEliminar(null);
  }

  const activos   = jugadores.filter(j => j.activo !== false);
  const inactivos = jugadores.filter(j => j.activo === false);

  return (
    <div className="page">
      <div className="page-title">
        <span style={{ fontSize: 18 }}>👥</span>
        <span>Roster</span>
      </div>

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ color: 'var(--gold)', fontWeight: 700, fontFamily: 'Rajdhani', fontSize: 18 }}>{activos.length}</span>
          <span style={{ fontSize: 11, marginLeft: 4, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)' }}>jugadores activos</span>
        </div>
        <button className="btn btn-gold btn-sm" onClick={openNew}>+ Agregar</button>
      </div>

      {activos.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">⚽</span>
          <div className="empty-text">Agrega los jugadores del grupo</div>
        </div>
      )}

      {activos.length > 0 && (
        <>
          <div className="section-label">Activos</div>
          <div className="fut-card-grid">
            {activos.map((j, idx) => (
              <FutCard
                key={j.id}
                j={j}
                racha={rachasMap[j.id] ?? 0}
                isMvp={weeklyMvpId === j.id}
                onEdit={openEdit}
                onToggle={toggleActivo}
                onEliminar={isAdmin ? eliminarJugador : null}
                revealed={revealId === j.id}
                onReveal={() => setRevealId(revealId === j.id ? null : j.id)}
                animDelay={idx * 60}
              />
            ))}
          </div>
        </>
      )}

      {inactivos.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 16 }}>Inactivos</div>
          <div className="fut-card-grid">
            {inactivos.map((j, idx) => (
              <FutCard
                key={j.id}
                j={j}
                racha={rachasMap[j.id] ?? 0}
                isMvp={weeklyMvpId === j.id}
                onEdit={openEdit}
                onToggle={toggleActivo}
                onEliminar={isAdmin ? eliminarJugador : null}
                revealed={revealId === j.id}
                onReveal={() => setRevealId(revealId === j.id ? null : j.id)}
                animDelay={idx * 60}
              />
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {confirmarEliminar && createPortal(
        <div className="overlay" style={{ alignItems: 'center', padding: '0 12px' }} onClick={() => setConfirmarEliminar(null)}>
          <div className="modal" style={{ borderRadius: 16, maxWidth: 320 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ color: '#ef4444' }}>
              Eliminar jugador
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.5 }}>
              ¿Eliminar a <strong style={{ color: 'var(--text)' }}>{confirmarEliminar.nombre}</strong> permanentemente? Esta acción no se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-outline btn-full"
                onClick={() => setConfirmarEliminar(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-full"
                onClick={confirmarEliminarJugador}
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add / Edit modal */}
      {showForm && createPortal(
        <div className="overlay" style={{ alignItems: 'center', padding: '0 12px' }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ borderRadius: 16, maxHeight: '92dvh', overflowY: 'auto' }}>
            <div className="modal-title">
              {editId ? 'Editar Jugador' : 'Nuevo Jugador'}
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                className="form-input"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Carlos Ramírez"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && guardar()}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Posición preferida</label>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'Rajdhani', letterSpacing: 0.5, marginBottom: 6 }}>
                Toca para seleccionar — primera = principal, hasta 3 posiciones
              </div>
              <div className="pos-grouped-selector">
                {POSICION_GRUPOS.map(({ grupo, posiciones: posPorGrupo }) => (
                  <div key={grupo} className="pos-group-block">
                    <div className="pos-group-title">{grupo}</div>
                    <div className="pos-group-row">
                      {posPorGrupo.map(p => {
                        const cfg = POSICION_DETALLADA[p];
                        const selIdx = posiciones.indexOf(p);
                        const isPrimary = selIdx === 0;
                        const isAlt = selIdx > 0;
                        return (
                          <button
                            key={p}
                            className={`pos-detail-btn ${selIdx !== -1 ? 'selected' : ''}`}
                            onClick={() => togglePosicion(p)}
                            title={cfg.nombre}
                            style={isPrimary ? {
                              borderColor: cfg.color,
                              color: cfg.color,
                              background: cfg.bg,
                            } : isAlt ? {
                              borderColor: `${cfg.color}66`,
                              color: `${cfg.color}99`,
                              background: cfg.bg,
                              opacity: 0.75,
                            } : {}}
                          >
                            <span className="pos-detail-code">{p}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {/* Selected positions display */}
              {posiciones.length > 0 && (
                <div style={{
                  marginTop: 8, fontFamily: 'Rajdhani', fontWeight: 700,
                  letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase',
                  display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
                }}>
                  {posiciones.map((p, i) => (
                    <span key={p} style={{
                      fontSize: 11,
                      color: i === 0 ? POSICION_DETALLADA[p]?.color : 'var(--text3)',
                    }}>
                      {i === 0 ? '★ ' : '· '}{POSICION_DETALLADA[p]?.nombre}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Stats editor — only when editing an existing player */}
            {editId && (
              <div className="form-group">
                <label className="form-label">Stats de la tarjeta</label>

                {/* Budget bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase' }}>
                      Presupuesto
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: budgetColor, fontFamily: 'Rajdhani, sans-serif' }}>
                      {totalUsado} / {STAT_BUDGET}
                      {ptsLibres > 0
                        ? <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · {ptsLibres} libres</span>
                        : <span style={{ color: '#ef4444' }}> · ¡Lleno!</span>}
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${(totalUsado / STAT_BUDGET) * 100}%`,
                      background: budgetColor,
                      transition: 'width 0.15s, background 0.2s',
                    }} />
                  </div>
                </div>

                {STAT_KEYS.map(key => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1 }}>
                        {STAT_LABELS[key]}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif' }}>
                        {STAT_NAMES[key]}
                      </div>
                    </div>
                    <button
                      onClick={() => setStat(key, -1)}
                      disabled={editStats[key] <= STAT_MIN}
                      style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text2)', fontSize: 16, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: editStats[key] <= STAT_MIN ? 0.3 : 1,
                      }}
                    >−</button>
                    <input
                      type="range" min={STAT_MIN} max={STAT_MAX}
                      value={editStats[key]}
                      onChange={e => setStatSlider(key, e.target.value)}
                      style={{ flex: 1, accentColor: 'var(--gold)', height: 4 }}
                    />
                    <button
                      onClick={() => setStat(key, 1)}
                      disabled={ptsLibres === 0 || editStats[key] >= STAT_MAX}
                      style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text2)', fontSize: 16, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: (ptsLibres === 0 || editStats[key] >= STAT_MAX) ? 0.3 : 1,
                      }}
                    >+</button>
                    <div style={{
                      width: 32, textAlign: 'right', flexShrink: 0,
                      fontSize: 18, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif',
                      color: editStats[key] >= 85 ? '#f0c040' : editStats[key] >= 70 ? 'var(--text)' : 'var(--text3)',
                    }}>
                      {editStats[key]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Admin: special card variant */}
            {isAdmin && editId && (
              <div className="form-group">
                <label className="form-label">Tarjeta especial</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { value: null,   label: 'Normal',  desc: 'Estándar',     color: 'var(--text3)' },
                    { value: 'toty', label: '🏆 TOTY',  desc: 'Team of Year', color: '#60a5fa' },
                  ].map(opt => {
                    const sel = cardVariant === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        onClick={() => setCardVariant(opt.value)}
                        style={{
                          flex: 1, padding: '8px 4px', borderRadius: 8,
                          border: `1.5px solid ${sel ? opt.color : 'rgba(255,255,255,0.1)'}`,
                          background: sel ? `${opt.color}18` : 'rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: sel ? opt.color : 'var(--text2)', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>
                          {opt.label}
                        </span>
                        <span style={{ fontSize: 8, color: 'var(--text3)', fontFamily: 'Rajdhani' }}>
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button className="btn btn-gold btn-full" onClick={guardar} style={{ marginTop: 4 }}>
              {editId ? 'Guardar cambios' : 'Agregar jugador'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function FutCard({ j, racha, isMvp, onEdit, onToggle, onEliminar, revealed, onReveal, animDelay }) {
  const cfg     = getPosicionConfig(j.posicion);
  const overall = getRating(j);
  const { pac, tir, pas, reg, def, fis } = calcStats(j);
  const stats = { PAC: pac, TIR: tir, PAS: pas, REG: reg, DEF: def, FIS: fis };
  const tier    = isMvp ? 'inform' : (j.cardVariant ?? getCardTier(overall));
  const inactive = j.activo === false;

  const shortName = (() => {
    const parts = j.nombre.trim().split(' ');
    if (parts.length === 1) return parts[0].toUpperCase();
    if (parts[0].length <= 6) return `${parts[0]} ${parts[1][0]}.`.toUpperCase();
    return parts[0].toUpperCase();
  })();

  return (
    <div
      className={`fut-card fut-card-${tier} ${inactive ? 'fut-card-inactive' : ''} card-reveal`}
      style={{ animationDelay: `${animDelay}ms` }}
      onClick={onReveal}
    >
      {racha >= 2 && (
        <div style={{
          position: 'absolute', top: 5, right: 5, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 1,
          fontSize: 8, fontWeight: 800, fontFamily: 'Rajdhani',
          color: '#f97316', lineHeight: 1,
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))',
        }}>
          🔥{racha}
        </div>
      )}
      <div className="fut-card-inner">
        {/* Top row: overall + pos + flag */}
        <div className="fut-card-top">
          <div>
            <div className="fut-card-overall">{overall}</div>
            <div className="fut-card-pos">{cfg.label}</div>
            {(j.posicionesAlt ?? []).length > 0 && (
              <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)', fontFamily: 'Rajdhani', letterSpacing: 0.3, lineHeight: 1, marginTop: 1, textAlign: 'center' }}>
                {j.posicionesAlt.map(p => getPosicionLabel(p)).join('·')}
              </div>
            )}
          </div>
          <div className="fut-card-flag">⚽</div>
        </div>

        {/* Avatar */}
        <div className="fut-card-avatar-wrap">
          <div
            className="fut-card-avatar"
            style={tier === 'gold' || tier === 'elite'
              ? { borderColor: 'rgba(240,192,64,0.5)', boxShadow: '0 0 16px rgba(240,192,64,0.25)' }
              : {}}
          >
            {getInitials(j.nombre)}
          </div>
        </div>

        {/* Name */}
        <div className="fut-card-name">{shortName}</div>

        {/* Divider */}
        <div className="fut-card-divider" />

        {/* Stats */}
        <div className="fut-card-stats">
          {Object.entries(stats).map(([key, val]) => (
            <div key={key} className="fut-card-stat">
              <div className="fut-card-stat-num">{val}</div>
              <div className="fut-card-stat-label">{key}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="fut-card-actions">
          <button
            className="fut-card-action-btn"
            onClick={e => { e.stopPropagation(); onEdit(j); }}
          >
            Editar
          </button>
          <button
            className={`fut-card-toggle ${j.activo !== false ? 'on' : 'off'}`}
            onClick={e => { e.stopPropagation(); onToggle(j); }}
            title={j.activo !== false ? 'Marcar como inactivo' : 'Reactivar jugador'}
          >
            <span className="fut-card-toggle-track">
              <span className="fut-card-toggle-thumb" />
            </span>
            <span className="fut-card-toggle-label">
              {j.activo !== false ? 'Activo' : 'Baja'}
            </span>
          </button>
          {onEliminar && (
            <button
              className="fut-card-action-btn"
              onClick={e => { e.stopPropagation(); onEliminar(j); }}
              style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.4)' }}
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Inactive overlay */}
      {inactive && (
        <div className="fut-card-inactive-overlay">
          <div className="fut-card-inactive-badge">BAJA</div>
        </div>
      )}
    </div>
  );
}
