import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getWeekId, getShortName, getInitials, distribuirEquipos, calcularPosicionesCancha } from '../utils';

// Derive the match format label from team sizes: "4 VS 4", "10 VS 10", etc.
function getFormatoPartido(sizeA, sizeB) {
  if (sizeA === 0 && sizeB === 0) return null;
  return `${sizeA} VS ${sizeB}`;
}

export default function Sorteo({ jugadores, partido, jugadorActual }) {
  const [animating, setAnimating]     = useState(false);
  const [justRevealed, setJustRevealed] = useState(false);

  const confirmados = (partido?.convocados ?? []).filter(c => c.estado === 'confirmado');
  const jugadoresConfirmados = confirmados.map(c =>
    jugadores.find(j => j.id === c.jugadorId) ?? { id: c.jugadorId, nombre: c.nombre, posicion: c.posicion ?? 'defensa' }
  ).filter(Boolean);

  const equipoA = (partido?.equipoA ?? []).map(id => jugadores.find(j => j.id === id)).filter(Boolean);
  const equipoB = (partido?.equipoB ?? []).map(id => jugadores.find(j => j.id === id)).filter(Boolean);
  const sorteoHecho = partido?.sorteoRealizado && equipoA.length > 0;

  const formato = sorteoHecho ? getFormatoPartido(equipoA.length, equipoB.length) : null;

  async function hacerSorteo() {
    if (jugadoresConfirmados.length < 2) return;
    setAnimating(true);
    setJustRevealed(false);

    setTimeout(async () => {
      const { equipoA: a, equipoB: b } = distribuirEquipos(jugadoresConfirmados);
      await updateDoc(doc(db, 'partidos', getWeekId()), {
        equipoA: a.map(j => j.id),
        equipoB: b.map(j => j.id),
        sorteoRealizado: true,
      });
      setAnimating(false);
      setJustRevealed(true);
    }, 2000);
  }

  return (
    <div className="page">
      <div className="page-title">
        <span style={{ fontSize: 18 }}>🎲</span>
        <span>Sorteo</span>
      </div>

      {/* Info card */}
      <div className="week-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          <div className="sorteo-ball sorteo-spinning">⚽</div>
          <div className="sorteo-label">Sorteando equipos</div>
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <div className="formato-partido">
                PARTIDO <span style={{ color: 'var(--gold)' }}>{formato}</span>
              </div>
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

          {/* Tactical pitch */}
          <CanchaView
            equipoA={equipoA}
            equipoB={equipoB}
            justRevealed={justRevealed}
            jugadorActualId={jugadorActual?.id}
          />

          {/* Team lists */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
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
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

function CanchaView({ equipoA, equipoB, justRevealed, jugadorActualId }) {
  const posA = calcularPosicionesCancha(equipoA, true);
  const posB = calcularPosicionesCancha(equipoB, false);

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
        <rect x="34" y="3" width="32" height="9" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <rect x="40" y="0.8" width="20" height="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.75)" strokeWidth="0.5"/>
        <circle cx="50" cy="19" r="0.7" fill="rgba(255,255,255,0.7)"/>
        <path d="M 36 27 A 12 12 0 0 1 64 27" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <rect x="20" y="141" width="60" height="24" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5"/>
        <rect x="34" y="156" width="32" height="9" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <rect x="40" y="163.2" width="20" height="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.75)" strokeWidth="0.5"/>
        <circle cx="50" cy="149" r="0.7" fill="rgba(255,255,255,0.7)"/>
        <path d="M 36 141 A 12 12 0 0 0 64 141" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <path d="M 3,3 Q 5.5,3 5.5,5.5"    fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <path d="M 97,3 Q 94.5,3 94.5,5.5"  fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <path d="M 3,165 Q 5.5,165 5.5,162.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
        <path d="M 97,165 Q 94.5,165 94.5,162.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4"/>
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
          key={`a-${i}`}
          player={p}
          team="a"
          delay={justRevealed ? i * 80 : 0}
          esYo={p.id === jugadorActualId}
        />
      ))}
      {posB.map((p, i) => (
        <PlayerToken
          key={`b-${i}`}
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
      className={`field-player card-reveal ${esYo ? 'field-player-yo' : ''}`}
      style={{
        left: `${player.x}%`,
        top: `${player.y}%`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div className={`field-player-circle team-${team}-circle ${esYo ? 'field-player-yo-circle' : ''}`}>
        {getInitials(player.nombre)}
        {esYo && <span className="field-yo-dot" />}
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
