import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getInitials, getPosicionConfig, getPosicionLabel, calcStats, getRating, getCardTier } from '../utils';
import { PlayerSilhouette } from './PlayerSilhouette';

const TIPOS = [
  { value: 'falta_injustificada', label: 'Falta injustificada', emoji: '🍺', esDoce: true },
  { value: 'cancelacion_tardia',  label: 'Cancelación tardía',  emoji: '⏰' },
  { value: 'no_show',             label: 'No se presentó',      emoji: '👻' },
  { value: 'otro',                label: 'Otro',                emoji: '📋' },
];



export default function JugadorModal({ jugador, convocado, penaltisJugador, onClose, onAddPenalti, onSubirComprobante, subiendoComprobante, esMvp = false }) {
  const [tipoSel, setTipoSel]         = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando]     = useState(false);
  const [ready, setReady]             = useState(false);
  const [imgExpanded, setImgExpanded] = useState(false);

  // Delay click-to-close by one frame so ghost taps from the row click don't
  // immediately dismiss the modal on mobile (touch → click fires on overlay).
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const overall  = getRating(jugador);
  const tier     = esMvp ? 'inform' : (jugador.cardVariant ?? getCardTier(overall));
  const cfg      = getPosicionConfig(jugador.posicion);
  const posLabel = getPosicionLabel(jugador.posicion);
  const stats    = calcStats(jugador);

  const confirmado = convocado?.estado === 'confirmado';
  const pagado     = convocado?.pagado === true;

  const historial = (penaltisJugador ?? []).slice(0, 3);

  function selTipo(t) {
    if (tipoSel?.value === t.value) {
      setTipoSel(null);
      setConfirmando(false);
    } else {
      setTipoSel(t);
      setConfirmando(false);
    }
  }

  async function confirmarPenalti() {
    if (!tipoSel || guardando) return;
    if (!confirmando) { setConfirmando(true); return; }
    setGuardando(true);
    const monto = tipoSel.esDoce ? 1 : 20;
    await onAddPenalti(tipoSel.value, monto);
    setGuardando(false);
    onClose();
  }

  return createPortal(
    <div className="overlay" style={{ alignItems: 'center', padding: '0 12px' }} onClick={e => ready && e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '92dvh', overflowY: 'auto', padding: '0 0 20px', borderRadius: 16 }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(240,192,64,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: 'Bebas Neue, Rajdhani, sans-serif', fontSize: 18, letterSpacing: 2, color: 'var(--gold)' }}>
              {jugador.nombre}
            </div>
            {jugador.capitan && (
              <span className="capitan-badge">C</span>
            )}
            {esMvp && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                color: '#ef4444', background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 20, padding: '3px 8px',
                fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
              }}>
                ⚡ Jugador de la semana
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* FUT Card */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 16px 10px' }}>
          <div
            className={`fut-card fut-card-${tier}`}
            style={{ width: 140, height: 210, borderRadius: 12, flexShrink: 0 }}
          >
            <div className="fut-card-inner">
              <div className="fut-card-top">
                <div>
                  <div className="fut-card-overall">{overall}</div>
                  <div className="fut-card-pos">{posLabel}</div>
                  {(jugador.posicionesAlt ?? []).length > 0 && (
                    <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)', fontFamily: 'Rajdhani', letterSpacing: 0.3, lineHeight: 1, marginTop: 1, textAlign: 'center' }}>
                      {jugador.posicionesAlt.map(p => getPosicionLabel(p)).join('·')}
                    </div>
                  )}
                  {jugador.capitan && <div className="fut-card-capitan-c">C</div>}
                </div>
                <div className="fut-card-flag">🇵🇪</div>
              </div>
              <div className="fut-card-avatar-wrap">
                <div className="fut-card-avatar">
                  <PlayerSilhouette posicion={jugador.posicion} />
                </div>
              </div>
              <div className="fut-card-name">{jugador.nombre.split(' ')[0]}</div>
              <div className="fut-card-divider" />
              <div className="fut-card-stats">
                {[
                  ['PAC', stats.pac],
                  ['TIR', stats.tir],
                  ['PAS', stats.pas],
                  ['REG', stats.reg],
                  ['DEF', stats.def],
                  ['FIS', stats.fis],
                ].map(([lbl, val]) => (
                  <div key={lbl} className="fut-card-stat">
                    <div className="fut-card-stat-num">{val}</div>
                    <div className="fut-card-stat-label">{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Week status badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 16px 16px' }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1,
            color: confirmado ? '#10b981' : 'var(--text3)',
            background: confirmado ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${confirmado ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
            borderRadius: 20, padding: '3px 10px',
            fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
          }}>
            {confirmado ? 'Confirmado' : 'Sin confirmar'}
          </span>
          {confirmado && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1,
              color: pagado ? 'var(--gold)' : 'var(--text3)',
              background: pagado ? 'rgba(240,192,64,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${pagado ? 'rgba(240,192,64,0.3)' : 'var(--border)'}`,
              borderRadius: 20, padding: '3px 10px',
              fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
            }}>
              {pagado ? 'Pagó' : 'Pendiente pago'}
            </span>
          )}
        </div>

        {/* Payment proof */}
        {(convocado?.pagoUrl || (pagado && onSubirComprobante)) && (
          <div style={{ padding: '0 16px 16px' }}>
            {convocado?.pagoUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setImgExpanded(true)}
                  style={{
                    padding: 0, border: '2px solid rgba(240,192,64,0.4)', borderRadius: 8,
                    overflow: 'hidden', cursor: 'pointer', background: 'none', flexShrink: 0,
                  }}
                >
                  <img
                    src={convocado.pagoUrl}
                    alt="Comprobante"
                    style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }}
                  />
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                    Comprobante de pago
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setImgExpanded(true)}
                      style={{ fontSize: 10 }}
                    >
                      Ver
                    </button>
                    {onSubirComprobante && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={onSubirComprobante}
                        disabled={subiendoComprobante}
                        style={{ fontSize: 10 }}
                      >
                        {subiendoComprobante ? 'Subiendo...' : 'Reemplazar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              onSubirComprobante && (
                <button
                  className="btn btn-outline btn-full"
                  onClick={onSubirComprobante}
                  disabled={subiendoComprobante}
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {subiendoComprobante ? '⏳ Subiendo...' : '📷 Subir comprobante'}
                </button>
              )
            )}
          </div>
        )}

        {/* Expanded image overlay */}
        {imgExpanded && createPortal(
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: 'rgba(0,0,0,0.92)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setImgExpanded(false)}
          >
            <img
              src={convocado.pagoUrl}
              alt="Comprobante"
              style={{ maxWidth: '100%', maxHeight: '85dvh', borderRadius: 12, objectFit: 'contain' }}
              onClick={e => e.stopPropagation()}
            />
            <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1 }}>
              Toca fuera para cerrar
            </div>
          </div>,
          document.body
        )}

        {/* Penalty history */}
        <div style={{ padding: '0 16px' }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 2,
            color: 'var(--text3)', textTransform: 'uppercase',
            fontFamily: 'Rajdhani, sans-serif', marginBottom: 8,
          }}>
            Historial de penaltis
          </div>

          {historial.length === 0 ? (
            <div style={{
              fontSize: 11, color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif',
              padding: '10px 0', textAlign: 'center', letterSpacing: 1,
            }}>
              Sin penaltis registrados
            </div>
          ) : (
            historial.map(p => {
              const tipoInfo = TIPOS.find(t => t.value === p.tipo) ?? TIPOS[3];
              const fecha = p.createdAt?.toDate?.()
                ? p.createdAt.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                : '';
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px',
                    background: p.pagado ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.07)',
                    border: `1px solid ${p.pagado ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    borderRadius: 8, marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{tipoInfo.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.2 }}>
                      {tipoInfo.label}
                    </div>
                    {fecha && (
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 0.5 }}>
                        {fecha}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 14, fontWeight: 700, color: p.pagado ? '#10b981' : 'var(--red2)' }}>
                      {tipoInfo.esDoce ? `🍺 ×${p.monto ?? 1}` : `S/ ${(p.monto ?? 0).toLocaleString()}`}
                    </div>
                    <div style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: 1,
                      color: p.pagado ? '#10b981' : 'var(--text3)',
                      fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
                    }}>
                      {p.pagado ? 'Cobrado' : 'Pendiente'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick penalty section */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 2,
            color: 'var(--text3)', textTransform: 'uppercase',
            fontFamily: 'Rajdhani, sans-serif', marginBottom: 10,
          }}>
            Registrar penalti
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {TIPOS.map(t => {
              const sel = tipoSel?.value === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => selTipo(t)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4, padding: '10px 8px',
                    background: sel ? 'rgba(240,192,64,0.14)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${sel ? 'rgba(240,192,64,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: sel ? '0 0 12px rgba(240,192,64,0.2)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{t.emoji}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                    color: sel ? 'var(--gold)' : 'var(--text2)',
                    fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
                    textAlign: 'center', lineHeight: 1.3,
                  }}>
                    {t.label}
                  </span>
                  {t.esDoce && (
                    <span style={{ fontSize: 8, color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif' }}>
                      1 doce
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tipoSel && (
            <button
              className={`btn btn-full ${confirmando ? 'btn-gold' : 'btn-outline'}`}
              onClick={confirmarPenalti}
              disabled={guardando}
              style={{
                fontSize: 13, fontWeight: 700, letterSpacing: 1,
                transition: 'all 0.15s',
              }}
            >
              {guardando
                ? 'Guardando...'
                : confirmando
                  ? `Seguro? Registrar ${tipoSel.emoji} ${tipoSel.label}`
                  : `Registrar ${tipoSel.emoji} ${tipoSel.label}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
