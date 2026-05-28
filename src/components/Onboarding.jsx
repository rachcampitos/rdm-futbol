import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, getDocs, query, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { POSICION_GRUPOS, POSICION_DETALLADA, getInitials } from '../utils';

/* ── FUT stats por posición — PAC SHO PAS DRI DEF PHY ── */
const STICKER_STATS = {
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

const STICKER_OVERALL = {
  POR: 78,
  LTI: 73, LTD: 73, DFCi: 75, DFCd: 75,
  MDC: 76, MC: 77, MOC: 78, MCI: 74, MCD: 74,
  DC: 80, EXI: 78, EXD: 78, SD: 77,
};

/* Posición detallada → clase CSS específica */
const STICKER_POS_CLASS = {
  POR:  'sticker-POR',
  LTI:  'sticker-LTI',
  LTD:  'sticker-LTD',
  DFCi: 'sticker-DFCi',
  DFCd: 'sticker-DFCd',
  MDC:  'sticker-MDC',
  MC:   'sticker-MC',
  MCI:  'sticker-MCI',
  MCD:  'sticker-MCD',
  MOC:  'sticker-MOC',
  DC:   'sticker-DC',
  SD:   'sticker-SD',
  EXI:  'sticker-EXI',
  EXD:  'sticker-EXD',
};

/* Silueta SVG genérica de jugador (estilo Panini) */
function SilhouetteSVG() {
  return (
    <svg viewBox="0 0 80 100" className="sticker-silhouette" aria-hidden="true">
      {/* Cabeza */}
      <circle cx="40" cy="22" r="14" fill="currentColor" opacity="0.35" />
      {/* Cuerpo */}
      <path
        d="M20 55 Q20 40 40 38 Q60 40 60 55 L64 95 H16 Z"
        fill="currentColor"
        opacity="0.25"
      />
      {/* Brazos */}
      <path
        d="M20 55 Q10 60 8 75 Q14 76 18 66 L22 58Z"
        fill="currentColor"
        opacity="0.25"
      />
      <path
        d="M60 55 Q70 60 72 75 Q66 76 62 66 L58 58Z"
        fill="currentColor"
        opacity="0.25"
      />
    </svg>
  );
}

/* ── Figurita Panini/FUT — componente puro ── */
export function StickerCard({ nombre, posicion, isComplete, isFlipping, isLaunching }) {
  const cfg = POSICION_DETALLADA[posicion] ?? POSICION_DETALLADA['DC'];
  const posClass = STICKER_POS_CLASS[posicion] ?? 'sticker-DC';
  const stats = STICKER_STATS[posicion] ?? STICKER_STATS['DC'];
  const overall = STICKER_OVERALL[posicion] ?? 77;
  const initials = nombre.trim() ? getInitials(nombre) : null;
  const displayName = nombre.trim() || null;

  const animClass = isLaunching
    ? 'sticker-launching'
    : isFlipping
      ? 'sticker-flipping'
      : isComplete
        ? 'sticker-complete'
        : '';

  return (
    <div
      className={`sticker-card ${posClass} ${animClass}`}
      aria-label={`Figurita de ${displayName || 'jugador'}, posición ${posicion}`}
    >
      {/* Textura de ruido superpuesta */}
      <div className="sticker-texture" />

      {/* Efecto holográfico de brillo */}
      <div className="sticker-shine" />

      {/* ── ENCABEZADO ── */}
      <div className="sticker-header">
        <div className="sticker-header-league">
          <span className="sticker-header-rdm">RDM</span>
          <span className="sticker-header-sep">★</span>
          <span className="sticker-header-name">LIGA PAPÁS</span>
        </div>
      </div>

      {/* ── ZONA OVERALL + POSICIÓN (esquina superior izquierda) ── */}
      <div className="sticker-topleft">
        <div className="sticker-overall">{overall}</div>
        <div className="sticker-pos-code">{posicion}</div>
      </div>

      {/* ── AVATAR ── */}
      <div className="sticker-avatar-zone">
        {initials ? (
          <div className="sticker-avatar sticker-avatar-filled">
            <span className="sticker-avatar-initials">{initials}</span>
          </div>
        ) : (
          <div className="sticker-avatar sticker-avatar-empty">
            <SilhouetteSVG />
          </div>
        )}
      </div>

      {/* ── NOMBRE ── */}
      <div className="sticker-name-zone">
        {displayName ? (
          <div className="sticker-name">{displayName.toUpperCase()}</div>
        ) : (
          <div className="sticker-name sticker-name-placeholder">TU NOMBRE</div>
        )}
        <div className="sticker-pos-badge" style={{ background: cfg.bg, borderColor: cfg.color, color: cfg.color }}>
          {cfg.nombre.replace('Mediocampo ', 'M. ').replace('Defensa Central ', 'DFC ')}
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="sticker-stats">
        {[
          ['PAC', stats.PAC],
          ['SHO', stats.SHO],
          ['PAS', stats.PAS],
          ['DRI', stats.DRI],
          ['DEF', stats.DEF],
          ['PHY', stats.PHY],
        ].map(([label, val]) => (
          <div key={label} className="sticker-stat">
            <span className="sticker-stat-val">{val}</span>
            <span className="sticker-stat-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Borde brillante inferior */}
      <div className="sticker-footer-line" />
    </div>
  );
}

/* ── Onboarding — pantalla de bienvenida estilo FIFA "Press START" ── */
export default function Onboarding({ onComplete }) {
  const [fase, setFase] = useState('intro');   // intro | elegir | form | buscar | confirming | enter
  const [nombre, setNombre] = useState('');
  const [posicion, setPosicion] = useState('DC');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [jugadoresExistentes, setJugadoresExistentes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [nombreConfirm, setNombreConfirm] = useState('');

  // Track whether this is the initial render so we don't flip on mount
  const isFirstRender = useRef(true);
  const flipTimeout = useRef(null);

  // Auto-advance: "PRESS START" text shows for 2.2s, then drops into elegir
  useEffect(() => {
    if (fase !== 'intro') return;
    const t = setTimeout(() => setFase('elegir'), 2200);
    return () => clearTimeout(t);
  }, [fase]);

  async function abrirBuscar() {
    setFase('buscar');
    setCargando(true);
    try {
      const snap = await getDocs(query(collection(db, 'jugadores')));
      setJugadoresExistentes(
        snap.docs
          .filter(d => d.data().activo !== false)
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
    } finally {
      setCargando(false);
    }
  }

  function entrar(jugadorId, n) {
    const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    localStorage.setItem('rdm_jugador_id',     jugadorId);
    localStorage.setItem('rdm_jugador_nombre', n);
    document.cookie = `rdm_uid=${encodeURIComponent(jugadorId)}; expires=${exp}; path=/; SameSite=Lax`;
    setNombreConfirm(n);
    setFase('confirming');
    setTimeout(() => {
      setFase('enter');
      setTimeout(() => onComplete({ id: jugadorId, nombre: n }), 900);
    }, 1400);
  }

  function seleccionarJugador(j) {
    entrar(j.id, j.nombre);
  }

  // Flip animation when posicion changes — skip the initial mount
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Clear any pending flip
    if (flipTimeout.current) clearTimeout(flipTimeout.current);
    setIsFlipping(true);
    flipTimeout.current = setTimeout(() => setIsFlipping(false), 350);
    return () => { if (flipTimeout.current) clearTimeout(flipTimeout.current); };
  }, [posicion]);

  const isComplete = nombre.trim().length > 0;

  async function confirmar() {
    const n = nombre.trim();
    if (!n) { setError('Escribe tu nombre para entrar al partido'); return; }
    setError('');
    setIsLaunching(true);
    setTimeout(async () => {
      setSaving(true);
      try {
        const ref = await addDoc(collection(db, 'jugadores'), {
          nombre: n, posicion, activo: true, createdAt: serverTimestamp(),
        });
        setSaving(false);
        setIsLaunching(false);
        entrar(ref.id, n);
      } catch (e) {
        console.error(e);
        setError('Error al guardar. Intenta de nuevo.');
        setSaving(false);
        setIsLaunching(false);
      }
    }, 500);
  }

  return (
    <div className={`onb-root ${fase === 'enter' ? 'onb-exit' : ''}`}>
      {/* Stadium atmosphere background */}
      <div className="onb-bg" />
      <div className="onb-bg-overlay" />
      <div className="onb-scanlines" />

      {/* Corner accent lines — FIFA menu style */}
      <div className="onb-corner onb-corner-tl" />
      <div className="onb-corner onb-corner-tr" />
      <div className="onb-corner onb-corner-bl" />
      <div className="onb-corner onb-corner-br" />

      {/* ── INTRO SCREEN (Press START) ── */}
      {fase === 'intro' && (
        <div className="onb-intro">
          <div className="onb-season-badge">
            <span className="onb-badge-dot" />
            <span>Temporada 2025</span>
          </div>

          <div className="onb-logo-wrap">
            <div className="onb-logo-title">RDM</div>
            <div className="onb-logo-subtitle">Fútbol</div>
            <div className="onb-logo-league">Liga de Papás</div>
          </div>

          <div className="onb-intro-divider">
            <div className="onb-divider-line" />
            <div className="onb-divider-diamond" />
            <div className="onb-divider-line" />
          </div>

          <div className="onb-press-start">ÚNETE AL PARTIDO</div>
          <div className="onb-press-blink">Presiona para continuar</div>

          {/* Tap/click anywhere to skip */}
          <div className="onb-intro-tap" onClick={() => setFase('elegir')} />
        </div>
      )}

      {/* ── ELEGIR SCREEN ── */}
      {fase === 'elegir' && (
        <div className="onb-form-wrap onb-form-enter" style={{ justifyContent: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div className="onb-logo-title" style={{ fontSize: 36 }}>RDM</div>
            <div className="onb-logo-subtitle" style={{ fontSize: 18 }}>Fútbol</div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: 'var(--text3)', textTransform: 'uppercase', fontFamily: 'Rajdhani, sans-serif', textAlign: 'center' }}>
            ¿Cómo quieres entrar?
          </div>
          <button
            className="onb-cta"
            onClick={() => setFase('form')}
            style={{ marginBottom: 0 }}
          >
            <span className="onb-cta-icon">⚽</span>
            <span>SOY NUEVO</span>
          </button>
          <button
            className="onb-cta"
            onClick={abrirBuscar}
            style={{ background: 'rgba(240,192,64,0.08)', borderColor: 'rgba(240,192,64,0.4)', color: 'var(--gold)' }}
          >
            <span className="onb-cta-icon">👤</span>
            <span>YA ESTOY REGISTRADO</span>
          </button>
        </div>
      )}

      {/* ── BUSCAR SCREEN ── */}
      {fase === 'buscar' && (
        <div className="onb-form-wrap onb-form-enter">
          <div className="onb-fields-zone" style={{ paddingTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button
                onClick={() => setFase('elegir')}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer', padding: 0 }}
              >
                ←
              </button>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: 'var(--gold)', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase' }}>
                Selecciona tu nombre
              </div>
            </div>

            <input
              className="onb-field-input"
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder="Buscar nombre..."
              autoFocus
              style={{ marginBottom: 12 }}
            />

            {cargando ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 24, fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1 }}>
                Cargando jugadores...
              </div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: '52dvh', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {jugadoresExistentes
                  .filter(j => j.nombre.toLowerCase().includes(filtro.toLowerCase()))
                  .map(j => (
                    <button
                      key={j.id}
                      onClick={() => seleccionarJugador(j)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, cursor: 'pointer',
                        transition: 'all 0.15s', textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(240,192,64,0.12)',
                        border: '1.5px solid rgba(240,192,64,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: 'var(--gold)',
                        fontFamily: 'Rajdhani, sans-serif', flexShrink: 0,
                      }}>
                        {j.nombre.trim().split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>{j.nombre}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 0.5 }}>{j.posicion}</div>
                      </div>
                    </button>
                  ))}
                {jugadoresExistentes.filter(j => j.nombre.toLowerCase().includes(filtro.toLowerCase())).length === 0 && !cargando && (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 20, fontSize: 12, fontFamily: 'Rajdhani, sans-serif' }}>
                    No encontrado — ¿eres nuevo?{' '}
                    <span style={{ color: 'var(--gold)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setFase('form')}>
                      Regístrate aquí
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FORM SCREEN ── */}
      {(fase === 'form' || fase === 'confirming' || fase === 'enter') && (
        <div className={`onb-form-wrap ${fase === 'form' ? 'onb-form-enter' : ''}`}>

          {/* ── ZONA SUPERIOR: FIGURITA ── */}
          <div className="onb-sticker-zone">
            <StickerCard
              nombre={nombre}
              posicion={posicion}
              isComplete={isComplete}
              isFlipping={isFlipping}
              isLaunching={isLaunching}
            />
          </div>

          {/* ── ZONA INFERIOR: FORMULARIO ── */}
          <div className="onb-fields-zone">
            {fase !== 'confirming' ? (
              <>
                {/* Name input */}
                <div className="onb-field-group onb-field-group--name">
                  <label className="onb-field-label">Tu nombre</label>
                  <input
                    className="onb-field-input"
                    value={nombre}
                    onChange={e => { setNombre(e.target.value); setError(''); }}
                    placeholder="Ej: Carlos Ramírez"
                    autoFocus
                    maxLength={40}
                    onKeyDown={e => e.key === 'Enter' && confirmar()}
                    disabled={saving}
                  />
                  {error && <div className="onb-error">{error}</div>}
                </div>

                {/* Position picker — compact horizontal scroll */}
                <div className="onb-field-group">
                  <label className="onb-field-label">Tu posición</label>
                  <div className="onb-pos-scroll">
                    {POSICION_GRUPOS.map(({ grupo, posiciones }) => (
                      <div key={grupo} className="onb-pos-group">
                        <div className="onb-pos-group-label">{grupo}</div>
                        <div className="onb-pos-row">
                          {posiciones.map(p => {
                            const cfg = POSICION_DETALLADA[p];
                            const selected = posicion === p;
                            return (
                              <button
                                key={p}
                                className={`onb-pos-btn ${selected ? 'onb-pos-selected' : ''}`}
                                style={selected ? {
                                  borderColor: cfg.color,
                                  color: cfg.color,
                                  background: cfg.bg,
                                  boxShadow: `0 0 10px ${cfg.color}44`,
                                } : {}}
                                onClick={() => setPosicion(p)}
                                disabled={saving}
                                title={cfg.nombre}
                              >
                                <span className="onb-pos-btn-code">{p}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  className={`onb-cta ${saving ? 'onb-cta-loading' : ''}`}
                  onClick={confirmar}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="onb-cta-dots">
                        <span /><span /><span />
                      </span>
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <>
                      <span className="onb-cta-icon">⚽</span>
                      <span>ENTRAR AL PARTIDO</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="onb-confirm-screen">
                <div className="onb-confirm-ball">⚽</div>
                <div className="onb-confirm-text">
                  Bienvenido, <strong>{nombreConfirm || nombre}</strong>
                </div>
                <div className="onb-confirm-sub">Cargando la cancha...</div>
              </div>
            )}

            <div className="onb-footer">
              Tus datos se guardan solo para identificarte en la lista semanal
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
