import { useState, useRef, useMemo } from 'react';
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
import { getWeekId, getInitials, formatFecha, getPosicionConfig, getPosicionLabel, calcStats, getRating, getCardTier } from '../utils';
import JugadorModal from '../components/JugadorModal';



export default function EstasSemana({ jugadores, partido, jugadorActual, penaltis = [], onEditarPerfil, isAdmin, rachasMap = {}, weeklyMvpId }) {
  const [cuotaEdit, setCuotaEdit]         = useState(false);
  const [cuotaInput, setCuotaInput]       = useState('');
  const [cuotaError, setCuotaError]       = useState('');
  const [jugadorViendo, setJugadorViendo] = useState(null);
  const [partidoEdit, setPartidoEdit]     = useState(false);
  const [fechaInput, setFechaInput]       = useState('');
  const [horaInput, setHoraInput]         = useState('9 PM');
  const [canchaInput, setCanchaInput]     = useState('');
  const [subiendo, setSubiendo]           = useState(false);
  const [subiendoAdmin, setSubiendoAdmin] = useState(false);
  const [waCopiado, setWaCopiado]         = useState(false);
  const [subiendoMapa, setSubiendoMapa]   = useState(false);
  const [mapaExpanded, setMapaExpanded]   = useState(false);
  const fileInputRef                      = useRef(null);
  const adminFileInputRef                 = useRef(null);
  const mapaFileInputRef                  = useRef(null);

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
        confirmedAt: serverTimestamp(),
      }];
    } else if (base[idx].estado === 'confirmado') {
      // Was confirmed → remove (baja)
      nuevos = base.filter((_, i) => i !== idx);
    } else {
      // Was baja → confirm again
      nuevos = base.map((c, i) => i === idx ? { ...c, estado: 'confirmado', confirmedAt: serverTimestamp() } : c);
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
        await Promise.all([
          updateDoc(doc(db, 'partidos', weekId), { convocados: nuevos }),
          // Also persist on the player doc — survives partido resets
          updateDoc(doc(db, 'jugadores', miJugador.id), { [`pagos.${weekId}`]: url }),
        ]);
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
        await Promise.all([
          updateDoc(doc(db, 'partidos', weekId), { convocados: nuevos }),
          // Also persist on the player doc — survives partido resets
          updateDoc(doc(db, 'jugadores', jugadorViendo.id), { [`pagos.${weekId}`]: url }),
        ]);
      }
    } finally {
      setSubiendoAdmin(false);
    }
  }

  async function subirMapa(file) {
    if (!file || subiendoMapa) return;
    setSubiendoMapa(true);
    try {
      const url = await uploadToCloudinary(file);
      await ensurePartido();
      await updateDoc(doc(db, 'partidos', weekId), { mapaUrl: url });
    } finally {
      setSubiendoMapa(false);
    }
  }

  async function guardarCuota() {
    const val = parseInt(cuotaInput, 10);
    if (!val || val < 100) {
      setCuotaError('Ingresa un monto válido (mínimo S/ 100)');
      return;
    }
    setCuotaError('');
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

  function copiarConvocatoria() {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const fecha = partido?.fechaTexto ? `${partido.fechaTexto}${partido.horaTexto ? ` · ${partido.horaTexto}` : ''}` : 'esta semana';
    const lines = activos.map(j => `• ${j.nombre} → ${baseUrl}?uid=${j.id}`);
    const msg = `⚽ *RDM Fútbol* — ${fecha}\nConfirma tu asistencia:\n\n${lines.join('\n')}`;
    navigator.clipboard?.writeText(msg).then(() => {
      setWaCopiado(true);
      setTimeout(() => setWaCopiado(false), 2500);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = msg;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setWaCopiado(true);
      setTimeout(() => setWaCopiado(false), 2500);
    });
  }

  // Squad list: confirmed players ordered by:
  // 1) Has comprobante → by confirmedAt asc
  // 2) No comprobante, within 24h → by confirmedAt asc
  // 3) No comprobante, after 24h → by confirmedAt asc (penalized)
  const VEINTICUATRO_H = 24 * 60 * 60 * 1000;
  const ahora = Date.now();

  function getConfirmedMs(conv) {
    const d = conv?.confirmedAt?.toDate?.();
    return d ? d.getTime() : null;
  }

  const squadOrdenado = activos
    .filter(j => convocadoMap[j.id]?.estado === 'confirmado')
    .sort((a, b) => {
      const ca = convocadoMap[a.id];
      const cb = convocadoMap[b.id];
      const aTs = getConfirmedMs(ca);
      const bTs = getConfirmedMs(cb);
      const aVencido = !ca?.pagoUrl && aTs !== null && (ahora - aTs) > VEINTICUATRO_H;
      const bVencido = !cb?.pagoUrl && bTs !== null && (ahora - bTs) > VEINTICUATRO_H;
      const gA = ca?.pagoUrl ? 0 : aVencido ? 2 : 1;
      const gB = cb?.pagoUrl ? 0 : bVencido ? 2 : 1;
      if (gA !== gB) return gA - gB;
      if (aTs === null && bTs === null) return 0;
      if (aTs === null) return 1;
      if (bTs === null) return -1;
      return aTs - bTs;
    });

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

        {/* Mapa de cancha */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <input
            ref={mapaFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) subirMapa(f); e.target.value = ''; }}
          />
          {partido?.mapaUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setMapaExpanded(true)}
                style={{ padding: 0, border: '2px solid rgba(240,192,64,0.35)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'none', flexShrink: 0 }}
              >
                <img src={partido.mapaUrl} alt="Mapa cancha" style={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', fontFamily: 'Rajdhani', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>
                  🗺️ Mapa de cancha
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setMapaExpanded(true)} style={{ fontSize: 10 }}>
                    Ver
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => mapaFileInputRef.current?.click()} disabled={subiendoMapa} style={{ fontSize: 10 }}>
                    {subiendoMapa ? 'Subiendo...' : 'Reemplazar'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-outline btn-full"
              onClick={() => mapaFileInputRef.current?.click()}
              disabled={subiendoMapa}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {subiendoMapa ? '⏳ Subiendo...' : '🗺️ Subir mapa de cancha'}
            </button>
          )}
        </div>

        {/* Mapa expanded */}
        {mapaExpanded && partido?.mapaUrl && createPortal(
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => setMapaExpanded(false)}
          >
            <img
              src={partido.mapaUrl}
              alt="Mapa cancha"
              style={{ maxWidth: '100%', maxHeight: '85dvh', borderRadius: 12, objectFit: 'contain' }}
              onClick={e => e.stopPropagation()}
            />
            <div style={{ marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Rajdhani', letterSpacing: 1 }}>
              Toca fuera para cerrar
            </div>
          </div>,
          document.body
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
          {/* TODO C-4: file input needs label wrapper — blocked because input lives in parent scope while trigger button is inside MiTarjeta child component */}
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
            onEditarPerfil={onEditarPerfil}
            weekId={weekId}
            cuota={cuota}
            racha={rachasMap[miJugador.id] ?? 0}
            esMvp={weeklyMvpId === miJugador.id}
          />
        </>
      )}

      {/* ── SECCIÓN B: SQUAD DE LA SEMANA ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 6 }}>
        <div className="section-label" style={{ marginTop: 0, marginBottom: 0, border: 'none' }}>Squad de la semana</div>
        {isAdmin && activos.length > 0 && (
          <button
            onClick={copiarConvocatoria}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: waCopiado ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${waCopiado ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              fontSize: 10, fontWeight: 700, fontFamily: 'Rajdhani',
              color: waCopiado ? '#10b981' : 'var(--text2)',
              letterSpacing: 0.5, transition: 'all 0.2s',
            }}
          >
            {waCopiado ? '✓ Copiado' : '📲 WhatsApp'}
          </button>
        )}
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
        const convTs     = getConfirmedMs(conv);
        const vencido    = !conv?.pagoUrl && convTs !== null && (ahora - convTs) > VEINTICUATRO_H;

        return (
          <div
            key={j.id}
            className={`player-row squad-player-row ${confirmado ? 'confirmed' : ''} ${esYo ? 'es-yo' : ''}`}
            onClick={() => setJugadorViendo(j)}
            style={{ cursor: 'pointer', opacity: vencido ? 0.7 : 1 }}
          >
            <div className="player-avatar" style={{ borderColor: cfg.color, color: cfg.color }}>
              {getInitials(j.nombre)}
            </div>
            <div className="player-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="player-name">{j.nombre}</div>
                {j.capitan && <span className="capitan-badge">C</span>}
                {esYo && <span className="yo-badge">TÚ</span>}
                {vencido && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
                    color: '#f59e0b', background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    borderRadius: 4, padding: '1px 5px',
                    fontFamily: 'Rajdhani, sans-serif', textTransform: 'uppercase',
                  }}>
                    ⏰ +24h
                  </span>
                )}
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
            esMvp={weeklyMvpId === jugadorViendo.id}
          />
        </>
      )}

      {/* ── SECCIÓN C: VOTACIÓN MVP ── */}
      {partido?.cerrado && (
        <VotacionMvp
          partido={partido}
          jugadores={jugadores}
          miJugadorId={miJugador?.id}
          weekId={weekId}
          weeklyMvpId={weeklyMvpId}
        />
      )}

      {/* ── SECCIÓN D: CUOTA ── */}
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
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                type="number"
                value={cuotaInput}
                onChange={e => { setCuotaInput(e.target.value); setCuotaError(''); }}
                placeholder="Monto"
                autoFocus
              />
              <button className="btn btn-gold" onClick={guardarCuota}>OK</button>
              <button className="btn btn-outline" onClick={() => { setCuotaEdit(false); setCuotaError(''); }}>✕</button>
            </div>
            {cuotaError && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontFamily: 'Rajdhani' }}>
                {cuotaError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom spacer for mobile thumb reach */}
      <div style={{ height: 24 }} />
    </div>
  );
}

// ── Mi Tarjeta — the hero component ────────────────────────────────────────
function MiTarjeta({ jugador, confirmado, pague, pagoUrl, subiendo, onToggleAsistencia, onTogglePago, onSubirComprobante, onEditarPerfil, weekId, cuota, racha = 0, esMvp = false }) {
  const overall  = getRating(jugador);
  const tier     = esMvp ? 'inform' : (jugador.cardVariant ?? getCardTier(overall));
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

      {/* MVP / Racha badges */}
      {(esMvp || racha >= 2) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {esMvp && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, fontFamily: 'Rajdhani',
              color: '#ef4444', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 20, padding: '3px 12px', letterSpacing: 0.5,
            }}>
              ⚡ Jugador de la semana
            </span>
          )}
          {racha >= 2 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, fontFamily: 'Rajdhani',
              color: '#f97316', background: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.35)',
              borderRadius: 20, padding: '3px 12px', letterSpacing: 0.5,
            }}>
              🔥 {racha} semanas seguidas
            </span>
          )}
        </div>
      )}

      {/* Edit profile — glow pulse CTA */}
      {onEditarPerfil && (
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <button
            onClick={onEditarPerfil}
            style={{
              background: 'rgba(240,192,64,0.08)',
              border: '1.5px solid rgba(240,192,64,0.45)',
              borderRadius: 20,
              padding: '6px 20px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              color: 'var(--gold)',
              fontFamily: 'Rajdhani, sans-serif',
              textTransform: 'uppercase',
              cursor: 'pointer',
              animation: 'glow-pulse 2s ease infinite',
            }}
          >
            ✎ Editar perfil
          </button>
        </div>
      )}

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
          <span className="btn-accion-label">{confirmado ? 'CONFIRMADO' : 'VOY'}</span>
        </button>

        <button
          className={`btn-pague ${pague ? 'activo' : ''}`}
          onClick={onTogglePago}
          disabled={!confirmado}
        >
          <span className="btn-accion-check">{pague ? '✓' : 'S/'}</span>
          <span className="btn-accion-label">{pague ? 'PAGUÉ' : 'PAGAR'}</span>
        </button>
      </div>

      {/* Disabled PAGUÉ hint — only shown when not confirmed */}
      {!confirmado && (
        <div style={{
          textAlign: 'center', fontSize: 10, color: 'var(--text3)',
          letterSpacing: 0.5, fontFamily: 'Rajdhani, sans-serif', marginTop: 4,
        }}>
          Confirma con VOY antes de marcar el pago
        </div>
      )}

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

function VotacionMvp({ partido, jugadores, miJugadorId, weekId, weeklyMvpId }) {
  const participantes = useMemo(() => {
    const ids = [...(partido.equipoA ?? []), ...(partido.equipoB ?? [])];
    return ids.map(id => jugadores.find(j => j.id === id)).filter(Boolean);
  }, [partido, jugadores]);

  if (participantes.length === 0) return null;

  const mvpVotos   = partido.mvpVotos ?? {};
  const totalVotos = Object.keys(mvpVotos).length;
  const miVoto     = miJugadorId ? mvpVotos[miJugadorId] : null;

  const conteo = {};
  Object.values(mvpVotos).forEach(id => { conteo[id] = (conteo[id] ?? 0) + 1; });
  const maxVotos = Math.max(...Object.values(conteo), 0);

  const lista = participantes
    .map(j => ({ ...j, votos: conteo[j.id] ?? 0 }))
    .sort((a, b) => b.votos - a.votos);

  async function votar(jugadorId) {
    if (!miJugadorId || miVoto) return;
    await updateDoc(doc(db, 'partidos', weekId), {
      [`mvpVotos.${miJugadorId}`]: jugadorId,
    });
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="section-label" style={{ marginTop: 0, marginBottom: 0, border: 'none' }}>
          ⚡ Jugador de la semana
        </div>
        {totalVotos > 0 && (
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>
            {totalVotos} voto{totalVotos !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {!miVoto && miJugadorId && (
        <div style={{
          fontSize: 10, color: 'var(--text3)', fontFamily: 'Rajdhani',
          letterSpacing: 0.5, marginBottom: 10,
        }}>
          Vota por el mejor del partido — un voto por persona
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {lista.map(j => {
          const esMiVoto  = miVoto === j.id;
          const esLider   = j.votos > 0 && j.votos === maxVotos;
          const esMvp     = weeklyMvpId === j.id;
          const pct       = maxVotos > 0 ? Math.round((j.votos / maxVotos) * 100) : 0;
          const cfg       = getPosicionConfig(j.posicion);

          return (
            <div
              key={j.id}
              onClick={() => !miVoto && votar(j.id)}
              style={{
                position: 'relative', overflow: 'hidden',
                background: esMiVoto ? 'rgba(239,68,68,0.08)' : esMvp ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${esMiVoto ? 'rgba(239,68,68,0.4)' : esMvp ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 10, padding: '9px 12px',
                cursor: miVoto ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {/* Vote bar fill */}
              {miVoto && j.votos > 0 && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pct}%`,
                  background: esMiVoto ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
                  transition: 'width 0.4s ease',
                  pointerEvents: 'none',
                }} />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                <div className="player-avatar" style={{
                  width: 30, height: 30, minWidth: 30, fontSize: 11,
                  borderColor: esMiVoto ? '#ef4444' : cfg.color,
                  color: esMiVoto ? '#ef4444' : cfg.color,
                  background: esMvp ? 'rgba(239,68,68,0.1)' : undefined,
                }}>
                  {getInitials(j.nombre)}
                </div>

                <span style={{
                  flex: 1, fontSize: 13,
                  fontWeight: esMiVoto || esMvp ? 700 : 500,
                  color: esMiVoto ? '#fca5a5' : 'var(--text)',
                }}>
                  {j.nombre}
                  {j.capitan && <span className="capitan-badge" style={{ marginLeft: 4 }}>C</span>}
                </span>

                {miVoto ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {esMvp && <span style={{ fontSize: 12 }}>⚡</span>}
                    <span style={{
                      fontSize: 15, fontWeight: 700, fontFamily: 'Rajdhani',
                      color: esMiVoto ? '#ef4444' : esLider ? '#f97316' : 'var(--text3)',
                      minWidth: 16, textAlign: 'right',
                    }}>
                      {j.votos}
                    </span>
                    {esMiVoto && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: 1,
                        color: '#ef4444', fontFamily: 'Rajdhani',
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 3, padding: '1px 4px',
                      }}>
                        TU VOTO
                      </span>
                    )}
                  </div>
                ) : (
                  miJugadorId && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, fontFamily: 'Rajdhani',
                      color: 'var(--text3)', letterSpacing: 0.5,
                    }}>
                      VOTAR →
                    </span>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!miJugadorId && (
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'Rajdhani', marginTop: 8, textAlign: 'center' }}>
          Regístrate para votar
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
