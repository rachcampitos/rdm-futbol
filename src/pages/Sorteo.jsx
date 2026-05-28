import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  getWeekId, getShortName, getInitials, distribuirEquipos,
  FORMACIONES, getFormacionDefault, aplicarFormacion,
  getFormatosValidos, getPosicionLabel, getPosicionConfig,
} from '../utils';

// Derive the match format label from team sizes: "4 VS 4", "10 VS 10", etc.
function getFormatoPartido(sizeA, sizeB) {
  if (sizeA === 0 && sizeB === 0) return null;
  return `${sizeA} VS ${sizeB}`;
}

export default function Sorteo({ jugadores, partido, jugadorActual }) {
  const [animating, setAnimating]       = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);
  const [formacionA, setFormacionA]     = useState(null);
  const [formacionB, setFormacionB]     = useState(null);
  const [formatoSel, setFormatoSel]     = useState(null);
  const [sorteoView, setSorteoView]     = useState('cancha'); // 'cancha' | 'equipos'

  const confirmados = (partido?.convocados ?? []).filter(c => c.estado === 'confirmado');
  const jugadoresConfirmados = confirmados.map(c =>
    jugadores.find(j => j.id === c.jugadorId) ?? { id: c.jugadorId, nombre: c.nombre, posicion: c.posicion ?? 'defensa' }
  ).filter(Boolean);

  const equipoA = (partido?.equipoA ?? []).map(id => jugadores.find(j => j.id === id)).filter(Boolean);
  const equipoB = (partido?.equipoB ?? []).map(id => jugadores.find(j => j.id === id)).filter(Boolean);
  const sorteoHecho = partido?.sorteoRealizado && equipoA.length > 0;

  const formato = sorteoHecho ? getFormatoPartido(equipoA.length, equipoB.length) : null;

  /* Formato activo: selección local > guardada en Firestore > máximo posible */
  const formatoActivo = formatoSel
    ?? partido?.formatoJugadores
    ?? (jugadoresConfirmados.length >= 4 ? Math.floor(jugadoresConfirmados.length / 2) : null);

  /* Suplentes resueltos desde Firestore IDs */
  const suplentesList = (partido?.suplentes ?? [])
    .map(id => jugadores.find(j => j.id === id))
    .filter(Boolean);

  /* Formaciones activas — preferencia local > guardada en Firestore > default por nJugadores */
  const fA = formacionA ?? partido?.formacionA ?? getFormacionDefault(equipoA.length);
  const fB = formacionB ?? partido?.formacionB ?? getFormacionDefault(equipoB.length);

  async function hacerSorteo() {
    if (jugadoresConfirmados.length < 2) return;
    setAnimating(true);
    setJustRevealed(false);

    setTimeout(async () => {
      const { equipoA: a, equipoB: b, suplentes: s } = distribuirEquipos(jugadoresConfirmados, formatoActivo);
      const defA = getFormacionDefault(a.length);
      const defB = getFormacionDefault(b.length);
      await updateDoc(doc(db, 'partidos', getWeekId()), {
        equipoA: a.map(j => j.id),
        equipoB: b.map(j => j.id),
        suplentes: s.map(j => j.id),
        sorteoRealizado: true,
        formatoJugadores: formatoActivo,
        formacionA: defA,
        formacionB: defB,
        sorteadoPor: jugadorActual?.nombre ?? '',
      });
      setFormacionA(null);
      setFormacionB(null);
      setAnimating(false);
      setJustRevealed(true);
      setSorteoView('cancha');
    }, 2000);
  }

  async function cambiarFormacion(equipo, nueva) {
    if (equipo === 'A') setFormacionA(nueva);
    else setFormacionB(nueva);

    /* Persistir en Firestore */
    const campo = equipo === 'A' ? 'formacionA' : 'formacionB';
    try {
      await updateDoc(doc(db, 'partidos', getWeekId()), { [campo]: nueva });
    } catch {
      /* si no existe el doc todavía, ignorar — el próximo sorteo lo crea */
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <span style={{ fontSize: 18 }}>🎲</span>
        <span>Sorteo</span>
      </div>

      {/* Info card */}
      <div className="week-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{
              fontSize: 10, color: 'var(--text3)', letterSpacing: 1.5,
              textTransform: 'uppercase', fontWeight: 700, fontFamily: 'Rajdhani', marginBottom: 4,
            }}>
              Convocados hoy
            </div>
            <div style={{
              fontFamily: 'Bebas Neue, Rajdhani, sans-serif', fontSize: 34,
              fontWeight: 400, color: '#10b981', lineHeight: 1, letterSpacing: 1,
            }}>
              {jugadoresConfirmados.length}
              <span style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'Inter', marginLeft: 6, fontWeight: 400 }}>
                jugadores
              </span>
            </div>
          </div>

          {jugadoresConfirmados.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {sorteoHecho && (
                <button className="btn btn-outline btn-sm" onClick={hacerSorteo} disabled={animating}>
                  Repetir
                </button>
              )}
              <button
                className={`btn btn-gold ${animating ? 'pulse-gold' : ''}`}
                onClick={hacerSorteo}
                disabled={animating || jugadoresConfirmados.length < 2}
                style={{ minWidth: 120 }}
              >
                {animating ? 'Sorteando...' : sorteoHecho ? 'Nuevo sorteo' : 'Hacer sorteo'}
              </button>
            </div>
          )}
        </div>

        {/* Format selector */}
        {jugadoresConfirmados.length >= 4 && (() => {
          const opciones = getFormatosValidos(jugadoresConfirmados.length);
          if (opciones.length <= 1) return null;
          return (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 2, color: 'var(--text3)',
                textTransform: 'uppercase', fontFamily: 'Rajdhani', marginBottom: 8,
              }}>
                Formato del partido
              </div>
              <div className="formato-pills">
                {opciones.map(n => {
                  const nSup = jugadoresConfirmados.length - n * 2;
                  return (
                    <button
                      key={n}
                      className={`formato-pill${formatoActivo === n ? ' active' : ''}`}
                      onClick={() => setFormatoSel(n)}
                    >
                      <span>{n}v{n}</span>
                      {nSup > 0 && <span className="formato-pill-sub">+{nSup} sup</span>}
                    </button>
                  );
                })}
              </div>
              <div style={{
                fontSize: 9, color: 'var(--text3)', marginTop: 8,
                fontFamily: 'Rajdhani', letterSpacing: 0.5, lineHeight: 1.4,
              }}>
                {sorteoHecho
                  ? '↑ Cambia el formato y presiona "Nuevo sorteo" para aplicarlo'
                  : '↑ Elige el formato antes de sortear — los sobrantes serán suplentes'}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Empty states */}
      {jugadoresConfirmados.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <div className="empty-text">Confirma jugadores en "Esta Semana" para poder hacer el sorteo</div>
        </div>
      )}
      {jugadoresConfirmados.length === 1 && (
        <div className="empty-state">
          <span className="empty-icon">👤</span>
          <div className="empty-text">Necesitas al menos 2 jugadores confirmados</div>
        </div>
      )}

      {/* Draw animation */}
      {animating && (
        <div className="sorteo-draw-screen fade-in">
          {/* Shadow beneath the ball */}
          <div className="sorteo-shadow-wrap">
            <div className="sorteo-ball-shadow" />
          </div>
          {/* Bouncing ball */}
          <div className="sorteo-ball-wrap">
            <div className="sorteo-ball-bounce">⚽</div>
          </div>
          {/* Flashing gold title */}
          <div className="sorteo-label sorteo-label-flash">SORTEANDO...</div>
          <div className="sorteo-dots">
            <div className="sorteo-dot" />
            <div className="sorteo-dot" />
            <div className="sorteo-dot" />
          </div>
        </div>
      )}

      {/* Result */}
      {sorteoHecho && !animating && (
        <div className={justRevealed ? 'fade-in' : ''}>

          {/* Formato del partido — adaptive badge */}
          {formato && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <div className="formato-partido">
                PARTIDO <span style={{ color: 'var(--gold)' }}>{formato}</span>
              </div>
              {partido?.sorteadoPor && (
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif',
                  textTransform: 'uppercase',
                }}>
                  Sorteo por <span style={{ color: 'var(--text2)' }}>{partido.sorteadoPor}</span>
                </div>
              )}
            </div>
          )}

          {/* Team badges */}
          <div className="team-legend">
            <div className="team-badge team-badge-a">
              <div style={{ fontSize: 16, marginBottom: 2 }}>🔵</div>
              <div>Equipo Azul</div>
              <div style={{
                fontSize: 16, fontFamily: 'Bebas Neue, Rajdhani',
                letterSpacing: 2, marginTop: 2,
              }}>
                {equipoA.length} jugadores
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'Bebas Neue, Rajdhani', fontSize: 14,
                color: 'var(--text3)', letterSpacing: 1,
              }}>
                VS
              </div>
            </div>
            <div className="team-badge team-badge-b">
              <div style={{ fontSize: 16, marginBottom: 2 }}>🔴</div>
              <div>Equipo Rojo</div>
              <div style={{
                fontSize: 16, fontFamily: 'Bebas Neue, Rajdhani',
                letterSpacing: 2, marginTop: 2,
              }}>
                {equipoB.length} jugadores
              </div>
            </div>
          </div>

              {/* View tabs */}
          <div className="sorteo-view-tabs">
            <button
              className={`sorteo-view-tab${sorteoView === 'cancha' ? ' active' : ''}`}
              onClick={() => setSorteoView('cancha')}
            >
              ⚽ Cancha
            </button>
            <button
              className={`sorteo-view-tab${sorteoView === 'equipos' ? ' active' : ''}`}
              onClick={() => setSorteoView('equipos')}
            >
              👥 Equipos
            </button>
          </div>

          {/* CANCHA view */}
          {sorteoView === 'cancha' && (
            <>
              <FormacionSelector
                equipoA={equipoA}
                equipoB={equipoB}
                formacionA={fA}
                formacionB={fB}
                onChangeA={f => cambiarFormacion('A', f)}
                onChangeB={f => cambiarFormacion('B', f)}
              />
              <CanchaView
                equipoA={equipoA}
                equipoB={equipoB}
                formacionA={fA}
                formacionB={fB}
                justRevealed={justRevealed}
                jugadorActualId={jugadorActual?.id}
              />
            </>
          )}

          {/* EQUIPOS view */}
          {sorteoView === 'equipos' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                <TeamList
                  titulo="Equipo Azul"
                  jugadores={equipoA}
                  color="#90caf9"
                  bg="rgba(21,101,192,.12)"
                  borderColor="rgba(21,101,192,.4)"
                  jugadorActualId={jugadorActual?.id}
                />
                <TeamList
                  titulo="Equipo Rojo"
                  jugadores={equipoB}
                  color="#fca5a5"
                  bg="rgba(185,28,28,.12)"
                  borderColor="rgba(185,28,28,.4)"
                  jugadorActualId={jugadorActual?.id}
                />
              </div>
            </>
          )}

          {/* Suplentes — visible en ambas vistas */}
          {suplentesList.length > 0 && (
            <div className="suplentes-panel">
              <div className="suplentes-header">Suplentes</div>
              {suplentesList.map((j, i) => {
                const cfg = getPosicionConfig(j.posicion);
                return (
                  <div key={j.id ?? i} className="suplente-row">
                    <span className="suplente-num">{i + 1}</span>
                    <span style={{ flex: 1 }}>{j.nombre}</span>
                    {j.capitan && <span className="capitan-badge">C</span>}
                    <span className="suplente-pos-badge" style={{ color: cfg.color, background: cfg.bg }}>
                      {getPosicionLabel(j.posicion)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FormacionSelector — WE/PES táctica picker
   Filtrado por nJugadores: solo muestra formaciones compatibles
   ───────────────────────────────────────────────────────────── */
function FormacionSelector({ equipoA, equipoB, formacionA, formacionB, onChangeA, onChangeB }) {
  /* Filtra formaciones cuyo total de slots coincide con el equipo
     o está a 1 de diferencia (tolerante) */
  const formacionesPara = (nJugadores) =>
    Object.keys(FORMACIONES).filter(key => {
      const total = FORMACIONES[key].reduce((s, l) => s + l.n, 0);
      return Math.abs(total - nJugadores) <= 1;
    });

  const opcionesA = formacionesPara(equipoA.length);
  const opcionesB = formacionesPara(equipoB.length);

  /* Si solo hay una opción no mostramos el selector */
  if (opcionesA.length <= 1 && opcionesB.length <= 1) return null;

  return (
    <div className="formacion-selector-wrap">
      {/* Equipo Azul */}
      <div className="formacion-team-col formacion-team-a">
        <div className="formacion-team-label formacion-label-a">Azul</div>
        <div className="formacion-btn-row">
          {opcionesA.map(f => (
            <button
              key={f}
              className={`formacion-btn formacion-btn-a${formacionA === f ? ' formacion-btn-active-a' : ''}`}
              onClick={() => onChangeA(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="formacion-divider">
        <div className="formacion-divider-icon">⚽</div>
      </div>

      {/* Equipo Rojo */}
      <div className="formacion-team-col formacion-team-b">
        <div className="formacion-team-label formacion-label-b">Rojo</div>
        <div className="formacion-btn-row formacion-btn-row-right">
          {opcionesB.map(f => (
            <button
              key={f}
              className={`formacion-btn formacion-btn-b${formacionB === f ? ' formacion-btn-active-b' : ''}`}
              onClick={() => onChangeB(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CanchaView — ahora usa aplicarFormacion en lugar de
   calcularPosicionesCancha
   ───────────────────────────────────────────────────────────── */
function CanchaView({ equipoA, equipoB, formacionA, formacionB, justRevealed, jugadorActualId }) {
  const posA = aplicarFormacion(equipoA, formacionA, true);
  const posB = aplicarFormacion(equipoB, formacionB, false);

  return (
    <div className="field-wrap">
      <div className="field-bg" />

      {/* Tactical SVG lines */}
      <svg className="field-svg" viewBox="0 0 100 168" preserveAspectRatio="none">
        <rect x="3" y="3" width="94" height="162" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5"/>
        <line x1="3" y1="84" x2="97" y2="84" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5"/>
        <circle cx="50" cy="84" r="12" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="0.5"/>
        <circle cx="50" cy="84" r="0.9" fill="rgba(255,255,255,0.85)"/>
        <rect x="20" y="3" width="60" height="24" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5"/>
        <rect x="36.5" y="3" width="27" height="9" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <rect x="45" y="0.8" width="10" height="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.75)" strokeWidth="0.5"/>
        <circle cx="50" cy="19" r="0.7" fill="rgba(255,255,255,0.7)"/>
        <path d="M 40,27 A 13 13 0 0 0 60,27" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <rect x="20" y="141" width="60" height="24" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5"/>
        <rect x="36.5" y="156" width="27" height="9" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <rect x="45" y="163.2" width="10" height="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.75)" strokeWidth="0.5"/>
        <circle cx="50" cy="149" r="0.7" fill="rgba(255,255,255,0.7)"/>
        <path d="M 40,141 A 13 13 0 0 1 60,141" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <path d="M 7,3 A 4 4 0 0 1 3,7"       fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <path d="M 93,3 A 4 4 0 0 0 97,7"     fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <path d="M 3,161 A 4 4 0 0 1 7,165"   fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <path d="M 93,165 A 4 4 0 0 1 97,161" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <defs>
          <radialGradient id="topLight" cx="50%" cy="0%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,220,0.09)"/>
            <stop offset="100%" stopColor="rgba(255,255,220,0)"/>
          </radialGradient>
          <radialGradient id="botLight" cx="50%" cy="100%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,220,0.07)"/>
            <stop offset="100%" stopColor="rgba(255,255,220,0)"/>
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="168" fill="url(#topLight)"/>
        <rect x="0" y="0" width="100" height="168" fill="url(#botLight)"/>
      </svg>

      {posA.map((p, i) => (
        <PlayerToken
          key={`a-${p.id ?? i}`}
          player={p}
          team="a"
          delay={justRevealed ? i * 80 : 0}
          esYo={p.id === jugadorActualId}
        />
      ))}
      {posB.map((p, i) => (
        <PlayerToken
          key={`b-${p.id ?? i}`}
          player={p}
          team="b"
          delay={justRevealed ? (posA.length + i) * 80 : 0}
          esYo={p.id === jugadorActualId}
        />
      ))}
    </div>
  );
}

function PlayerToken({ player, team, delay, esYo }) {
  return (
    <div
      className={`field-player field-player-animated card-reveal ${esYo ? 'field-player-yo' : ''}`}
      style={{
        left: `${player.x}%`,
        top: `${player.y}%`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div className={`field-player-circle team-${team}-circle ${esYo ? 'field-player-yo-circle' : ''}`}>
        {getInitials(player.nombre)}
        {esYo && <span className="field-yo-dot" />}
        {player.capitan && <span className="field-capitan-c">C</span>}
      </div>
      <div className={`field-player-name ${esYo ? 'field-player-yo-name' : ''}`}>
        {getShortName(player.nombre)}
      </div>
    </div>
  );
}

function TeamList({ titulo, jugadores, color, bg, borderColor, jugadorActualId }) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: '10px 10px 8px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: .6,
      }} />

      <div style={{
        fontSize: 10, fontWeight: 700, color,
        letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase',
        fontFamily: 'Rajdhani, sans-serif',
      }}>
        {titulo}
      </div>

      {jugadores.map((j, i) => {
        const esYo = j.id === jugadorActualId;
        return (
          <div
            key={j.id}
            style={{
              fontSize: 12, color: esYo ? '#fff' : 'var(--text)',
              padding: '4px 0',
              borderBottom: '1px solid rgba(255,255,255,.06)',
              display: 'flex', gap: 6, alignItems: 'center',
              fontWeight: esYo ? 700 : 500,
            }}
          >
            <span style={{
              color: 'var(--text3)', fontSize: 9,
              minWidth: 14, fontFamily: 'Rajdhani', fontWeight: 700,
            }}>
              {i + 1}
            </span>
            <span style={{ flex: 1 }}>{j.nombre}</span>
            {j.capitan && <span className="capitan-badge">C</span>}
            {esYo && (
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: 1,
                color: 'var(--gold)', background: 'rgba(240,192,64,0.12)',
                border: '1px solid rgba(240,192,64,0.3)',
                borderRadius: 3, padding: '1px 5px',
                fontFamily: 'Rajdhani', textTransform: 'uppercase',
              }}>
                TÚ
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
