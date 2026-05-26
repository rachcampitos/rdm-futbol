import { useState, useEffect } from 'react';
import {
  collection, addDoc, getDocs, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { POSICION_GRUPOS, POSICION_DETALLADA } from '../utils';

/* ── Onboarding — pantalla de bienvenida estilo FIFA "Press START" ── */
export default function Onboarding({ onComplete }) {
  const [fase, setFase] = useState('intro');   // intro | form | confirming | enter
  const [nombre, setNombre] = useState('');
  const [posicion, setPosicion] = useState('DC');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-advance: "PRESS START" text shows for 2.2s, then drops into form
  useEffect(() => {
    if (fase !== 'intro') return;
    const t = setTimeout(() => setFase('form'), 2200);
    return () => clearTimeout(t);
  }, [fase]);

  async function confirmar() {
    const n = nombre.trim();
    if (!n) { setError('Escribe tu nombre para entrar al partido'); return; }
    setError('');
    setSaving(true);

    try {
      // Search Firestore for existing player with same name (case-insensitive via trim)
      const snap = await getDocs(
        query(collection(db, 'jugadores'), where('nombre', '==', n))
      );

      let jugadorId;
      if (!snap.empty) {
        jugadorId = snap.docs[0].id;
      } else {
        // Create new player
        const ref = await addDoc(collection(db, 'jugadores'), {
          nombre: n,
          posicion,
          activo: true,
          createdAt: serverTimestamp(),
        });
        jugadorId = ref.id;
      }

      // Save to localStorage
      localStorage.setItem('rdm_jugador_id', jugadorId);
      localStorage.setItem('rdm_jugador_nombre', n);
      localStorage.setItem('rdm_jugador_posicion', posicion);

      // Transition: confirm screen then enter
      setSaving(false);
      setFase('confirming');
      setTimeout(() => {
        setFase('enter');
        setTimeout(() => onComplete({ id: jugadorId, nombre: n, posicion }), 900);
      }, 1400);
    } catch (e) {
      console.error(e);
      setError('Error al guardar. Intenta de nuevo.');
      setSaving(false);
    }
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
          <div className="onb-intro-tap" onClick={() => setFase('form')} />
        </div>
      )}

      {/* ── FORM SCREEN ── */}
      {(fase === 'form' || fase === 'confirming' || fase === 'enter') && (
        <div className={`onb-form-wrap ${fase === 'form' ? 'onb-form-enter' : ''}`}>
          {/* Top logo compact */}
          <div className="onb-form-header">
            <div className="onb-form-title">RDM Fútbol</div>
            <div className="onb-form-sub">Liga de Papás — Temporada 2025</div>
            <div className="onb-form-tagline">ELIGE TU POSICIÓN Y ÚNETE</div>
          </div>

          {/* Name input */}
          <div className="onb-field-group">
            <label className="onb-field-label">Tu nombre</label>
            <input
              className="onb-field-input"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError(''); }}
              placeholder="Ej: Carlos Ramírez"
              autoFocus
              maxLength={40}
              onKeyDown={e => e.key === 'Enter' && confirmar()}
              disabled={saving || fase === 'confirming'}
            />
            {error && <div className="onb-error">{error}</div>}
          </div>

          {/* Position picker */}
          <div className="onb-field-group">
            <label className="onb-field-label">Tu posición en la cancha</label>
            <div className="onb-pos-groups">
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
                            boxShadow: `0 0 12px ${cfg.color}44`,
                          } : {}}
                          onClick={() => setPosicion(p)}
                          disabled={saving || fase === 'confirming'}
                          title={cfg.nombre}
                        >
                          <span className="onb-pos-btn-code">{p}</span>
                          <span className="onb-pos-btn-name">{cfg.nombre.replace(/Mediocampo /, 'M. ').replace(/Defensa Central /, 'DC ')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected position preview */}
          {posicion && (
            <div className="onb-pos-preview">
              <div className="onb-pos-preview-badge" style={{
                borderColor: POSICION_DETALLADA[posicion]?.color,
                color: POSICION_DETALLADA[posicion]?.color,
                background: POSICION_DETALLADA[posicion]?.bg,
              }}>
                {posicion}
              </div>
              <div className="onb-pos-preview-name">
                {POSICION_DETALLADA[posicion]?.nombre}
              </div>
            </div>
          )}

          {/* CTA Button */}
          {fase !== 'confirming' ? (
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
          ) : (
            <div className="onb-confirm-screen">
              <div className="onb-confirm-ball">⚽</div>
              <div className="onb-confirm-text">
                Bienvenido, <strong>{nombre}</strong>
              </div>
              <div className="onb-confirm-sub">Cargando la cancha...</div>
            </div>
          )}

          <div className="onb-footer">
            Tus datos se guardan solo para identificarte en la lista semanal
          </div>
        </div>
      )}
    </div>
  );
}
