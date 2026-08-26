/* Shared silhouette sprites for FutCard and MiniPitchCard */

export const POSE_MAP = {
  POR:  [0, 2, 3], // GK brazo arriba alcanzando pelota — sheet 3, cuerpo completo
  LTI:  [1, 0, 3], // dribleo lateral — sheet 3
  LTD:  [1, 1, 2], // jogging with ball
  DFCi: [1, 0, 2], // standing defensive
  DFCd: [1, 1, 1], // lunge / tackle
  MDC:  [1, 2, 1], // low control
  MCI:  [0, 2, 1], // running with ball
  MC:   [0, 1, 1], // active dribble
  MCD:  [1, 3, 1], // wide stance
  MOC:  [1, 3, 2], // volley
  EXI:  [0, 0, 1], // shoot / sprint
  EXD:  [1, 2, 2], // dribbling forward
  SD:   [1, 3, 2], // volley / segundo delantero
  DC:   [0, 0, 1], // sprint hacia arco — mismo frame que EXI
};

export const POSE_Y_ADJUST = { LTD: -8 };

// scale != 1 → zoom in/out; sin entrada = scale 1.0 (celda llena exacta, sin ghosts)
export const POSE_SCALE = {};

export const SPRITE = { 1: '/silhouettes.jpg', 2: '/silhouettes2.jpg', 3: '/silhouettes3.jpg' };

// SVG filter #sil (definido en index.html) convierte el JPEG a silueta blanca con alpha:
// feColorMatrix(luminanceToAlpha) → oscuro=alpha alto, claro=alpha bajo
// feComponentTransfer(invert alpha) → oscuro=visible, claro=transparente
// feFlood(blanco) + feComposite(in) → figura blanca sobre fondo transparente
// Funciona en iOS Safari, Chrome, Firefox — sin mix-blend-mode ni mask-composite.
export function PlayerSilhouette({ posicion }) {
  const [row, col, sheet = 1] = POSE_MAP[posicion] ?? [0, 1, 1];
  const scale = POSE_SCALE[posicion] ?? 1;
  const bsW = (400 * scale).toFixed(2);
  const bsH = (200 * scale).toFixed(2);
  const xPct = ((0.5 - (col + 0.5) * scale) / (1 - 4 * scale) * 100).toFixed(3);
  const yAdjust = POSE_Y_ADJUST[posicion] ?? 0;
  const yPct = ((0.5 - (row + 0.5) * scale) / (1 - 2 * scale) * 100 + yAdjust).toFixed(3);
  const url = SPRITE[sheet];
  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundImage: `url(${url})`,
      backgroundSize: `${bsW}% ${bsH}%`,
      backgroundPosition: `${xPct}% ${yPct}%`,
      backgroundRepeat: 'no-repeat',
      filter: 'url(#sil)',
    }} />
  );
}
