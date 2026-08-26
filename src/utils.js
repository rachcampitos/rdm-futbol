export const POS_OVERALL = {
  portero: 78, defensa: 74, mediocampo: 76, delantero: 79, arbitro: 72,
  POR: 78, ARB: 72,
  LTI: 73, LTD: 73, DFCi: 75, DFCd: 75,
  MDC: 76, MC: 77, MOC: 78, MCI: 74, MCD: 74,
  DC: 80, EXI: 78, EXD: 78, SD: 77,
};

// Stats por defecto al registrarse (mismos valores que STICKER_STATS en
// Onboarding.jsx, con las claves en el formato pac/tir/pas/reg/def/fis).
// Sirve de referencia en getRating() para saber cuánto subió o bajó el
// overall de un jugador respecto a sus stats iniciales.
const POSICION_STATS_BASE = {
  POR:  { pac: 55, tir: 30, pas: 52, reg: 48, def: 82, fis: 75 },
  DFCi: { pac: 68, tir: 40, pas: 60, reg: 54, def: 82, fis: 80 },
  DFCd: { pac: 68, tir: 40, pas: 60, reg: 54, def: 82, fis: 80 },
  LTI:  { pac: 82, tir: 55, pas: 70, reg: 70, def: 72, fis: 74 },
  LTD:  { pac: 82, tir: 55, pas: 70, reg: 70, def: 72, fis: 74 },
  MDC:  { pac: 70, tir: 52, pas: 76, reg: 64, def: 78, fis: 80 },
  MC:   { pac: 74, tir: 65, pas: 82, reg: 74, def: 62, fis: 72 },
  MOC:  { pac: 76, tir: 74, pas: 82, reg: 80, def: 44, fis: 64 },
  MCI:  { pac: 80, tir: 68, pas: 78, reg: 78, def: 52, fis: 66 },
  MCD:  { pac: 80, tir: 68, pas: 78, reg: 78, def: 52, fis: 66 },
  DC:   { pac: 80, tir: 86, pas: 66, reg: 78, def: 32, fis: 76 },
  EXI:  { pac: 90, tir: 78, pas: 70, reg: 86, def: 30, fis: 66 },
  EXD:  { pac: 90, tir: 78, pas: 70, reg: 86, def: 30, fis: 66 },
  SD:   { pac: 78, tir: 80, pas: 74, reg: 76, def: 40, fis: 68 },
};

// Peso de cada atributo (pac,tir,pas,reg,def,fis) según qué tan determinante
// es para esa posición — se usa para derivar stats "de relleno" a partir del
// overall (calcStats), cuando un jugador aún no tiene alguna stat guardada.
const POSICION_STAT_WEIGHTS = {
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
  ARB:  [0.72, 0.45, 0.82, 0.80, 0.88, 0.92],
};
const STAT_KEYS_ORDER = ['pac', 'tir', 'pas', 'reg', 'def', 'fis'];

export function getRating(jugador) {
  // Si el jugador ya tiene sus 6 stats (autogeneradas al registrarse o
  // ajustadas a mano en "Editar perfil") y hay una base conocida para su
  // posición, el overall parte de la base fija de esa posición y se mueve
  // según cuánto subió o bajó el promedio de sus stats respecto al default.
  // Así el sorteo balancea con el nivel real que cada uno se puso — sin que
  // el overall cambie de golpe por reordenar puntos dentro del mismo total.
  const pos  = jugador.posicion;
  const base = POSICION_STATS_BASE[pos];
  if (base && STAT_KEYS_ORDER.every(k => typeof jugador[k] === 'number')) {
    const baseOverall = POS_OVERALL[pos] ?? 75;
    const avgDelta = STAT_KEYS_ORDER.reduce((s, k) => s + (jugador[k] - base[k]), 0) / STAT_KEYS_ORDER.length;
    return Math.max(40, Math.min(99, Math.round(baseOverall + avgDelta)));
  }
  if (jugador.overall) return jugador.overall;
  if (pos && POS_OVERALL[pos] !== undefined) return POS_OVERALL[pos];
  const base2 = { portero: 78, defensa: 74, mediocampo: 76, delantero: 79, arbitro: 72 };
  const cat = jugador.categoria ?? 'mediocampo';
  return base2[cat] ?? 70;
}

export function getCardTier(overall) {
  if (overall >= 85) return 'elite';
  if (overall >= 75) return 'gold';
  if (overall >= 65) return 'silver';
  return 'bronze';
}

function hashInt(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(33, h) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

export function calcStats(jugador) {
  const overall = getRating(jugador);
  const seed = hashInt(jugador.id ?? jugador.nombre ?? '?');
  const w = POSICION_STAT_WEIGHTS[jugador.posicion] ?? [0.88, 0.88, 0.88, 0.88, 0.75, 0.85];
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

export function getPrevWeekId() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
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
  arbitro:     { label: 'ARB', color: '#7c3aed', bg: 'rgba(124,58,237,0.15)' },
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
  // Árbitro
  ARB:  { label: 'ARB',  nombre: 'Árbitro',              categoria: 'arbitro',    color: '#7c3aed', bg: 'rgba(124,58,237,0.15)' },
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
  {
    grupo: 'Árbitro',
    posiciones: ['ARB'],
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

export function distribuirEquipos(jugadores, jugandoCadaEquipo = null) {
  // Árbitros no participan en el sorteo — se separan primero
  const arbitros    = jugadores.filter(j => getCategoriaBase(j.posicion) === 'arbitro');
  const jugadoresEf = jugadores.filter(j => getCategoriaBase(j.posicion) !== 'arbitro');

  const n = jugandoCadaEquipo ?? Math.floor(jugadoresEf.length / 2);
  const nJugando = Math.min(n * 2, jugadoresEf.length);

  // Quién juega vs suplente sigue siendo aleatorio (rotación, no depende del nivel)
  const shuffledAll = shuffle([...jugadoresEf]);
  const jugando   = shuffledAll.slice(0, nJugando);
  const suplentes = shuffledAll.slice(nJugando);

  // Cada grupo posicional ordenado por rating (overall) descendente — insumo del draft
  const grupos = {
    portero:    jugando.filter(j => getCategoriaBase(j.posicion) === 'portero').sort((a, b) => getRating(b) - getRating(a)),
    defensa:    jugando.filter(j => getCategoriaBase(j.posicion) === 'defensa').sort((a, b) => getRating(b) - getRating(a)),
    mediocampo: jugando.filter(j => getCategoriaBase(j.posicion) === 'mediocampo').sort((a, b) => getRating(b) - getRating(a)),
    delantero:  jugando.filter(j => getCategoriaBase(j.posicion) === 'delantero').sort((a, b) => getRating(b) - getRating(a)),
  };

  const equipoA = [];
  const equipoB = [];
  let sumA = 0, sumB = 0;

  // Draft parejo por rating: dentro de cada grupo posicional se arman pares
  // (mejor disponible + siguiente); el par se reparte entre ambos equipos y el
  // mejor del par va siempre al equipo que hasta ese momento suma menos overall.
  // Así se mantiene la misma cantidad de jugadores por posición en ambos lados
  // (como antes) pero además el nivel total queda parejo.
  for (const pos of ['portero', 'defensa', 'mediocampo', 'delantero']) {
    const lista = grupos[pos];
    for (let i = 0; i < lista.length; i += 2) {
      const mejor   = lista[i];
      const segundo = lista[i + 1] ?? null;
      if (sumA <= sumB) {
        equipoA.push(mejor); sumA += getRating(mejor);
        if (segundo) { equipoB.push(segundo); sumB += getRating(segundo); }
      } else {
        equipoB.push(mejor); sumB += getRating(mejor);
        if (segundo) { equipoA.push(segundo); sumA += getRating(segundo); }
      }
    }
  }

  while (equipoA.length - equipoB.length > 1) {
    const j = equipoA.pop(); sumA -= getRating(j);
    equipoB.push(j); sumB += getRating(j);
  }
  while (equipoB.length - equipoA.length > 1) {
    const j = equipoB.pop(); sumB -= getRating(j);
    equipoA.push(j); sumA += getRating(j);
  }

  // Captains must be on opposite teams — if both ended up on the same team,
  // swap the second captain with the closest-rated non-captain on the other
  // team, para mover lo menos posible el balance de nivel ya logrado.
  const capitanes = jugando.filter(j => j.capitan);
  if (capitanes.length >= 2) {
    const capEnA = capitanes.filter(j => equipoA.some(a => a.id === j.id));
    const capEnB = capitanes.filter(j => equipoB.some(b => b.id === j.id));
    if (capEnA.length > 1) {
      const toMove = capEnA[1];
      const idxA   = equipoA.findIndex(j => j.id === toMove.id);
      const swapTarget = [...equipoB.filter(j => !j.capitan)]
        .sort((a, b) => Math.abs(getRating(a) - getRating(toMove)) - Math.abs(getRating(b) - getRating(toMove)))[0];
      if (swapTarget) {
        const swapIdx = equipoB.findIndex(j => j.id === swapTarget.id);
        equipoA[idxA]   = swapTarget;
        equipoB[swapIdx] = toMove;
      }
    } else if (capEnB.length > 1) {
      const toMove = capEnB[1];
      const idxB   = equipoB.findIndex(j => j.id === toMove.id);
      const swapTarget = [...equipoA.filter(j => !j.capitan)]
        .sort((a, b) => Math.abs(getRating(a) - getRating(toMove)) - Math.abs(getRating(b) - getRating(toMove)))[0];
      if (swapTarget) {
        const swapIdx = equipoA.findIndex(j => j.id === swapTarget.id);
        equipoB[idxB]   = swapTarget;
        equipoA[swapIdx] = toMove;
      }
    }
  }

  return { equipoA, equipoB, suplentes, arbitros };
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
   All values within [14%, 86%] useful width.
   These assume "team A attacking down" orientation.
   For team B (attacking up) we mirror X. */
const POSICION_X = {
  // Portero
  POR:  [50],
  // Defensas — LT at 16/84, DFC at 36/64
  LTI:  [16],
  DFCi: [36],
  DFCd: [64],
  LTD:  [84],
  // Mediocampo
  MDC:  [50],
  MCI:  [26],
  MC:   [50],
  MCD:  [74],
  MOC:  [50],
  // Delanteros — EX at 18/82, SD/DC centered
  EXI:  [18],
  SD:   [38],
  DC:   [50],
  EXD:  [82],
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

  // Nudge offset per line when duplicates share the same base X
  const DUPLICATE_NUDGE = {
    portero:    4,
    defensa:    6,
    mediocampo: 5,
    delantero:  6,
  };

  const placeGroup = (grupo, topPct, categoria) => {
    const n = grupo.length;
    if (n === 0) return;

    // Count how many times each posicion appears in this group
    const posCount = {};
    const posIndex = {};
    grupo.forEach((j) => {
      const key = j.posicion ?? '__unknown__';
      posCount[key] = (posCount[key] ?? 0) + 1;
      posIndex[key] = 0;
    });

    const nudge = DUPLICATE_NUDGE[categoria] ?? 5;
    const fallbackNeeded = [];

    // Pre-compute per-position spread arrays for duplicate positions
    const posSpreads = {};
    for (const key of Object.keys(posCount)) {
      const xArr = POSICION_X[key];
      if (xArr && xArr.length > 0 && posCount[key] > 1) {
        // Use the symmetric spreadX formula centred on the declared base X
        const baseX = xArr[0];
        const dupes = posCount[key];
        const half  = 72 / (dupes + 1); // same spacing formula
        // Generate dupes values symmetric around baseX
        const rawSpread = Array.from(
          { length: dupes },
          (_, i) => baseX - (dupes - 1) * half / 2 + i * half
        );
        posSpreads[key] = rawSpread;
      }
    }

    grupo.forEach((j) => {
      const key = j.posicion ?? '__unknown__';
      const xArr = POSICION_X[j.posicion];

      if (xArr && xArr.length > 0) {
        const dupes = posCount[key];
        const idx   = posIndex[key]++;

        const rawX = dupes === 1
          ? xArr[0]
          : posSpreads[key][idx];

        const mirroredX = esEquipoA ? rawX : 100 - rawX;
        // Clamp to safe bounds [14, 86]
        const x = Math.min(86, Math.max(14, mirroredX));
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

  placeGroup(por, topGK,  'portero');
  placeGroup(def, topDef, 'defensa');
  placeGroup(med, topMed, 'mediocampo');
  placeGroup(del, topDel, 'delantero');

  return resultado;
}

function spreadX(n) {
  // Symmetric distribution across useful pitch width [14%, 86%]
  // range = 86 - 14 = 72, spacing = 72 / (n + 1)
  // x_i = 14 + spacing * (i + 1)  for i = 0..n-1
  const count = Math.max(1, n);
  const spacing = 72 / (count + 1);
  return Array.from({ length: count }, (_, i) => Math.round(14 + spacing * (i + 1)));
}

/* ═══════════════════════════════════════════════════════════════
   FORMACIONES — Sistema estilo Winning Eleven / PES
   ═══════════════════════════════════════════════════════════════

   Cada formación es un array de líneas ordenadas de atrás hacia
   adelante (portero primero). Cada línea tiene:
     - n:   número de jugadores en esa línea
     - cat: categoría base ('portero' | 'defensa' | 'mediocampo' | 'delantero')
     - y_a: posición Y (%) del equipo A (ataca hacia abajo, POR arriba)
     - y_b: posición Y (%) del equipo B (ataca hacia arriba, POR abajo)

   Las Y están calibradas al viewBox de la cancha (0-100).
═══════════════════════════════════════════════════════════════ */

export const FORMACIONES = {
  // ── 10 jugadores ──────────────────────────────────────
  // 4 líneas: POR=6/94, DEF=20/80, MED=34/66, DEL=45/55
  '4-4-2': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 4, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 4, cat: 'mediocampo', y_a: 34, y_b: 66 },
    { n: 2, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],
  '4-3-3': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 4, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 3, cat: 'mediocampo', y_a: 34, y_b: 66 },
    { n: 3, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],
  // 5 líneas: POR=6/94, DEF=18/82, MDC=28/72, MOC=38/62, DEL=46/54
  '4-2-3-1': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 4, cat: 'defensa',    y_a: 18, y_b: 82 },
    { n: 2, cat: 'mediocampo', y_a: 28, y_b: 72 },
    { n: 3, cat: 'mediocampo', y_a: 38, y_b: 62 },
    { n: 1, cat: 'delantero',  y_a: 46, y_b: 54 },
  ],
  // 4 líneas: POR=6/94, DEF=20/80, MED=34/66, DEL=45/55
  '3-5-2': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 3, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 5, cat: 'mediocampo', y_a: 34, y_b: 66 },
    { n: 2, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],
  '3-4-3': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 3, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 4, cat: 'mediocampo', y_a: 34, y_b: 66 },
    { n: 3, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],
  '5-3-2': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 5, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 3, cat: 'mediocampo', y_a: 34, y_b: 66 },
    { n: 2, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],
  '5-4-1': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 5, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 4, cat: 'mediocampo', y_a: 34, y_b: 66 },
    { n: 1, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],

  // ── 8-9 jugadores ─────────────────────────────────────
  // 4 líneas: POR=6/94, DEF=20/80, MED=34/66, DEL=45/55
  '3-3-2': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 3, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 3, cat: 'mediocampo', y_a: 34, y_b: 66 },
    { n: 2, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],
  '3-2-2': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 3, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 2, cat: 'mediocampo', y_a: 34, y_b: 66 },
    { n: 2, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],

  // ── Sin portero (fútbol 7 / 6) ───────────────────────
  // 2 líneas sin portero: DEF en su tercio, DEL en su mitad máx 45/55
  '4-3': [
    { n: 1, cat: 'portero',    y_a:  6, y_b: 94 },
    { n: 4, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 3, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],
  '3-3': [
    { n: 3, cat: 'defensa',    y_a: 20, y_b: 80 },
    { n: 3, cat: 'delantero',  y_a: 45, y_b: 55 },
  ],
};

/* Formación por defecto según número de jugadores */
export function getFormacionDefault(nJugadores) {
  if (nJugadores >= 10) return '4-4-2';
  if (nJugadores >= 8)  return '3-3-2';
  if (nJugadores >= 6)  return '3-2-2';
  return '3-3';
}

/* Formatos válidos para un grupo de confirmados (jugadores por equipo, desc) */
export function getFormatosValidos(nConfirmados) {
  if (nConfirmados < 4) return [];
  const max = Math.floor(nConfirmados / 2);
  const min = Math.max(3, max - 3);
  const result = [];
  for (let n = max; n >= min; n--) result.push(n);
  return result;
}

/* ─────────────────────────────────────────────────────────────
   aplicarFormacion — Asigna jugadores a líneas de la formación
   y devuelve array de { jugador, x, y }.

   Estrategia de asignación (respeta posición declarada):
   1. Porteros → líneas 'portero'
   2. Defensas → líneas 'defensa'
   3. Mediocampistas → líneas 'mediocampo'
   4. Delanteros → líneas 'delantero'
   5. Excedentes de cualquier categoría → línea más cercana con
      espacio libre (adyacente hacia adelante o atrás)
   ───────────────────────────────────────────────────────────── */
export function aplicarFormacion(jugadores, formacionKey, esEquipoA) {
  const formacion = FORMACIONES[formacionKey];
  if (!formacion || jugadores.length === 0) return [];

  /* Separar jugadores por categoría */
  const porCat = {
    portero:    [...jugadores.filter(j => getCategoriaBase(j.posicion) === 'portero')],
    defensa:    [...jugadores.filter(j => getCategoriaBase(j.posicion) === 'defensa')],
    mediocampo: [...jugadores.filter(j => getCategoriaBase(j.posicion) === 'mediocampo')],
    delantero:  [...jugadores.filter(j => getCategoriaBase(j.posicion) === 'delantero')],
  };

  /* Construir slots: cuántos jugadores caben por línea */
  const slots = formacion.map(linea => ({ ...linea, asignados: [] }));
  const totalSlots = slots.reduce((s, l) => s + l.n, 0);

  /* Función helper: toma hasta `n` del grupo, o lo que haya */
  const tomar = (cat, n) => {
    const grupo = porCat[cat];
    return grupo.splice(0, Math.min(n, grupo.length));
  };

  /* Primera pasada: llenar cada línea con jugadores de su categoría */
  slots.forEach(slot => {
    const tomados = tomar(slot.cat, slot.n);
    slot.asignados.push(...tomados);
  });

  /* Pool de jugadores sin asignar (excedentes + sin categoría) */
  const sinAsignar = [
    ...porCat.portero,
    ...porCat.defensa,
    ...porCat.mediocampo,
    ...porCat.delantero,
  ];

  /* Segunda pasada: distribuir excedentes en slots con espacio libre */
  for (let i = 0; i < slots.length && sinAsignar.length > 0; i++) {
    const slot = slots[i];
    const espacio = slot.n - slot.asignados.length;
    if (espacio > 0) {
      slot.asignados.push(...sinAsignar.splice(0, espacio));
    }
  }

  /* Si aun quedan (más jugadores que slots), los apilamos al frente */
  let extraIdx = 0;
  while (sinAsignar.length > 0) {
    slots[extraIdx % slots.length].asignados.push(sinAsignar.shift());
    extraIdx++;
  }

  /* Construir posiciones finales con X distribuido y Y de la formación */
  const resultado = [];
  slots.forEach(slot => {
    const n = slot.asignados.length;
    if (n === 0) return;
    const xs = spreadX(n);
    const y = esEquipoA ? slot.y_a : slot.y_b;
    slot.asignados.forEach((j, i) => {
      const rawX = xs[i];
      const x = esEquipoA ? rawX : 100 - rawX;
      resultado.push({ ...j, x: Math.min(86, Math.max(14, x)), y });
    });
  });

  return resultado;
}
