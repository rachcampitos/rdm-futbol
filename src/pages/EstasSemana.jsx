import { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getWeekId, getInitials, formatFecha, getPosicionConfig, getPosicionLabel } from '../utils';

function getRating(jugador) {
  // Derive an overall from whatever fields exist, fallback to position-based estimate
  if (jugador.overall) return jugador.overall;
  const base = { portero: 72, defensa: 68, mediocampo: 70, delantero: 74 };
  const cat = jugador.categoria ?? jugador.posicion ?? 'mediocampo';
  return base[cat] ?? 70;
}

function getCardTier(overall) {
  if (overall >= 85) return 'elite';
  if (overall >= 75) return 'gold';
  if (overall >= 65) return 'silver';
  return 'bronze';
}

export default function EstasSemana({ jugadores, partido, jugadorActual }) {
  const [cuotaEdit, setCuotaEdit] = useState(false);
  const [cuotaInput, setCuotaInput] = useState('');

  const weekId   = getWeekId();
  const cuota    = partido?.cuota ?? 5000;
  const convocados = partido?.convocados ?? [];

  const confirmados = convocados.filter(c => c.estado === 'confirmado');
  const pagados     = convocados.filter(c => c.pagado);
  const pendientes  = convocados.filter(c => c.estado !== 'confirmado');

  const convocadoMap = {};
  convocados.forEach(c => { convocadoMap[c.jugadorId] = c; });

  const activos = jugadores.filter(j => j.activo !== false);

  // Find current player in Firestore data (match by id stored in localStorage)
  const miJugador = jugadorActual
    ? activos.find(j => j.id === jugadorActual.id) ?? null
    : null;

  const miConv       = miJugador ? convocadoMap[miJugador.id] : null;
  const yoConfirmado = miConv?.estado === 'confirmado';
  const yoPague      = miConv?.pagado === true;

  async function ensurePartido() {
    if (!partido) {
      await setDoc(doc(db, 'partidos', weekId), {
        fecha: weekId,
        cuota: 5000,
        convocados: [],
        equipoA: [],
        equipoB: [],
        sorteoRealizado: false,
      });
    }
  }

  // Self-service toggle for the current player
  async function toggleMiAsistencia() {
    if (!miJugador) return;
    await ensurePartido();
    const ref  = doc(db, 'partidos', weekId);
    const base = partido?.convocados ?? [];
    const idx  = base.findIndex(c => c.jugadorId === miJugador.id);

    let nuevos;
    if (idx === -1) {
      // Not in list yet — add as confirmed
      nuevos = [...base, {
        jugadorId: miJugador.id,
        nombre: miJugador.nombre,
        posicion: miJugador.posicion,
        estado: 'confirmado',
        pagado: false,
      }];
    } else if (base[idx].estado === 'confirmado') {
      // Was confirmed → remove (baja)
      nuevos = base.filter((_, i) => i !== idx);
    } else {
      // Was baja → confirm again
      nuevos = base.map((c, i) => i === idx ? { ...c, estado: 'confirmado' } : c);
    }
    await updateDoc(ref, { convocados: nuevos });
  }

  async function toggleMiPago() {
    if (!miJugador || !miConv || !yoConfirmado) return;
    const ref  = doc(db, 'partidos', weekId);
    const base = partido?.convocados ?? [];
    const idx  = base.findIndex(c => c.jugadorId === miJugador.id);
    if (idx === -1) return;
    const nuevos = base.map((c, i) => i === idx ? { ...c, pagado: !c.pagado } : c);
    await updateDoc(ref, { convocados: nuevos });
  }

  async function guardarCuota() {
    const val = parseInt(cuotaInput, 10);
    if (!val || val < 0) return;
    await ensurePartido();
    await updateDoc(doc(db, 'partidos', weekId), { cuota: val });
    setCuotaEdit(false);
  }

  // Squad list sorted: confirmed first, then the rest
  const squadOrdenado = [...activos].sort((a, b) => {
    const aConf = convocadoMap[a.id]?.estado === 'confirmado' ? 0 : 1;
    const bConf = convocadoMap[b.id]?.estado === 'confirmado' ? 0 : 1;
    return aConf - bConf;
  });

  return (
    <div className="page">
      <div className="page-title">
        <span style={{ fontSize: 18 }}>⚽</span>
        Esta <span>Semana</span>
      </div>

      {/* ── SECCIÓN A: MI TARJETA ── */}
      {!jugadorActual ? (
        <div className="week-card" style={{ textAlign: 'center', padding: '20px 14px' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>❓</div>
          <div style={{ fontFamily: 'Bebas Neue, Rajdhani, sans-serif', fontSize: 16, letterSpacing: 2, color: 'var(--gold)', marginBottom: 6 }}>
            Perfil no registrado
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            Tu perfil no fue encontrado. Borra los datos del navegador y regístrate de nuevo.
          </div>
        </div>
      ) : !miJugador ? (
        <div className="week-card" style={{ textAlign: 'center', padding: '20px 14px' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
          <div style={{ fontFamily: 'Bebas Neue, Rajdhani, sans-serif', fontSize: 16, letterSpacing: 2, color: 'var(--text2)', marginBottom: 6 }}>
            Jugador no encontrado en el roster
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Pídele al admin que te agregue al roster primero.
          </div>
        </div>
      ) : (
        <MiTarjeta
          jugador={miJugador}
          confirmado={yoConfirmado}
          pague={yoPague}
          onToggleAsistencia={toggleMiAsistencia}
          onTogglePago={toggleMiPago}
          weekId={weekId}
          cuota={cuota}
        />
      )}

      {/* ── SECCIÓN B: SQUAD DE LA SEMANA ── */}
      <div className="section-label" style={{ marginTop: 20 }}>
        Squad de la semana
      </div>

      {/* Stats bar */}
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-num" style={{ color: '#10b981' }}>{confirmados.length}</div>
          <div className="stat-label">Confirmados</div>
        </div>
        <div className="stat-box">
          <div className="stat-num" style={{ color: 'var(--gold)' }}>{pagados.length}</div>
          <div className="stat-label">Pagados</div>
        </div>
        <div className="stat-box">
          <div className="stat-num" style={{ color: 'var(--text3)' }}>{activos.length - confirmados.length}</div>
          <div className="stat-label">Pendientes</div>
        </div>
      </div>

      {activos.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">👥</span>
          <div className="empty-text">Agrega jugadores en la pestaña Roster</div>
        </div>
      )}

      {squadOrdenado.map(j => {
        const conv       = convocadoMap[j.id];
        const confirmado = conv?.estado === 'confirmado';
        const pagado     = conv?.pagado;
        const esYo       = miJugador?.id === j.id;
        const cfg        = getPosicionConfig(j.posicion);

        return (
          <div
            key={j.id}
            className={`player-row squad-player-row ${confirmado ? 'confirmed' : ''} ${esYo ? 'es-yo' : ''}`}
          >
            <div className="player-avatar" style={{ borderColor: cfg.color, color: cfg.color }}>
              {getInitials(j.nombre)}
            </div>
            <div className="player-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="player-name">{j.nombre}</div>
                {esYo && <span className="yo-badge">TÚ</span>}
              </div>
              <span
                className="player-pos-badge"
                style={{ color: cfg.color, background: cfg.bg }}
              >
                {getPosicionLabel(j.posicion)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
              {confirmado && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  color: '#10b981', background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 4, padding: '2px 6px',
                  fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
                }}>
                  Va
                </span>
              )}
              {pagado && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  color: 'var(--gold)', background: 'rgba(240,192,64,0.1)',
                  border: '1px solid rgba(240,192,64,0.3)',
                  borderRadius: 4, padding: '2px 6px',
                  fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
                }}>
                  Pagó
                </span>
              )}
              {!confirmado && !pagado && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  color: 'var(--text3)', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 6px',
                  fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
                }}>
                  Pendiente
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* ── SECCIÓN C: CUOTA ── */}
      <div className="section-label" style={{ marginTop: 20 }}>Cuota semanal</div>
      <div className="week-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cuotaEdit ? 10 : 0 }}>
          <div className="cuota-display" style={{ padding: 0, fontSize: 36 }}>
            S/ {cuota.toLocaleString()}
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setCuotaEdit(true); setCuotaInput(String(cuota)); }}
          >
            Editar
          </button>
        </div>
        {cuotaEdit && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              className="form-input"
              type="number"
              value={cuotaInput}
              onChange={e => setCuotaInput(e.target.value)}
              placeholder="Monto"
              autoFocus
            />
            <button className="btn btn-gold" onClick={guardarCuota}>OK</button>
            <button className="btn btn-outline" onClick={() => setCuotaEdit(false)}>✕</button>
          </div>
        )}
      </div>

      {/* Bottom spacer for mobile thumb reach */}
      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Mi Tarjeta — the hero component ────────────────────────────────────────
function MiTarjeta({ jugador, confirmado, pague, onToggleAsistencia, onTogglePago, weekId, cuota }) {
  const overall = getRating(jugador);
  const tier    = getCardTier(overall);
  const cfg     = getPosicionConfig(jugador.posicion);
  const posLabel = getPosicionLabel(jugador.posicion);

  return (
    <div className="mi-tarjeta-wrap">
      {/* Header label */}
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 3,
        color: 'var(--text3)', textTransform: 'uppercase',
        fontFamily: 'Rajdhani, sans-serif', marginBottom: 10,
        textAlign: 'center',
      }}>
        Tu tarjeta
      </div>

      {/* FUT card — centered, wider than roster grid */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div
          className={`fut-card fut-card-${tier}`}
          style={{ width: 140, height: 196, borderRadius: 12, flexShrink: 0 }}
        >
          <div className="fut-card-inner">
            <div className="fut-card-top">
              <div>
                <div className="fut-card-overall">{overall}</div>
                <div className="fut-card-pos">{posLabel}</div>
              </div>
              <div className="fut-card-flag">🇵🇪</div>
            </div>
            <div className="fut-card-avatar-wrap">
              <div className="fut-card-avatar" style={{ width: 68, height: 68, fontSize: 24 }}>
                {getInitials(jugador.nombre)}
              </div>
            </div>
            <div className="fut-card-name">{jugador.nombre.split(' ')[0]}</div>
            <div className="fut-card-divider" />
            <div className="fut-card-stats">
              {[
                ['PAC', jugador.pac ?? Math.round(overall * 0.95 + Math.random() * 6)],
                ['TIR', jugador.tir ?? Math.round(overall * 0.9  + Math.random() * 8)],
                ['PAS', jugador.pas ?? Math.round(overall * 0.92 + Math.random() * 6)],
                ['REG', jugador.reg ?? Math.round(overall * 0.94 + Math.random() * 5)],
                ['DEF', jugador.def ?? Math.round(overall * 0.88 + Math.random() * 8)],
                ['FIS', jugador.fis ?? Math.round(overall * 0.91 + Math.random() * 6)],
              ].map(([lbl, val]) => (
                <div key={lbl} className="fut-card-stat">
                  <div className="fut-card-stat-num">{Math.min(val, 99)}</div>
                  <div className="fut-card-stat-label">{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status indicator under card */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        {confirmado ? (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: '#10b981', background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 20, padding: '4px 14px',
            fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
          }}>
            Confirmado esta semana
          </span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: 'var(--text3)', background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 20, padding: '4px 14px',
            fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
          }}>
            Sin confirmar
          </span>
        )}
      </div>

      {/* VOY / PAGUE buttons — thumb-friendly, full width */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <button
          className={`btn-voy ${confirmado ? 'activo' : ''}`}
          onClick={onToggleAsistencia}
        >
          <span className="btn-accion-check">{confirmado ? '✓' : '○'}</span>
          <span className="btn-accion-label">{confirmado ? 'VOY' : 'VOY'}</span>
        </button>

        <button
          className={`btn-pague ${pague ? 'activo' : ''}`}
          onClick={onTogglePago}
          disabled={!confirmado}
        >
          <span className="btn-accion-check">{pague ? '✓' : 'S/'}</span>
          <span className="btn-accion-label">{pague ? 'PAGUÉ' : 'PAGUÉ'}</span>
        </button>
      </div>

      {/* Cuota hint */}
      {confirmado && !pague && (
        <div style={{
          textAlign: 'center', fontSize: 10, color: 'var(--text3)',
          letterSpacing: 1, fontFamily: 'Rajdhani, sans-serif',
        }}>
          Cuota: S/ {cuota.toLocaleString()} — toca PAGUÉ cuando hayas pagado
        </div>
      )}
    </div>
  );
}
