import { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { getWeekId } from './utils';
import EstasSemana from './pages/EstasSemana';
import Jugadores from './pages/Jugadores';
import Sorteo from './pages/Sorteo';
import Penaltis from './pages/Penaltis';
import Onboarding from './components/Onboarding';

const TABS = [
  { id: 'semana',   icon: '⚽', label: 'Semana'  },
  { id: 'roster',   icon: '👥', label: 'Roster'  },
  { id: 'sorteo',   icon: '🎲', label: 'Sorteo'  },
  { id: 'penaltis', icon: '🟨', label: 'Penaltis'},
];

function leerJugadorLocal() {
  const id     = localStorage.getItem('rdm_jugador_id');
  const nombre = localStorage.getItem('rdm_jugador_nombre');
  if (id && nombre) return { id, nombre };
  return null;
}

export default function App() {
  const [jugadorLocal, setJugadorLocal] = useState(() => leerJugadorLocal());
  const [tab, setTab]                   = useState('semana');
  const [jugadores, setJugadores]       = useState([]);
  const [partido, setPartido]           = useState(null);
  const [penaltis, setPenaltis]         = useState([]);
  const [appVisible, setAppVisible]     = useState(false);

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

  // Show onboarding if no jugador registered
  if (!jugadorLocal) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className={`app ${appVisible ? 'app-visible' : 'app-hidden'}`}>
      <header className="header">
        <div className="header-badge">
          <span className="header-badge-dot" />
          <span className="header-badge-text">Temporada 2025</span>
        </div>
        <div className="header-title">RDM Fútbol</div>
        <div className="header-subtitle">Liga de Papás</div>
        <div className="header-line">
          <div className="header-line-bar" />
          <div className="header-line-diamond" />
          <div className="header-line-bar" />
        </div>
      </header>

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

      {tab === 'semana'   && <EstasSemana jugadores={jugadores} partido={partido} jugadorActual={jugadorActual} />}
      {tab === 'roster'   && <Jugadores jugadores={jugadores} />}
      {tab === 'sorteo'   && <Sorteo jugadores={jugadores} partido={partido} jugadorActual={jugadorActual} />}
      {tab === 'penaltis' && <Penaltis jugadores={jugadores} penaltis={penaltis} />}
    </div>
  );
}
