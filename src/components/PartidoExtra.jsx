import { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getInitials } from '../utils';

const CLOUDINARY_CLOUD  = 'dml5vqnmu';
const CLOUDINARY_PRESET = 'rdm-futbol-pagos';

async function uploadToCloudinary(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: form });
  const data = await res.json();
  return data.secure_url;
}

export default function PartidoExtra({ partidoExtra, jugadorActual, isAdmin }) {
  const [showCreate,    setShowCreate]    = useState(false);
  const [nombre,        setNombre]        = useState('');
  const [creando,       setCreando]       = useState(false);
  const [uniendose,     setUniendose]     = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [error,         setError]         = useState('');

  const miConfirmacion = partidoExtra?.convocados?.find(c => c.jugadorId === jugadorActual?.id);
  const yaConfirmado   = !!miConfirmacion;
  const totalConfirmados = partidoExtra?.convocados?.length ?? 0;

  async function crearPartido() {
    setError('');
    if (!nombre.trim()) { setError('Escribe un nombre para el partido'); return; }
    if (!jugadorActual?.id) { setError('Necesitas estar registrado para crear un partido extra'); return; }
    setCreando(true);
    try {
      await addDoc(collection(db, 'partidos-extra'), {
        nombre:          nombre.trim(),
        creadoPor:       jugadorActual.id,
        creadoPorNombre: jugadorActual.nombre,
        activo:          true,
        createdAt:       serverTimestamp(),
        convocados: [{
          jugadorId:   jugadorActual.id,
          nombre:      jugadorActual.nombre,
          fotoUrl:     null,
          confirmedAt: new Date().toISOString(),
        }],
      });
      setShowCreate(false);
      setNombre('');
    } catch (e) {
      console.error('Error creando partido extra:', e);
      setError('Error al crear: ' + e.message);
    } finally {
      setCreando(false);
    }
  }

  async function unirse() {
    if (!jugadorActual?.id || !partidoExtra?.id) return;
    setUniendose(true);
    try {
      const convocados = [...(partidoExtra.convocados ?? [])];
      convocados.push({
        jugadorId:   jugadorActual.id,
        nombre:      jugadorActual.nombre,
        fotoUrl:     null,
        confirmedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'partidos-extra', partidoExtra.id), { convocados });
    } finally {
      setUniendose(false);
    }
  }

  async function subirFoto(file) {
    if (!file || !jugadorActual?.id || !partidoExtra?.id) return;
    setUploadingFoto(true);
    try {
      const url = await uploadToCloudinary(file);
      const convocados = (partidoExtra.convocados ?? []).map(c =>
        c.jugadorId === jugadorActual.id ? { ...c, fotoUrl: url } : c
      );
      await updateDoc(doc(db, 'partidos-extra', partidoExtra.id), { convocados });
    } finally {
      setUploadingFoto(false);
    }
  }

  async function cerrarPartido() {
    if (!partidoExtra?.id) return;
    await updateDoc(doc(db, 'partidos-extra', partidoExtra.id), { activo: false });
  }

  async function cancelarPartido() {
    if (!partidoExtra?.id) return;
    await deleteDoc(doc(db, 'partidos-extra', partidoExtra.id));
  }

  // ── ESTADO: partido activo + ya confirmado ──────────────────────────────────
  if (partidoExtra && yaConfirmado) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04))',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: 14, padding: '14px 14px', marginBottom: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
                Partido extra
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                {partidoExtra.nombre}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#34d399', fontFamily: 'Rajdhani', fontWeight: 700 }}>
            ✓ Confirmado
          </div>
        </div>

        {/* Foto de pago */}
        {!miConfirmacion?.fotoUrl ? (
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px', borderRadius: 10, cursor: 'pointer',
            border: '1.5px dashed rgba(16,185,129,0.4)',
            background: 'rgba(16,185,129,0.05)',
            fontSize: 11, fontWeight: 700, color: '#34d399',
            fontFamily: 'Rajdhani, sans-serif', letterSpacing: 1, textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && subirFoto(e.target.files[0])} />
            {uploadingFoto ? '⏳ Subiendo...' : '📸 Subir Yape / Plin'}
          </label>
        ) : (
          <div style={{ marginBottom: 12, position: 'relative' }}>
            <img src={miConfirmacion.fotoUrl} alt="pago"
              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)' }} />
            <div style={{
              position: 'absolute', bottom: 6, right: 6,
              background: 'rgba(16,185,129,0.85)', borderRadius: 20,
              padding: '2px 8px', fontSize: 10, fontWeight: 700,
              color: '#fff', fontFamily: 'Rajdhani',
            }}>✓ Pago registrado</div>
          </div>
        )}

        {/* Quiénes van */}
        <div style={{ marginBottom: (isAdmin || partidoExtra.creadoPor === jugadorActual?.id) ? 10 : 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text3)', textTransform: 'uppercase', fontFamily: 'Rajdhani', marginBottom: 6 }}>
            Van ({totalConfirmados})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(partidoExtra.convocados ?? []).map(c => (
              <div key={c.jugadorId} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: c.fotoUrl ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${c.fotoUrl ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 20, padding: '4px 10px 4px 4px',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700, color: '#34d399', fontFamily: 'Rajdhani',
                }}>
                  {getInitials(c.nombre)}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
                  {c.nombre.split(' ')[0]}
                </span>
                {c.fotoUrl && <span style={{ fontSize: 9 }}>💸</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Acciones — creator o admin */}
        {(isAdmin || partidoExtra.creadoPor === jugadorActual?.id) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              onClick={cerrarPartido}
              style={{
                flex: 1, background: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '7px 10px', fontSize: 10,
                color: 'var(--text3)', cursor: 'pointer', fontFamily: 'Rajdhani',
                fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              }}
            >
              ✓ Cerrar partido
            </button>
            <button
              onClick={cancelarPartido}
              style={{
                flex: 1, background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '7px 10px', fontSize: 10,
                color: '#f87171', cursor: 'pointer', fontFamily: 'Rajdhani',
                fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              }}
            >
              ✕ Cancelar partido
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── ESTADO: partido activo + no confirmado ─────────────────────────────────
  if (partidoExtra && !yaConfirmado) {
    return (
      <button
        onClick={unirse}
        disabled={uniendose}
        style={{
          width: '100%', marginBottom: 16, padding: '14px 16px',
          borderRadius: 14, cursor: 'pointer', border: 'none',
          background: 'linear-gradient(135deg, #065f46, #047857)',
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'pulse-extra 2s ease-in-out infinite',
          boxShadow: '0 0 20px rgba(16,185,129,0.35), 0 4px 16px rgba(0,0,0,0.4)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* shimmer */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
          animation: 'shimmer-extra 2.5s linear infinite',
        }} />
        <span style={{ fontSize: 24, flexShrink: 0 }}>⚡</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Rajdhani' }}>
            Partido extra · {totalConfirmados} {totalConfirmados === 1 ? 'va' : 'van'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>
            {uniendose ? 'Confirmando...' : `Únete — ${partidoExtra.nombre}`}
          </div>
        </div>
        <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>→</span>
      </button>
    );
  }

  // ── ESTADO: sin partido activo ─────────────────────────────────────────────
  if (showCreate) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(16,185,129,0.25)',
        borderRadius: 14, padding: '14px 14px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#34d399', textTransform: 'uppercase', fontFamily: 'Rajdhani', marginBottom: 10 }}>
          ⚡ Nuevo partido extra
        </div>
        <input
          className="form-input"
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(''); }}
          placeholder="Ej: Partido con equipo de Wilfredo"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && crearPartido()}
          style={{ marginBottom: error ? 6 : 10 }}
        />
        {error && (
          <div style={{ fontSize: 11, color: '#f87171', fontFamily: 'Rajdhani', marginBottom: 8 }}>
            ⚠ {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-full" onClick={() => { setShowCreate(false); setNombre(''); }}>
            Cancelar
          </button>
          <button
            className="btn btn-full"
            onClick={crearPartido}
            disabled={!nombre.trim() || creando}
            style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', color: '#34d399' }}
          >
            {creando ? 'Creando...' : '⚡ Crear y confirmarme'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowCreate(true)}
      style={{
        width: '100%', marginBottom: 16, padding: '10px 14px',
        borderRadius: 12, cursor: 'pointer',
        border: '1px dashed rgba(16,185,129,0.25)',
        background: 'rgba(16,185,129,0.04)',
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 16 }}>⚡</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(16,185,129,0.7)', fontFamily: 'Rajdhani', letterSpacing: 1.5, textTransform: 'uppercase' }}>
        ¿Hay pichanga extra?
      </span>
    </button>
  );
}
