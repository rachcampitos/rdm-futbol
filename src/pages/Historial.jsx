import { useState } from 'react';
import { getInitials, getPosicionConfig } from '../utils';
import { VotacionMvp } from './EstasSemana';

function getMvpIdFromPartido(partido) {
  const votos = partido.mvpVotos;
  if (votos && Object.keys(votos).length > 0) {
    const counts = {};
    Object.values(votos).forEach(id => { counts[id] = (counts[id] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  return partido.mvpId ?? null;
}

export default function Historial({ partidos, jugadores, miJugadorId }) {
  const [subTab, setSubTab] = useState('partidos');

  const cerrados = (partidos ?? [])
    .filter(p => p.cerrado)
    .sort((a, b) => b.id.localeCompare(a.id));

  // Season goleadores + MVP leaderboard
  const statsMap = {};
  cerrados.forEach(p => {
    (p.goleadores ?? []).forEach(g => {
      if (!statsMap[g.jugadorId]) {
        const jug = jugadores.find(jj => jj.id === g.jugadorId);
        statsMap[g.jugadorId] = { nombre: g.nombre, goles: 0, mvps: 0, jugador: jug };
      }
      statsMap[g.jugadorId].goles += g.goles ?? 1;
    });
    const mvpId = getMvpIdFromPartido(p);
    if (mvpId) {
      const jug = jugadores.find(jj => jj.id === mvpId);
      if (!statsMap[mvpId]) statsMap[mvpId] = { nombre: jug?.nombre ?? '?', goles: 0, mvps: 0, jugador: jug };
      statsMap[mvpId].mvps++;
    }
  });

  const goleadores = Object.entries(statsMap)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.goles - a.goles || b.mvps - a.mvps);

  const totalesSeason = {
    partidos: cerrados.length,
    goles: cerrados.reduce((s, p) => s + ((p.resultado?.golesA ?? 0) + (p.resultado?.golesB ?? 0)), 0),
  };

  return (
    <div className="page">
      <div className="page-title">
        <span style={{ fontSize: 18 }}>📊</span>
        <span>Estadísticas</span>
      </div>

      {/* Season summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div className="stat-box">
          <div className="stat-num" style={{ color: 'var(--gold)' }}>{totalesSeason.partidos}</div>
          <div className="stat-label">Partidos</div>
        </div>
        <div className="stat-box">
          <div className="stat-num" style={{ color: '#10b981' }}>{totalesSeason.goles}</div>
          <div className="stat-label">Goles totales</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="sorteo-view-tabs" style={{ marginBottom: 14 }}>
        <button
          className={`sorteo-view-tab${subTab === 'partidos' ? ' active' : ''}`}
          onClick={() => setSubTab('partidos')}
        >
          ⚽ Partidos
        </button>
        <button
          className={`sorteo-view-tab${subTab === 'goleadores' ? ' active' : ''}`}
          onClick={() => setSubTab('goleadores')}
        >
          🏆 Goleadores
        </button>
      </div>

      {/* ── Partidos tab ── */}
      {subTab === 'partidos' && (
        <>
          {cerrados.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📋</span>
              <div className="empty-text">No hay partidos cerrados aún</div>
            </div>
          ) : (
            cerrados.map(p => (
              <PartidoCard key={p.id} partido={p} jugadores={jugadores} miJugadorId={miJugadorId} />
            ))
          )}
        </>
      )}

      {/* ── Goleadores tab ── */}
      {subTab === 'goleadores' && (
        <>
          {goleadores.filter(g => g.goles > 0).length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">⚽</span>
              <div className="empty-text">Aún no hay goles registrados esta temporada</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {goleadores.filter(g => g.goles > 0).map((g, idx) => {
                const cfg = g.jugador
                  ? getPosicionConfig(g.jugador.posicion)
                  : { color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
                const isTop = idx === 0;
                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: isTop ? 'rgba(240,192,64,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isTop ? 'rgba(240,192,64,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 10, padding: '10px 12px',
                    }}
                  >
                    {/* Rank */}
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: isTop ? 'rgba(240,192,64,0.2)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, fontFamily: 'Rajdhani',
                      color: isTop ? 'var(--gold)' : 'var(--text3)', flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>
                    {/* Avatar */}
                    <div
                      className="player-avatar"
                      style={{ width: 32, height: 32, minWidth: 32, fontSize: 11, borderColor: cfg.color, color: cfg.color }}
                    >
                      {getInitials(g.nombre)}
                    </div>
                    {/* Name + MVP */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isTop ? 'var(--text)' : 'var(--text1)', lineHeight: 1.2 }}>
                        {g.nombre}
                      </div>
                      {g.mvps > 0 && (
                        <div style={{ fontSize: 9, color: 'var(--gold)', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>
                          🏅 {g.mvps} MVP{g.mvps > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    {/* Goals */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: 24, fontWeight: 700, fontFamily: 'Rajdhani',
                        color: isTop ? 'var(--gold)' : 'var(--text)', lineHeight: 1,
                      }}>
                        {g.goles}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>
                        {g.goles === 1 ? 'gol' : 'goles'}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* MVP-only players (0 goals but have MVP) */}
              {goleadores.filter(g => g.goles === 0 && g.mvps > 0).length > 0 && (
                <>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                    color: 'var(--text3)', textTransform: 'uppercase',
                    fontFamily: 'Rajdhani', marginTop: 8, marginBottom: 4,
                  }}>
                    MVPs sin goles
                  </div>
                  {goleadores.filter(g => g.goles === 0 && g.mvps > 0).map(g => {
                    const cfg = g.jugador
                      ? getPosicionConfig(g.jugador.posicion)
                      : { color: '#f0c040', bg: 'rgba(240,192,64,0.1)' };
                    return (
                      <div key={g.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'rgba(240,192,64,0.05)',
                        border: '1px solid rgba(240,192,64,0.15)',
                        borderRadius: 10, padding: '8px 12px',
                      }}>
                        <div className="player-avatar" style={{ width: 28, height: 28, minWidth: 28, fontSize: 10, borderColor: cfg.color, color: cfg.color }}>
                          {getInitials(g.nombre)}
                        </div>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{g.nombre}</div>
                        <div style={{ fontSize: 10, color: 'var(--gold)', fontFamily: 'Rajdhani', fontWeight: 700 }}>
                          🏅 ×{g.mvps}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

function PartidoCard({ partido, jugadores, miJugadorId }) {
  const [expanded, setExpanded] = useState(false);
  const res = partido.resultado;
  const equipoA = (partido.equipoA ?? []).map(id => jugadores.find(j => j.id === id)).filter(Boolean);
  const equipoB = (partido.equipoB ?? []).map(id => jugadores.find(j => j.id === id)).filter(Boolean);
  const goleadores = (partido.goleadores ?? []).filter(g => (g.goles ?? 0) > 0);
  const mvpId = getMvpIdFromPartido(partido);
  const mvpJugador = mvpId ? jugadores.find(j => j.id === mvpId) : null;

  const fechaDisplay = (() => {
    if (partido.fechaTexto) return partido.fechaTexto;
    if (!partido.id) return '';
    const [yyyy, mm, dd] = partido.id.split('-');
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${dd} ${months[parseInt(mm, 10) - 1]} ${yyyy}`;
  })();

  const winner = res
    ? res.golesA > res.golesB ? 'Azul'
      : res.golesB > res.golesA ? 'Rojo'
      : 'Empate'
    : null;

  const winnerColor = winner === 'Azul' ? '#90caf9' : winner === 'Rojo' ? '#fca5a5' : 'var(--gold)';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, marginBottom: 8, overflow: 'hidden',
    }}>
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            color: 'var(--text3)', fontFamily: 'Rajdhani', textTransform: 'uppercase', marginBottom: 4,
          }}>
            {fechaDisplay}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#90caf9', fontFamily: 'Rajdhani', fontWeight: 700 }}>🔵 {equipoA.length}</span>
            {res ? (
              <span style={{
                fontSize: 18, fontWeight: 700, fontFamily: 'Bebas Neue, Rajdhani',
                color: 'var(--gold)', letterSpacing: 2,
              }}>
                {res.golesA} – {res.golesB}
              </span>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Rajdhani' }}>VS</span>
            )}
            <span style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'Rajdhani', fontWeight: 700 }}>🔴 {equipoB.length}</span>
            {winner && (
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: 1,
                color: winnerColor, background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${winnerColor}44`,
                borderRadius: 4, padding: '2px 6px',
                fontFamily: 'Rajdhani', textTransform: 'uppercase',
              }}>
                {winner}
              </span>
            )}
          </div>
        </div>

        {/* MVP badge */}
        {mvpJugador && (
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: 'var(--gold)', fontFamily: 'Rajdhani', letterSpacing: 1, marginBottom: 2 }}>MVP</div>
            <div
              className="player-avatar"
              style={{ width: 28, height: 28, minWidth: 28, fontSize: 10, borderColor: '#f0c040', color: '#f0c040', background: 'rgba(240,192,64,0.12)' }}
            >
              {getInitials(mvpJugador.nombre)}
            </div>
          </div>
        )}

        <span style={{ color: 'var(--text3)', fontSize: 14 }}>{expanded ? '▾' : '›'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px 12px' }}>
          {/* Goleadores */}
          {goleadores.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, color: 'var(--text3)', fontFamily: 'Rajdhani',
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
              }}>
                Goleadores
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {goleadores.map((g, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10, fontWeight: 700, fontFamily: 'Rajdhani',
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      borderRadius: 6, padding: '3px 8px', color: '#10b981',
                    }}
                  >
                    ⚽ {g.nombre}{g.goles > 1 ? ` ×${g.goles}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* MVP */}
          {mvpJugador && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, color: 'var(--text3)', fontFamily: 'Rajdhani',
                letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4,
              }}>
                MVP del partido
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="player-avatar" style={{ width: 28, height: 28, minWidth: 28, fontSize: 10, borderColor: '#f0c040', color: '#f0c040' }}>
                  {getInitials(mvpJugador.nombre)}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>🏅 {mvpJugador.nombre}</span>
              </div>
            </div>
          )}

          {/* Teams */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['🔵 Azul', equipoA, '#90caf9'], ['🔴 Rojo', equipoB, '#fca5a5']].map(([title, team, color]) => (
              <div key={title}>
                <div style={{
                  fontSize: 9, color, fontFamily: 'Rajdhani',
                  letterSpacing: 1, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase',
                }}>
                  {title}
                </div>
                {team.map(j => (
                  <div key={j.id} style={{ fontSize: 11, color: 'var(--text2)', padding: '1px 0', fontFamily: 'Rajdhani' }}>
                    {j.nombre}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {partido.sorteadoPor && (
            <div style={{
              fontSize: 9, color: 'var(--text3)', fontFamily: 'Rajdhani',
              letterSpacing: 0.5, marginTop: 8,
            }}>
              Sorteado por {partido.sorteadoPor}
            </div>
          )}

          {/* Votación MVP */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <VotacionMvp
              partido={partido}
              jugadores={jugadores}
              miJugadorId={miJugadorId}
              weekId={partido.id}
              weeklyMvpId={mvpId}
            />
          </div>
        </div>
      )}
    </div>
  );
}
