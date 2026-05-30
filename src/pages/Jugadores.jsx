import { useState, useRef } from 'react';
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
const heatColor = v => v >= 90 ? 'rgba(239,68,68,0.92)' : v >= 80 ? 'rgba(251,146,60,0.92)' : v >= 65 ? 'rgba(240,192,64,0.92)' : 'rgba(100,148,215,0.85)';
const statPct   = v => ((v - STAT_MIN) / (STAT_MAX - STAT_MIN)) * 100;

/* ── Player silhouette sprite (4×2 grid, 750×500px JPG) ── */
const POSE_MAP = {
  POR:  [1, 1], // lunge/reach — GK row1 col1
  LTI:  [0, 3], // full sprint
  LTD:  [0, 3], // full sprint
  DFCi: [1, 3], // wide defensive stance
  DFCd: [1, 3], // wide defensive stance
  MDC:  [1, 2], // low control / tackle
  MCI:  [0, 2], // running with ball
  MC:   [0, 2], // running with ball
  MCD:  [0, 2], // running with ball
  MOC:  [0, 1], // active dribble
  EXI:  [0, 0], // shooting
  EXD:  [0, 0], // shooting
  SD:   [0, 0], // shooting
  DC:   [0, 0], // shooting
};

function PlayerSilhouette({ posicion }) {
  const [row, col] = POSE_MAP[posicion] ?? [0, 1];
  const xPct = (col / 3) * 100;
  const yPct = row * 100;
  // invert(1): navy→warm-beige, white→black
  // brightness(3)+contrast(8): beige→white, black stays black → crisp white silhouette on black bg
  return (
    <div style={{
      width: '100%', height: '100%',
      backgroundImage: 'url(/silhouettes.jpg)',
      backgroundSize: '400% 200%',
      backgroundPosition: `${xPct}% ${yPct}%`,
      backgroundRepeat: 'no-repeat',
      filter: 'invert(1) brightness(3) contrast(8)',
      opacity: 0.62,
    }} />
  );
}

const RADAR_ANGLES = { pac: -90, tir: -30, pas: 30, reg: 90, def: 150, fis: 210 };
const RADAR_CX = 90, RADAR_CY = 90, RADAR_MAX_R = 58, RADAR_VB = 180;
const RAD = Math.PI / 180;

function RadarStatEditor({ stats, onSetStat, budget, min, max }) {
  const [dragging, setDragging] = useState(null);
  const svgRef = useRef(null);

  const total = STAT_KEYS.reduce((s, k) => s + stats[k], 0);
  const free  = budget - total;
  const budgetColor = free === 0 ? '#ef4444' : free <= 10 ? '#f59e0b' : '#10b981';

  function radarPt(key, val) {
    const a = RADAR_ANGLES[key] * RAD;
    const r = ((val - min) / (max - min)) * RADAR_MAX_R;
    return [RADAR_CX + r * Math.cos(a), RADAR_CY + r * Math.sin(a)];
  }

  function labelPt(key) {
    const a = RADAR_ANGLES[key] * RAD;
    const r = RADAR_MAX_R + 19;
    return [RADAR_CX + r * Math.cos(a), RADAR_CY + r * Math.sin(a)];
  }

  function gridPts(pct) {
    return STAT_KEYS.map(k => {
      const a = RADAR_ANGLES[k] * RAD;
      const r = pct * RADAR_MAX_R;
      return `${RADAR_CX + r * Math.cos(a)},${RADAR_CY + r * Math.sin(a)}`;
    }).join(' ');
  }

  const shapePts = STAT_KEYS.map(k => radarPt(k, stats[k]).join(',')).join(' ');

  function updateFromPointer(clientX, clientY) {
    if (!dragging) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = (clientX - rect.left) * (RADAR_VB / rect.width);
    const sy = (clientY - rect.top)  * (RADAR_VB / rect.height);
    const a  = RADAR_ANGLES[dragging] * RAD;
    const proj    = (sx - RADAR_CX) * Math.cos(a) + (sy - RADAR_CY) * Math.sin(a);
    const clamped = Math.max(0, Math.min(RADAR_MAX_R, proj));
    const newVal  = Math.round(min + (clamped / RADAR_MAX_R) * (max - min));
    const otherTotal = STAT_KEYS.reduce((s, k) => k === dragging ? s : s + stats[k], 0);
    onSetStat(dragging, Math.max(min, Math.min(Math.min(max, budget - otherTotal), newVal)));
  }

  const onMove = e => {
    if (!dragging) return;
    e.preventDefault();
    const t = e.touches?.[0];
    updateFromPointer(t?.clientX ?? e.clientX, t?.clientY ?? e.clientY);
  };

  return (
    <div className="form-group">
      <label className="form-label">Stats de la tarjeta</label>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase' }}>
            Presupuesto
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: budgetColor, fontFamily: 'Rajdhani, sans-serif' }}>
            {total} / {budget}
            {free > 0
              ? <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · {free} libres</span>
              : <span style={{ color: '#ef4444' }}> · ¡Lleno!</span>}
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${(total / budget) * 100}%`, background: budgetColor, transition: 'width 0.12s, background 0.2s' }} />
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${RADAR_VB} ${RADAR_VB}`}
        style={{ width: '100%', touchAction: 'none', userSelect: 'none', display: 'block' }}
        onMouseMove={onMove}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
        onTouchMove={onMove}
        onTouchEnd={() => setDragging(null)}
      >
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <polygon key={pct} points={gridPts(pct)} fill="none"
            stroke={pct === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}
            strokeWidth={pct === 1 ? 1 : 0.5} />
        ))}

        {/* Axis lines */}
        {STAT_KEYS.map(k => {
          const a = RADAR_ANGLES[k] * RAD;
          return <line key={k} x1={RADAR_CX} y1={RADAR_CY}
            x2={RADAR_CX + RADAR_MAX_R * Math.cos(a)} y2={RADAR_CY + RADAR_MAX_R * Math.sin(a)}
            stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />;
        })}

        {/* Filled shape */}
        <polygon points={shapePts} fill="rgba(240,192,64,0.13)" stroke="rgba(240,192,64,0.75)" strokeWidth="1" strokeLinejoin="round" />

        {/* Vertex handles + labels */}
        {STAT_KEYS.map(k => {
          const [px, py] = radarPt(k, stats[k]);
          const [lx, ly] = labelPt(k);
          return (
            <g key={k}>
              <circle cx={px} cy={py} r={11} fill="transparent"
                style={{ cursor: dragging === k ? 'grabbing' : 'grab' }}
                onMouseDown={e => { e.stopPropagation(); setDragging(k); }}
                onTouchStart={e => { e.stopPropagation(); setDragging(k); }} />
              <circle cx={px} cy={py} r={3.5}
                fill={dragging === k ? '#ffffff' : 'rgba(240,192,64,0.95)'}
                stroke="rgba(0,0,0,0.5)" strokeWidth="1"
                style={{ pointerEvents: 'none', transition: 'fill 0.1s' }} />
              <text x={lx} y={ly - 3} textAnchor="middle" fontSize="6.5"
                fontFamily="Rajdhani, sans-serif" fontWeight="700" fill="rgba(255,255,255,0.65)"
                style={{ pointerEvents: 'none' }}>{STAT_LABELS[k]}</text>
              <text x={lx} y={ly + 6} textAnchor="middle" fontSize="9.5"
                fontFamily="Rajdhani, sans-serif" fontWeight="700" fill={heatColor(stats[k])}
                style={{ pointerEvents: 'none' }}>{stats[k]}</text>
            </g>
          );
        })}

        <circle cx={RADAR_CX} cy={RADAR_CY} r={1.5} fill="rgba(255,255,255,0.12)" style={{ pointerEvents: 'none' }} />
      </svg>
    </div>
  );
}

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
              <RadarStatEditor
                stats={editStats}
                onSetStat={(key, val) => setEditStats(prev => ({ ...prev, [key]: val }))}
                budget={STAT_BUDGET}
                min={STAT_MIN}
                max={STAT_MAX}
              />
            )}

            {/* Admin: special card variant */}
            {isAdmin && editId && (
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Carta especial</label>
                  <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '1px 5px', fontFamily: 'Rajdhani', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Solo admin
                  </span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Rajdhani', marginBottom: 10, lineHeight: 1.5 }}>
                  Sobreescribe el color de la tarjeta. Usalo para reconocimientos — MVP, figura del torneo, racha activa.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {[
                    { value: null,     emoji: '⚙️',  label: 'Automático', desc: 'Bronce / Plata / Oro según stats', swatch: 'linear-gradient(135deg,#7a5000,#f0c040)' },
                    { value: 'toty',   emoji: '🏆',  label: 'Figura',     desc: 'MVP · Mejor del torneo',            swatch: 'linear-gradient(135deg,#001058,#1040c0)' },
                    { value: 'inform', emoji: '🔥',  label: 'En racha',   desc: 'Jugador destacado de la semana',    swatch: 'linear-gradient(135deg,#650014,#e0003a)' },
                  ].map(opt => {
                    const sel = cardVariant === opt.value;
                    return (
                      <button
                        key={String(opt.value)}
                        onClick={() => setCardVariant(opt.value)}
                        style={{
                          padding: '8px 4px 7px', borderRadius: 8, cursor: 'pointer',
                          border: sel ? '2px solid rgba(240,192,64,0.7)' : '1.5px solid rgba(255,255,255,0.08)',
                          background: sel ? 'rgba(240,192,64,0.1)' : 'rgba(255,255,255,0.03)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        <div style={{ width: 28, height: 6, borderRadius: 3, background: opt.swatch }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: sel ? 'var(--gold)' : 'var(--text2)', fontFamily: 'Rajdhani', letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1 }}>
                          {opt.emoji} {opt.label}
                        </span>
                        <span style={{ fontSize: 7.5, color: 'var(--text3)', fontFamily: 'Rajdhani', textAlign: 'center', lineHeight: 1.3 }}>
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
      onMouseMove={e => {
        const r  = e.currentTarget.getBoundingClientRect();
        const mx = (e.clientX - r.left) / r.width;
        const my = (e.clientY - r.top)  / r.height;
        e.currentTarget.style.setProperty('--mx', mx.toFixed(3));
        e.currentTarget.style.setProperty('--my', my.toFixed(3));
        const rx = (my - 0.5) * 14;
        const ry = (mx - 0.5) * -14;
        e.currentTarget.style.transform = `perspective(450px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px) scale(1.04)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.removeProperty('--mx');
        e.currentTarget.style.removeProperty('--my');
        e.currentTarget.style.transform = '';
      }}
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
          <div className="fut-card-avatar">
            <PlayerSilhouette posicion={j.posicion} />
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
