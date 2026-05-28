import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const CLOUDINARY_CLOUD = 'dml5vqnmu';
const CLOUDINARY_PRESET = 'rdm-futbol-pagos';

async function uploadToCloudinary(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.secure_url;
}
import { getWeekId, getInitials, formatFecha, getPosicionConfig, getPosicionLabel } from '../utils';
import JugadorModal from '../components/JugadorModal';

function getRating(jugador) {
  if (jugador.overall) return jugador.overall;
  const base = { portero: 72, defensa: 68, mediocampo: 70, delantero: 74 };
  const cat = jugador.categoria ?? jugador.posicion ?? 'mediocampo';
  return base[cat] ?? 70;
}

function hashInt(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(33, h) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

function calcStats(jugador) {
  const overall = getRating(jugador);
  const seed = hashInt(jugador.id ?? jugador.nombre ?? '?');

  // Position-aware weights: [pac, tir, pas, reg, def, fis]
  const W = {
    POR:  [0.74, 0.62, 0.78, 0.72, 0.93, 0.90],
    LTI:  [0.90, 0.72, 0.85, 0.84, 0.90, 0.86],
    DTI:  [0.83, 0.68, 0.80, 0.78, 0.94, 0.88],
    DFC:  [0.76, 0.66, 0.77, 0.74, 0.97, 0.92],
    DFCi: [0.76, 0.66, 0.77, 0.74, 0.97, 0.92],
    DFCd: [0.76, 0.66, 0.77, 0.74, 0.97, 0.92],
    LTD:  [0.90, 0.74, 0.85, 0.84, 0.90, 0.86],
    DTD:  [0.83, 0.68, 0.80, 0.78, 0.94, 0.88],
    MC:   [0.84, 0.82, 0.93, 0.88, 0.80, 0.84],
    MCD:  [0.80, 0.74, 0.88, 0.82, 0.91, 0.88],
    MCO:  [0.86, 0.90, 0.95, 0.93, 0.62, 0.80],
    EXI:  [0.96, 0.84, 0.86, 0.93, 0.58, 0.82],
    EXD:  [0.96, 0.84, 0.86, 0.93, 0.58, 0.82],
    SD:   [0.88, 0.95, 0.80, 0.88, 0.50, 0.84],
    DC:   [0.85, 0.97, 0.77, 0.86, 0.46, 0.87],
  };
  const w = W[jugador.posicion] ?? [0.88, 0.88, 0.88, 0.88, 0.75, 0.85];

  function stat(wi, offset) {
    const r = ((seed * (offset * 2654435761)) >>> 0) % 8;
    return Math.min(99, Math.round(overall * wi + r));
  }

  return {
    pac: jugador.pac ?? stat(w[0], 1),
    tir: jugador.tir ?? stat(w[1], 2),
    pas: jugador.pas ?? stat(w[2], 3),
    reg: jugador.reg ?? stat(w[3], 4),
    def: jugador.def ?? stat(w[4], 5),
    fis: jugador.fis ?? stat(w[5], 6),
  };
}

function getCardTier(overall) {
  if (overall >= 85) return 'elite';
  if (overall >= 75) return 'gold';
  if (overall >= 65) return 'silver';
  return 'bronze';
}

export default function EstasSemana({ jugadores, partido, jugadorActual, penaltis = [] }) {
  const [cuotaEdit, setCuotaEdit]         = useState(false);
  const [cuotaInput, setCuotaInput]       = useState('');
  const [jugadorViendo, setJugadorViendo] = useState(null);
  const [partidoEdit, setPartidoEdit]     = useState(false);
  const [fechaInput, setFechaInput]       = useState('');
  const [horaInput, setHoraInput]         = useState('9 PM');
  const [canchaInput, setCanchaInput]     = useState('');
  const [subiendo, setSubiendo]           = useState(false);
  const [subiendoAdmin, setSubiendoAdmin] = useState(false);
  const fileInputRef                      = useRef(null);
  const adminFileInputRef                 = useRef(null);

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

  async function subirComprobante(file) {
    if (!miJugador || !file || subiendo) return;
    setSubiendo(true);
    try {
      const url  = await uploadToCloudinary(file);
      const base = partido?.convocados ?? [];
      const idx  = base.findIndex(c => c.jugadorId === miJugador.id);
      if (idx !== -1) {
        const nuevos = base.map((c, i) => i === idx ? { ...c, pagoUrl: url } : c);
        await updateDoc(doc(db, 'partidos', weekId), { convocados: nuevos });
      }
    } finally {
      setSubiendo(false);
    }
  }

  async function subirComprobanteAdmin(file) {
    if (!jugadorViendo || !file || subiendoAdmin) return;
    setSubiendoAdmin(true);
    try {
      const url  = await uploadToCloudinary(file);
      const base = partido?.convocados ?? [];
      const idx  = base.findIndex(c => c.jugadorId === jugadorViendo.id);
      if (idx !== -1) {
        const nuevos = base.map((c, i) => i === idx ? { ...c, pagoUrl: url } : c);
        await updateDoc(doc(db, 'partidos', weekId), { convocados: nuevos });
      }
    } finally {
      setSubiendoAdmin(false);
    }
  }

  async function guardarCuota() {
    const val = parseInt(cuotaInput, 10);
    if (!val || val < 0) return;
    await ensurePartido();
    await updateDoc(doc(db, 'partidos', weekId), { cuota: val });
    setCuotaEdit(false);
  }

  async function guardarInfoPartido() {
    await ensurePartido();
    await updateDoc(doc(db, 'partidos', weekId), {
      fechaTexto: fechaInput.trim(),
      horaTexto:  horaInput,
      cancha:     canchaInput.trim(),
    });
    setPartidoEdit(false);
  }

  function abrirEditPartido() {
    setFechaInput(partido?.fechaTexto ?? '');
    setHoraInput(partido?.horaTexto ?? '9 PM');
    setCanchaInput(partido?.cancha ?? '');
    setPartidoEdit(true);
  }

  async function handleAddPenalti(tipo, monto) {
    if (!jugadorViendo) return;
    await addDoc(collection(db, 'penaltis'), {
      jugadorId: jugadorViendo.id,
      nombre: jugadorViendo.nombre,
      tipo,
      monto,
      pagado: false,
      createdAt: serverTimestamp(),
    });
  }

  // Squad list: only players who confirmed for this week
  const squadOrdenado = activos.filter(j => convocadoMap[j.id]?.estado === 'confirmado');

  return (
    <div className="page">
      <div className="page-title">
        <span style={{ fontSize: 18 }}>⚽</span>
        Esta <span>Semana</span>
      </div>

      {/* ── PRÓXIMO PARTIDO ── */}
      <div className="week-card" style={{ marginBottom: 14, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 2,
            color: 'var(--text3)', textTransform: 'uppercase',
            fontFamily: 'Rajdhani, sans-serif', marginBottom: 6,
          }}>
            Próximo partido
          </div>
          <button
            className="btn btn-outline btn-sm"
            style={{ fontSize: 9, padding: '3px 8px' }}
            onClick={abrirEditPartido}
          >
            Editar
          </button>
        </div>

        {partido?.fechaTexto ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              fontFamily: 'Bebas Neue, Rajdhani, sans-serif',
              fontSize: 26, fontWeight: 400, letterSpacing: 1,
              color: 'var(--gold)', lineHeight: 1,
            }}>
              {partido.fechaTexto}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
              {partido.horaTexto && (
                <span style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--text)',
                  fontFamily: 'Rajdhani, sans-serif', letterSpacing: 0.5,
                }}>
                  🕐 {partido.horaTexto}
                </span>
              )}
              {partido.cancha && (
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text2)',
                  fontFamily: 'Rajdhani, sans-serif',
                }}>
                  📍 {partido.cancha}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: 12, color: 'var(--text3)', fontFamily: 'Rajdhani, sans-serif',
            letterSpacing: 0.5, paddingTop: 2,
          }}>
            Sin fecha definida — toca Editar para agregar
          </div>
        )}
      </div>

      {/* Edit partido modal */}
      {partidoEdit && createPortal(
        <div className="overlay" style={{ alignItems: 'center', padding: '0 12px' }} onClick={e => e.target === e.currentTarget && setPartidoEdit(false)}>
          <div className="modal" style={{ borderRadius: 16 }}>
            <div className="modal-title">
              Info del partido
              <button className="modal-close" onClick={() => setPartidoEdit(false)}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input
                className="form-input"
                value={fechaInput}
                onChange={e => setFechaInput(e.target.value)}
                placeholder="Ej: Miércoles 3 de junio"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hora</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['9 PM', '10 PM'].map(h => (
                  <button
                    key={h}
                    className={`btn ${horaInput === h ? 'btn-gold' : 'btn-outline'}`}
                    style={{ flex: 1, fontSize: 14, fontWeight: 700 }}
                    onClick={() => setHoraInput(h)}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Cancha</label>
              <input
                className="form-input"
                value={canchaInput}
                onChange={e => setCanchaInput(e.target.value)}
                placeholder="Ej: Cancha Los Pinos"
              />
            </div>

            <button
              className="btn btn-gold btn-full"
              onClick={guardarInfoPartido}
              disabled={!fechaInput.trim()}
              style={{ marginTop: 4 }}
            >
              Guardar
            </button>
          </div>
        </div>,
        document.body
      )}

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
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobante(f); e.target.value = ''; }}
          />
          <MiTarjeta
            jugador={miJugador}
            confirmado={yoConfirmado}
            pague={yoPague}
            pagoUrl={miConv?.pagoUrl}
            subiendo={subiendo}
            onToggleAsistencia={toggleMiAsistencia}
            onTogglePago={toggleMiPago}
            onSubirComprobante={() => fileInputRef.current?.click()}
            weekId={weekId}
            cuota={cuota}
          />
        </>
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
            onClick={() => setJugadorViendo(j)}
            style={{ cursor: 'pointer' }}
          >
            <div className="player-avatar" style={{ borderColor: cfg.color, color: cfg.color }}>
              {getInitials(j.nombre)}
            </div>
            <div className="player-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="player-name">{j.nombre}</div>
                {j.capitan && <span className="capitan-badge">C</span>}
                {esYo && <span className="yo-badge">TÚ</span>}
              </div>
              <span
                className="player-pos-badge"
                style={{ color: cfg.color, background: cfg.bg }}
              >
                {getPosicionLabel(j.posicion)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
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
              <span style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1 }}>›</span>
            </div>
          </div>
        );
      })}

      {jugadorViendo && (
        <>
          <input
            ref={adminFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) subirComprobanteAdmin(f); e.target.value = ''; }}
          />
          <JugadorModal
            jugador={jugadorViendo}
            convocado={convocadoMap[jugadorViendo.id]}
            penaltisJugador={penaltis.filter(p => p.jugadorId === jugadorViendo.id)}
            jugadorActual={jugadorActual}
            onClose={() => setJugadorViendo(null)}
            onAddPenalti={handleAddPenalti}
            onSubirComprobante={() => adminFileInputRef.current?.click()}
            subiendoComprobante={subiendoAdmin}
          />
        </>
      )}

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
function MiTarjeta({ jugador, confirmado, pague, pagoUrl, subiendo, onToggleAsistencia, onTogglePago, onSubirComprobante, weekId, cuota }) {
  const overall  = getRating(jugador);
  const tier     = getCardTier(overall);
  const cfg      = getPosicionConfig(jugador.posicion);
  const posLabel = getPosicionLabel(jugador.posicion);
  const stats    = calcStats(jugador);

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
          style={{ width: 140, height: 210, borderRadius: 12, flexShrink: 0 }}
        >
          <div className="fut-card-inner">
            <div className="fut-card-top">
              <div>
                <div className="fut-card-overall">{overall}</div>
                <div className="fut-card-pos">{posLabel}</div>
                {jugador.capitan && <div className="fut-card-capitan-c">C</div>}
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

      {/* Comprobante upload — only when paid */}
      {confirmado && pague && (
        <div style={{ marginTop: 10 }}>
          {pagoUrl ? (
            <ComprobanteThumb url={pagoUrl} onReemplazar={onSubirComprobante} subiendo={subiendo} />
          ) : (
            <button
              className="btn btn-outline btn-full"
              onClick={onSubirComprobante}
              disabled={subiendo}
              style={{ fontSize: 12, gap: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {subiendo ? '⏳ Subiendo...' : '📷 Subir comprobante Yape'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ComprobanteThumb({ url, onReemplazar, subiendo }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setExpanded(true)}
          style={{
            padding: 0, border: '2px solid rgba(16,185,129,0.4)', borderRadius: 8,
            overflow: 'hidden', cursor: 'pointer', flexShrink: 0, background: 'none',
          }}
        >
          <img src={url} alt="Comprobante" style={{ width: 64, height: 64, objectFit: 'cover', display: 'block' }} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            ✓ Comprobante subido
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={onReemplazar}
            disabled={subiendo}
            style={{ fontSize: 10 }}
          >
            {subiendo ? 'Subiendo...' : 'Reemplazar'}
          </button>
        </div>
      </div>

      {expanded && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setExpanded(false)}
        >
          <img
            src={url}
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
    </>
  );
}
