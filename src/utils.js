export function getWeekId() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getShortName(nombre) {
  const parts = nombre.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 8);
  return parts[0] + ' ' + parts[1][0] + '.';
}

export function getInitials(nombre) {
  return nombre
    .trim()
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase();
}

/* ── Base category config (used by FUT card tier, team badge color, etc.) ── */
export const POSICION_CONFIG = {
  portero:     { label: 'POR', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  defensa:     { label: 'DEF', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  mediocampo:  { label: 'MED', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  delantero:   { label: 'DEL', color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
};

/* ── Detailed FIFA-style positions ── */
export const POSICION_DETALLADA = {
  // Portero
  POR:  { label: 'POR',  nombre: 'Portero',              categoria: 'portero',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  // Defensas
  DFCi: { label: 'DFCi', nombre: 'Defensa Central Izq',  categoria: 'defensa',    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  DFCd: { label: 'DFCd', nombre: 'Defensa Central Der',  categoria: 'defensa',    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  LTI:  { label: 'LTI',  nombre: 'Lateral Izquierdo',    categoria: 'defensa',    color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  LTD:  { label: 'LTD',  nombre: 'Lateral Derecho',      categoria: 'defensa',    color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  // Mediocampo
  MDC:  { label: 'MDC',  nombre: 'Mediocampo Defensivo', categoria: 'mediocampo', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  MC:   { label: 'MC',   nombre: 'Mediocampo Central',   categoria: 'mediocampo', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  MOC:  { label: 'MOC',  nombre: 'Mediocampo Ofensivo',  categoria: 'mediocampo', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  MCI:  { label: 'MCI',  nombre: 'Mediocampo Izquierdo', categoria: 'mediocampo', color: '#6ee7b7', bg: 'rgba(110,231,183,0.15)' },
  MCD:  { label: 'MCD',  nombre: 'Mediocampo Derecho',   categoria: 'mediocampo', color: '#6ee7b7', bg: 'rgba(110,231,183,0.15)' },
  // Delanteros
  DC:   { label: 'DC',   nombre: 'Delantero Centro',     categoria: 'delantero',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  EXI:  { label: 'EXI',  nombre: 'Extremo Izquierdo',    categoria: 'delantero',  color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  EXD:  { label: 'EXD',  nombre: 'Extremo Derecho',      categoria: 'delantero',  color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  SD:   { label: 'SD',   nombre: 'Segunda Delantera',    categoria: 'delantero',  color: '#fca5a5', bg: 'rgba(252,165,165,0.15)' },
};

/* Groups for the onboarding / Jugadores position picker UI */
export const POSICION_GRUPOS = [
  {
    grupo: 'Portero',
    posiciones: ['POR'],
  },
  {
    grupo: 'Defensa',
    posiciones: ['LTI', 'DFCi', 'DFCd', 'LTD'],
  },
  {
    grupo: 'Mediocampo',
    posiciones: ['MDC', 'MCI', 'MC', 'MCD', 'MOC'],
  },
  {
    grupo: 'Delantero',
    posiciones: ['EXI', 'SD', 'DC', 'EXD'],
  },
];

/* Map a posicion value (old 4-cat OR new detailed) → categoria base */
export function getCategoriaBase(posicion) {
  if (!posicion) return 'defensa';
  // Already a base category
  if (POSICION_CONFIG[posicion]) return posicion;
  // Detailed position
  return POSICION_DETALLADA[posicion]?.categoria ?? 'defensa';
}

/* Friendly display label for any posicion value */
export function getPosicionLabel(posicion) {
  if (!posicion) return 'DEF';
  if (POSICION_DETALLADA[posicion]) return POSICION_DETALLADA[posicion].label;
  return POSICION_CONFIG[posicion]?.label ?? posicion.toUpperCase();
}

/* Color/bg for any posicion value */
export function getPosicionConfig(posicion) {
  if (!posicion) return POSICION_CONFIG.defensa;
  if (POSICION_DETALLADA[posicion]) {
    const d = POSICION_DETALLADA[posicion];
    return { label: d.label, color: d.color, bg: d.bg };
  }
  return POSICION_CONFIG[posicion] ?? POSICION_CONFIG.defensa;
}

export function formatFecha(isoDate) {
  if (!isoDate) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${dd} ${months[parseInt(mm, 10) - 1]} ${yyyy}`;
}

export function distribuirEquipos(jugadores) {
  const grupos = {
    portero:    shuffle(jugadores.filter(j => getCategoriaBase(j.posicion) === 'portero')),
    defensa:    shuffle(jugadores.filter(j => getCategoriaBase(j.posicion) === 'defensa')),
    mediocampo: shuffle(jugadores.filter(j => getCategoriaBase(j.posicion) === 'mediocampo')),
    delantero:  shuffle(jugadores.filter(j => getCategoriaBase(j.posicion) === 'delantero')),
  };

  const equipoA = [];
  const equipoB = [];

  for (const pos of ['portero', 'defensa', 'mediocampo', 'delantero']) {
    grupos[pos].forEach((j, i) => {
      if (i % 2 === 0) equipoA.push(j);
      else equipoB.push(j);
    });
  }

  return { equipoA, equipoB };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Specific X positions per FIFA detailed position ──
   X is percentage across the pitch width (0=left, 100=right).
   These assume "team A attacking down" orientation.
   For team B (attacking up) we mirror X. */
const POSICION_X = {
  // Portero
  POR:  [50],
  // Defensas
  LTI:  [10],
  DFCi: [35],
  DFCd: [65],
  LTD:  [90],
  // Mediocampo
  MDC:  [50],
  MCI:  [22],
  MC:   [50],
  MCD:  [78],
  MOC:  [50],
  // Delanteros
  EXI:  [12],
  SD:   [38],
  DC:   [50],
  EXD:  [88],
};

export function calcularPosicionesCancha(jugadores, esEquipoA) {
  const por = jugadores.filter(j => getCategoriaBase(j.posicion) === 'portero');
  const def = jugadores.filter(j => getCategoriaBase(j.posicion) === 'defensa');
  const med = jugadores.filter(j => getCategoriaBase(j.posicion) === 'mediocampo');
  const del = jugadores.filter(j => getCategoriaBase(j.posicion) === 'delantero');

  const resultado = [];
  const [topGK, topDef, topMed, topDel] = esEquipoA
    ? [7, 22, 35, 46]
    : [93, 78, 65, 54];

  const placeGroup = (grupo, topPct) => {
    const n = grupo.length;
    if (n === 0) return;

    // Try to use specific X positions per detailed posicion
    // Fall back to generic spreadX if position unknown or multiple same pos
    const usedX = [];
    const fallbackNeeded = [];

    grupo.forEach((j) => {
      const xArr = POSICION_X[j.posicion];
      if (xArr && xArr.length > 0) {
        // use the specific x; mirror for team B
        const rawX = xArr[0];
        const x = esEquipoA ? rawX : 100 - rawX;
        usedX.push(x);
        resultado.push({ ...j, x, y: topPct });
      } else {
        fallbackNeeded.push(j);
      }
    });

    // For players without a specific X, spread them in remaining space
    if (fallbackNeeded.length > 0) {
      const xs = spreadX(fallbackNeeded.length);
      fallbackNeeded.forEach((j, i) => resultado.push({ ...j, x: xs[i], y: topPct }));
    }
  };

  placeGroup(por, topGK);
  placeGroup(def, topDef);
  placeGroup(med, topMed);
  placeGroup(del, topDel);

  return resultado;
}

function spreadX(n) {
  const map = {
    1: [50],
    2: [28, 72],
    3: [18, 50, 82],
    4: [12, 37, 63, 88],
    5: [10, 28, 50, 72, 90],
    6: [8,  24, 40, 60, 76, 92],
  };
  return map[Math.min(n, 6)] ?? map[6];
}
