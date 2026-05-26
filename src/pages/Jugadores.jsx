import { useState } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getInitials, POSICION_GRUPOS, POSICION_DETALLADA, getPosicionConfig, getCategoriaBase } from '../utils';

/* FUT-style overall rating per BASE category */
const POS_OVERALL = {
  portero: 78, defensa: 74, mediocampo: 76, delantero: 79,
  // Detailed overrides — some get special overall boosts
  POR: 78,
  LTI: 73, LTD: 73, DFCi: 75, DFCd: 75,
  MDC: 76, MC: 77, MOC: 78, MCI: 74, MCD: 74,
  DC: 80, EXI: 78, EXD: 78, SD: 77,
};

/* FUT-style stats per detailed position — PAC SHO PAS DRI DEF PHY */
const POS_STATS = {
  // Legacy base categories (fallback)
  portero:    { PAC: 55, SHO: 30, PAS: 52, DRI: 48, DEF: 82, PHY: 75 },
  defensa:    { PAC: 70, SHO: 45, PAS: 62, DRI: 58, DEF: 78, PHY: 76 },
  mediocampo: { PAC: 74, SHO: 62, PAS: 80, DRI: 75, DEF: 64, PHY: 70 },
  delantero:  { PAC: 83, SHO: 82, PAS: 68, DRI: 79, DEF: 38, PHY: 72 },
  // Detailed FIFA positions
  POR:  { PAC: 55, SHO: 30, PAS: 52, DRI: 48, DEF: 82, PHY: 75 },
  DFCi: { PAC: 68, SHO: 40, PAS: 60, DRI: 54, DEF: 82, PHY: 80 },
  DFCd: { PAC: 68, SHO: 40, PAS: 60, DRI: 54, DEF: 82, PHY: 80 },
  LTI:  { PAC: 82, SHO: 55, PAS: 70, DRI: 70, DEF: 72, PHY: 74 },
  LTD:  { PAC: 82, SHO: 55, PAS: 70, DRI: 70, DEF: 72, PHY: 74 },
  MDC:  { PAC: 70, SHO: 52, PAS: 76, DRI: 64, DEF: 78, PHY: 80 },
  MC:   { PAC: 74, SHO: 65, PAS: 82, DRI: 74, DEF: 62, PHY: 72 },
  MOC:  { PAC: 76, SHO: 74, PAS: 82, DRI: 80, DEF: 44, PHY: 64 },
  MCI:  { PAC: 80, SHO: 68, PAS: 78, DRI: 78, DEF: 52, PHY: 66 },
  MCD:  { PAC: 80, SHO: 68, PAS: 78, DRI: 78, DEF: 52, PHY: 66 },
  DC:   { PAC: 80, SHO: 86, PAS: 66, DRI: 78, DEF: 32, PHY: 76 },
  EXI:  { PAC: 90, SHO: 78, PAS: 70, DRI: 86, DEF: 30, PHY: 66 },
  EXD:  { PAC: 90, SHO: 78, PAS: 70, DRI: 86, DEF: 30, PHY: 66 },
  SD:   { PAC: 78, SHO: 80, PAS: 74, DRI: 76, DEF: 40, PHY: 68 },
};

/* Card rarity tier by overall */
function getCardTier(overall) {
  if (overall >= 85) return 'elite';
  if (overall >= 75) return 'gold';
  if (overall >= 65) return 'silver';
  return 'bronze';
}

export default function Jugadores({ jugadores }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [nombre, setNombre]     = useState('');
  const [posicion, setPosicion] = useState('DC');
  const [revealId, setRevealId] = useState(null);

  function openNew() {
    setEditId(null); setNombre(''); setPosicion('DC'); setShowForm(true);
  }

  function openEdit(j) {
    setEditId(j.id); setNombre(j.nombre); setPosicion(j.posicion); setShowForm(true);
  }

  async function guardar() {
    if (!nombre.trim()) return;
    if (editId) {
      await updateDoc(doc(db, 'jugadores', editId), { nombre: nombre.trim(), posicion });
    } else {
      await addDoc(collection(db, 'jugadores'), {
        nombre: nombre.trim(), posicion, activo: true, createdAt: serverTimestamp(),
      });
    }
    setShowForm(false);
  }

  async function toggleActivo(j) {
    await updateDoc(doc(db, 'jugadores', j.id), { activo: !j.activo });
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
                onEdit={openEdit}
                onToggle={toggleActivo}
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
                onEdit={openEdit}
                onToggle={toggleActivo}
                revealed={revealId === j.id}
                onReveal={() => setRevealId(revealId === j.id ? null : j.id)}
                animDelay={idx * 60}
              />
            ))}
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
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
              <div className="pos-grouped-selector">
                {POSICION_GRUPOS.map(({ grupo, posiciones }) => (
                  <div key={grupo} className="pos-group-block">
                    <div className="pos-group-title">{grupo}</div>
                    <div className="pos-group-row">
                      {posiciones.map(p => {
                        const cfg = POSICION_DETALLADA[p];
                        const sel = posicion === p;
                        return (
                          <button
                            key={p}
                            className={`pos-detail-btn ${sel ? 'selected' : ''}`}
                            onClick={() => setPosicion(p)}
                            title={cfg.nombre}
                            style={sel ? {
                              borderColor: cfg.color,
                              color: cfg.color,
                              background: cfg.bg,
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
              {/* Show selected position name */}
              {posicion && POSICION_DETALLADA[posicion] && (
                <div style={{
                  marginTop: 8, fontSize: 11, color: POSICION_DETALLADA[posicion].color,
                  fontFamily: 'Rajdhani', fontWeight: 700, letterSpacing: 1,
                  textAlign: 'center', textTransform: 'uppercase',
                }}>
                  {POSICION_DETALLADA[posicion].nombre}
                </div>
              )}
            </div>

            <button className="btn btn-gold btn-full" onClick={guardar} style={{ marginTop: 4 }}>
              {editId ? 'Guardar cambios' : 'Agregar jugador'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FutCard({ j, onEdit, onToggle, revealed, onReveal, animDelay }) {
  const cfg     = getPosicionConfig(j.posicion);
  const overall = POS_OVERALL[j.posicion] ?? POS_OVERALL[getCategoriaBase(j.posicion)] ?? 72;
  const stats   = POS_STATS[j.posicion] ?? POS_STATS[getCategoriaBase(j.posicion)] ?? POS_STATS.defensa;
  const tier    = getCardTier(overall);
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
      <div className="fut-card-inner">
        {/* Top row: overall + pos + flag */}
        <div className="fut-card-top">
          <div>
            <div className="fut-card-overall">{overall}</div>
            <div className="fut-card-pos">{cfg.label}</div>
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
            className={`fut-card-action-btn ${j.activo !== false ? 'active' : ''}`}
            onClick={e => { e.stopPropagation(); onToggle(j); }}
          >
            {j.activo !== false ? 'Activo' : 'Inactivo'}
          </button>
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
