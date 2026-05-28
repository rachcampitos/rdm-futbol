import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { collection, doc, onSnapshot, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getWeekId, POSICION_GRUPOS, POSICION_DETALLADA } from './utils';
import EstasSemana from './pages/EstasSemana';
import Jugadores from './pages/Jugadores';
import Sorteo from './pages/Sorteo';
import Penaltis from './pages/Penaltis';
import Onboarding, { StickerCard } from './components/Onboarding';
import song1  from './assets/music/FIFA 2002 Soundtrack - Gorillaz - 19-2000 Soulchild Remix.wmv.mp3';
import song2  from './assets/music/FIFA 98 OST - Busy Child (The Crystal Method).mp3';
import song3  from './assets/music/(FIFA 14) Empire Of The Sun - Alive.mp3';
import song4  from './assets/music/(FIFA 14) John Newman - Love Me Again.mp3';
import song5  from './assets/music/Avicii - The Nights (FIFA 15 Soundtrack).mp3';
import song6  from './assets/music/Banners - Shine the Light (Fifa 16).mp3';
import song7  from './assets/music/Come Alive - FMLYBND (FIFA 15 Soundtrack).mp3';
import song8  from './assets/music/Fifa 13 (2012) Youngblood Hawke - We Come Running (Soundtrack OST).mp3';
import song9  from './assets/music/Official FIFA 16 song_ RAC ft. Nate Hendricks - Back of the Car.mp3';
import song10 from './assets/music/Saint Motel - My Type (FIFA 15 Soundtrack).mp3';
import song11 from './assets/music/Official FIFA 16 song_ Miami Horror - All It Ever Was.mp3';
import song12 from './assets/music/Two Door Cinema Club- Are We Ready_ (Wreck) (FIFA 17 Official Soundtrack) [-URh6VaWqi0].mp3';
import song13 from './assets/music/FIFA 98 OST - Keep Hope Alive (The Crystal Method).mp3';
import song14 from './assets/music/FIFA 98 OST - More (The Crystal Method) [5rWGYGZ9kI4].mp3';

const SONGS = [song1, song2, song3, song4, song5, song6, song7, song8, song9, song10, song11, song12, song13, song14];

/* ── Extract a clean display name from a raw filename path ── */
function getSongName(src) {
  // Vite URL-encodes asset paths and appends a content hash (-xxxxxxxx, 8 chars)
  let base = decodeURIComponent(src).split('/').pop();

  // Remove extension (handles .wmv.mp3 double-ext too)
  base = base.replace(/\.(mp3|ogg|m4a)$/i, '').replace(/\.wmv$/i, '');

  // Strip Vite content hash — always exactly 8 alphanumeric/hyphen/underscore chars at end
  base = base.replace(/-[A-Za-z0-9_-]{8}$/, '');

  // Strip YouTube IDs wrapped in [] or _ (brackets become _ on some filesystems)
  base = base.replace(/\s*[\[_][-\w]{8,14}[\]_]\s*$/, '');

  // Replace _ that stands in for ? (filesystem-safe replacement, only before space or end)
  base = base.replace(/_(?=\s|$)/g, '?');

  if (/gorillaz/i.test(base))        return 'Gorillaz - 19-2000';
  if (/busy child/i.test(base))      return 'Busy Child';
  if (/keep hope alive/i.test(base)) return 'Keep Hope Alive';

  // FIFA XX OST - Title (Artist) or FIFA XX OST - Title [YoutubeID]
  { const m = base.match(/^FIFA\s*\d+\s*OST\s*-\s*(.+?)(?:\s*[\(\[].*)?$/i); if (m) return m[1].trim(); }

  // (FIFA XX) Artist - Title  →  Artist - Title
  { const m = base.match(/^\(FIFA\s*\d+\)\s*(.+)/i); if (m) return m[1].trim(); }

  // Artist - Title (FIFA XX Soundtrack)  →  Artist - Title
  { const m = base.match(/^(.+?)\s*\(FIFA\s*\d+[^)]*\)\s*$/i); if (m) return m[1].trim(); }

  // Artist - Title (Fifa XX)  →  Artist - Title
  { const m = base.match(/^(.+?)\s*\(Fifa\s*\d+\)\s*$/i); if (m) return m[1].trim(); }

  // Come Alive - FMLYBND (FIFA XX ...)  →  Come Alive - FMLYBND
  { const m = base.match(/^(.+?)\s*\(FIFA\s*\d+[^)]*\)/i); if (m) return m[1].trim(); }

  // Fifa 13 (2012) Artist - Title (Soundtrack OST)  →  Artist - Title
  { const m = base.match(/^Fifa\s*\d+\s*\(\d+\)\s*(.+?)\s*\(Soundtrack[^)]*\)\s*$/i); if (m) return m[1].trim(); }

  // Official FIFA 16 song? Artist - Title  →  Artist - Title
  {
    const m = base.match(/Official\s+FIFA\s*\d+\s+song[?_:\s]+(.+)/i);
    if (m) return m[1].trim().replace(/\s+ft\.\s+[^-]+\s*-\s*/i, ' - ').trim();
  }

  return base.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function useAudioPlayer() {
  const audioRef    = useRef(null);
  const songIdxRef  = useRef(Math.floor(Math.random() * SONGS.length));
  const [playing,   setPlaying]   = useState(false);
  const [started,   setStarted]   = useState(false);
  const [songName,  setSongName]  = useState(() => getSongName(SONGS[songIdxRef.current]));

  const loadSong = useCallback((idx) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = SONGS[idx];
    audio.volume = 0.35;
    audio.load();
    setSongName(getSongName(SONGS[idx]));
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      songIdxRef.current = (songIdxRef.current + 1) % SONGS.length;
      loadSong(songIdxRef.current);
      audio.play().catch(() => {});
    });

    loadSong(songIdxRef.current);

    // Try normal autoplay first
    audio.play()
      .then(() => { setPlaying(true); setStarted(true); })
      .catch(() => {
        // Muted autoplay is allowed by all browsers — start silent, unmute on first touch
        audio.muted = true;
        audio.play()
          .then(() => {
            setPlaying(true);
            setStarted(true);
            const unmute = () => { audio.muted = false; };
            ['click', 'touchstart'].forEach(ev =>
              document.addEventListener(ev, unmute, { once: true })
            );
          })
          .catch(() => {
            // Full block — fall back to interaction-triggered start
            audio.muted = false;
            setPlaying(false);
            const start = () => {
              audio.play()
                .then(() => { setPlaying(true); setStarted(true); })
                .catch(() => {});
            };
            ['click', 'touchstart', 'keydown'].forEach(ev =>
              document.addEventListener(ev, start, { once: true })
            );
          });
      });

    return () => { audio.pause(); audio.src = ''; };
  }, [loadSong]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => { setPlaying(true); setStarted(true); });
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const prevSong = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    songIdxRef.current = (songIdxRef.current - 1 + SONGS.length) % SONGS.length;
    loadSong(songIdxRef.current);
    if (!audio.paused || started) {
      audio.play().then(() => { setPlaying(true); setStarted(true); }).catch(() => {});
    }
  }, [loadSong, started]);

  const nextSong = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    songIdxRef.current = (songIdxRef.current + 1) % SONGS.length;
    loadSong(songIdxRef.current);
    if (!audio.paused || started) {
      audio.play().then(() => { setPlaying(true); setStarted(true); }).catch(() => {});
    }
  }, [loadSong, started]);

  return { playing, started, toggle, prevSong, nextSong, songName };
}

/* ── Music bar — modern design ── */
function MusicBar({ playing, started, songName, onToggle, onPrev, onNext }) {
  const [displayName, setDisplayName] = useState(songName);
  const [nameVisible, setNameVisible] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    setNameVisible(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDisplayName(songName);
      setNameVisible(true);
    }, 220);
    return () => clearTimeout(timerRef.current);
  }, [songName]);

  const ctrlBtn = (onClick, label, title, large = false) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: large ? 38 : 30,
        height: large ? 38 : 30,
        borderRadius: large ? 10 : 8,
        border: large
          ? `1.5px solid ${playing ? 'rgba(240,192,64,0.7)' : 'rgba(255,255,255,0.25)'}`
          : '1px solid rgba(255,255,255,0.12)',
        background: large
          ? (playing ? 'rgba(240,192,64,0.18)' : 'rgba(255,255,255,0.06)')
          : 'rgba(255,255,255,0.04)',
        color: large ? (playing ? 'var(--gold)' : 'var(--text2)') : 'var(--text3)',
        cursor: 'pointer',
        fontSize: large ? 16 : 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.18s',
        flexShrink: 0,
        animation: large && !started ? 'pulse-gold 1.5s ease infinite' : 'none',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      height: 58,
      zIndex: 300,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 14px',
      background: 'rgba(4,13,33,0.96)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      borderTop: '1px solid rgba(240,192,64,0.35)',
      boxShadow: '0 -8px 28px rgba(0,0,0,0.8)',
      boxSizing: 'border-box',
    }}>

      {/* Equalizer / disc */}
      <div style={{ width: 30, height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {playing ? (
          <div className="music-eq">
            <span /><span /><span />
          </div>
        ) : (
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #7a5818, #2a1800)',
            border: '1.5px solid rgba(240,192,64,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: 'rgba(240,192,64,0.6)',
          }}>♪</div>
        )}
      </div>

      {/* Song info */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          fontSize: 8, fontWeight: 700, letterSpacing: 2,
          color: 'var(--text3)', fontFamily: 'Rajdhani', textTransform: 'uppercase',
          marginBottom: 1,
        }}>
          {playing ? '▶ EN DIRECTO' : '— PAUSADO'}
        </div>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: 13, fontWeight: 700,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: playing ? 'var(--gold)' : 'var(--text2)',
          opacity: nameVisible ? 1 : 0,
          transform: nameVisible ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}>
          {displayName}
        </div>
      </div>

      {/* Controls: ⏮ ▶/⏸ ⏭ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {ctrlBtn(onPrev, '⏮', 'Anterior')}
        {ctrlBtn(onToggle, playing ? '⏸' : '▶', playing ? 'Pausar' : 'Reproducir', true)}
        {ctrlBtn(onNext, '⏭', 'Siguiente')}
      </div>
    </div>
  );
}

/* ── Editar Perfil Modal ── */
function EditarPerfilModal({ jugadorActual, onClose, onSave }) {
  const [nombre,    setNombre]    = useState(jugadorActual?.nombre ?? '');
  const [posicion,  setPosicion]  = useState(jugadorActual?.posicion ?? 'DC');
  const [esCapitan, setEsCapitan] = useState(jugadorActual?.capitan ?? false);
  const [saving,    setSaving]    = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const flipTimeout = useRef(null);
  const isFirstRender = useRef(true);

  // Flip card when position changes
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (flipTimeout.current) clearTimeout(flipTimeout.current);
    setIsFlipping(true);
    flipTimeout.current = setTimeout(() => setIsFlipping(false), 350);
    return () => { if (flipTimeout.current) clearTimeout(flipTimeout.current); };
  }, [posicion]);

  async function guardar() {
    const n = nombre.trim();
    if (!n) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'jugadores', jugadorActual.id), { nombre: n, posicion, capitan: esCapitan });
      saveJugadorPersistente(jugadorActual.id, n);
      onSave({ ...jugadorActual, nombre: n, posicion });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="overlay" style={{ alignItems: 'center', padding: '0 12px' }} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '92dvh', overflowY: 'auto', borderRadius: 16 }}>
        <div className="modal-title">
          Editar perfil
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Live sticker preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <StickerCard
            nombre={nombre}
            posicion={posicion}
            isComplete={nombre.trim().length > 0}
            isFlipping={isFlipping}
          />
        </div>

        {/* Name input */}
        <div className="form-group">
          <label className="form-label">Nombre</label>
          <input
            className="form-input"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre"
            maxLength={40}
            onKeyDown={e => e.key === 'Enter' && guardar()}
            disabled={saving}
            autoFocus
          />
        </div>

        {/* Position picker */}
        <div className="form-group">
          <label className="form-label">Posicion</label>
          <div className="onb-pos-scroll" style={{ marginTop: 4 }}>
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

        {/* Captain toggle */}
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="form-label" style={{ marginBottom: 2 }}>Capitán del equipo</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>
              Aparece como insignia en tu tarjeta
            </div>
          </div>
          <button
            type="button"
            className={`btn-capitan${esCapitan ? ' activo' : ''}`}
            onClick={() => setEsCapitan(v => !v)}
            disabled={saving}
          >
            {esCapitan ? '🛡 Capitán' : 'No'}
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className="btn btn-outline btn-full"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="btn btn-gold btn-full"
            onClick={guardar}
            disabled={saving || !nombre.trim()}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CopiarEnlaceBtn({ jugadorId }) {
  const [copied, setCopied] = useState(false);

  function copiar() {
    const url = `${window.location.origin}${window.location.pathname}?uid=${jugadorId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copiar}
      title="Copiar enlace personal"
      style={{
        position: 'absolute', top: 12, left: 14,
        background: 'none', border: 'none',
        color: copied ? '#10b981' : 'var(--text3)',
        cursor: 'pointer', padding: 4,
        fontSize: 16, lineHeight: 1,
        transition: 'color 0.2s',
      }}
    >
      {copied ? '✓' : '🔗'}
    </button>
  );
}

// Detect WhatsApp / Facebook / Instagram / Telegram in-app browsers
function isWebView() {
  const ua = navigator.userAgent || '';
  return /WhatsApp|FBAN|FBAV|Instagram|Telegram|MicroMessenger/i.test(ua);
}

function WebViewBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !isWebView()) return null;

  const url = window.location.href;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  function abrirEnNavegador() {
    if (isIOS) {
      // Deep-link to Safari on iOS
      window.location.href = url;
    } else {
      // On Android, opening with intent triggers browser picker
      window.open(url, '_system');
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(240,192,64,0.97)',
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#040d21', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 0.5, lineHeight: 1.3 }}>
          Para que la app recuerde tu perfil, ábrela en {isIOS ? 'Safari' : 'Chrome'}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(4,13,33,0.65)', marginTop: 2 }}>
          Toca el botón o usa los 3 puntos → "Abrir en {isIOS ? 'Safari' : 'navegador'}"
        </div>
      </div>
      <button
        onClick={abrirEnNavegador}
        style={{
          background: '#040d21', color: 'var(--gold)', border: 'none',
          borderRadius: 8, padding: '8px 12px', fontSize: 11,
          fontWeight: 700, fontFamily: 'Rajdhani, sans-serif',
          letterSpacing: 0.5, cursor: 'pointer', flexShrink: 0,
        }}
      >
        {isIOS ? 'Abrir Safari' : 'Abrir Chrome'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', color: 'rgba(4,13,33,0.5)', fontSize: 18, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}

const TABS = [
  { id: 'semana',   icon: '⚽', label: 'Semana'  },
  { id: 'roster',   icon: '👥', label: 'Roster'  },
  { id: 'sorteo',   icon: '🎲', label: 'Sorteo'  },
  { id: 'penaltis', icon: '🟨', label: 'Penaltis'},
];

// ── Profile persistence — 3 layers ──────────────────────────────────────────
// Layer 1: localStorage  (fast, cleared when user explicitly clears site data)
// Layer 2: Cookie 1yr    (survives "clear cache" on most mobile browsers)
// Layer 3: ?uid= URL     (nuclear fallback — paste link in WhatsApp, always works)

function _setCookie(id) {
  const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `rdm_uid=${encodeURIComponent(id)}; expires=${exp}; path=/; SameSite=Lax`;
}

function _getCookieId() {
  const m = document.cookie.match(/(?:^|;\s*)rdm_uid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function _getUrlUid() {
  return new URLSearchParams(window.location.search).get('uid');
}

function saveJugadorPersistente(id, nombre) {
  localStorage.setItem('rdm_jugador_id',     id);
  localStorage.setItem('rdm_jugador_nombre', nombre);
  _setCookie(id);
}

const ADMIN_HASH = 'rdm-admin-2025';

function checkAdmin() {
  const param = new URLSearchParams(window.location.search).get('admin');
  if (param === ADMIN_HASH) {
    sessionStorage.setItem('rdm_admin', '1');
    // Clean URL
    const clean = window.location.pathname;
    window.history.replaceState({}, '', clean);
    return true;
  }
  return sessionStorage.getItem('rdm_admin') === '1';
}

function leerJugadorLocal() {
  const id =
    localStorage.getItem('rdm_jugador_id') ||
    _getCookieId()                          ||
    _getUrlUid();
  if (!id) return null;
  const nombre = localStorage.getItem('rdm_jugador_nombre') ?? '';
  if (nombre) localStorage.setItem('rdm_jugador_id', id);
  return { id, nombre };
}

export default function App() {
  const [isAdmin, setIsAdmin]           = useState(() => checkAdmin());
  const [jugadorLocal, setJugadorLocal] = useState(() => leerJugadorLocal());
  const [tab, setTab]                   = useState('semana');
  const [jugadores, setJugadores]       = useState([]);
  const [partido, setPartido]           = useState(null);
  const [penaltis, setPenaltis]         = useState([]);
  const [appVisible, setAppVisible]     = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'jugadores'), orderBy('createdAt', 'asc')),
      snap => setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'partidos', getWeekId()), snap => {
      setPartido(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'penaltis'), orderBy('createdAt', 'desc')),
      snap => setPenaltis(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  // When jugadores arrive from Firestore: (1) fill missing nombre from cookie/URL restore,
  // (2) migrate existing users — set cookie if they don't have one yet
  useEffect(() => {
    if (!jugadorLocal?.id || !jugadores.length) return;
    const j = jugadores.find(x => x.id === jugadorLocal.id);
    if (j) {
      // Always re-save so existing users get the cookie on their first visit after this deploy
      saveJugadorPersistente(j.id, j.nombre);
      if (!jugadorLocal.nombre) setJugadorLocal({ id: j.id, nombre: j.nombre });
    }
  }, [jugadores]);

  // Fade app in after onboarding or on first render when already registered
  useEffect(() => {
    if (jugadorLocal) {
      const t = setTimeout(() => setAppVisible(true), 80);
      return () => clearTimeout(t);
    }
  }, [jugadorLocal]);

  function handleOnboardingComplete(jugador) {
    setJugadorLocal(jugador);
  }

  // Resolve the full Firestore player object for the locally-registered user.
  // jugadorLocal only has id + nombre (from localStorage); jugadorActual has all Firestore fields.
  const jugadorActual = useMemo(() => {
    if (!jugadorLocal) return null;
    return jugadores.find(j => j.id === jugadorLocal.id) ?? jugadorLocal;
  }, [jugadorLocal, jugadores]);

  const { playing, started, toggle, prevSong, nextSong, songName } = useAudioPlayer();

  // Show onboarding if no jugador registered (admin bypasses this)
  if (!jugadorLocal && !isAdmin) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className={`app ${appVisible ? 'app-visible' : 'app-hidden'}`} style={{ paddingBottom: 60 }}>
      <WebViewBanner />
      <header className="header">
        <div className="header-badge">
          <span className="header-badge-dot" />
          <span className="header-badge-text">Temporada 2025</span>
        </div>
        <div className="header-title">RDM Fútbol</div>
        <div className="header-subtitle">Liga de Papás</div>
        {partido?.fechaTexto && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, marginTop: 6,
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
          }}>
            <span style={{
              background: 'rgba(240,192,64,0.12)',
              border: '1px solid rgba(240,192,64,0.35)',
              borderRadius: 20, padding: '3px 12px',
              color: 'var(--gold)',
            }}>
              ⚽ {partido.fechaTexto}{partido.horaTexto ? ` · ${partido.horaTexto}` : ''}
            </span>
          </div>
        )}
        <div className="header-line">
          <div className="header-line-bar" />
          <div className="header-line-diamond" />
          <div className="header-line-bar" />
        </div>
        {/* Profile / Admin button — top right corner */}
        {isAdmin ? (
          <div style={{
            position: 'absolute', top: 10, right: 14,
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 8, padding: '4px 8px',
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            color: '#ef4444', fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
          }}>
            ADMIN
          </div>
        ) : (
          <button
            className="header-profile-btn"
            onClick={() => setEditandoPerfil(true)}
            title={`Editar perfil: ${jugadorActual?.nombre ?? ''}`}
            aria-label="Editar perfil"
          >
            <span style={{ fontSize: 16 }}>👤</span>
          </button>
        )}
        {/* Copy personal link — top left corner */}
        {jugadorActual?.id && <CopiarEnlaceBtn jugadorId={jugadorActual.id} />}
      </header>

      {editandoPerfil && jugadorActual && (
        <EditarPerfilModal
          jugadorActual={jugadorActual}
          onClose={() => setEditandoPerfil(false)}
          onSave={updated => setJugadorLocal({ id: updated.id, nombre: updated.nombre })}
        />
      )}

      <nav className="nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === 'semana'   && <EstasSemana jugadores={jugadores} partido={partido} jugadorActual={jugadorActual} penaltis={penaltis} />}
      {tab === 'roster'   && <Jugadores jugadores={jugadores} isAdmin={isAdmin} />}
      {tab === 'sorteo'   && <Sorteo jugadores={jugadores} partido={partido} jugadorActual={jugadorActual} />}
      {tab === 'penaltis' && <Penaltis jugadores={jugadores} penaltis={penaltis} />}
      <MusicBar
        playing={playing}
        started={started}
        songName={songName}
        onToggle={toggle}
        onPrev={prevSong}
        onNext={nextSong}
      />
    </div>
  );
}
