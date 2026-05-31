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
  SD:   [0, 3, 2], // standing with ball (upright)
  DC:   [0, 1, 3], // kicking — sheet 3
};

export const POSE_Y_ADJUST = { LTD: -8 };

// scale < 1 → zoom out para eliminar sangrado JPEG en bordes de celda
export const POSE_SCALE = { DC: 0.88 };

// Máscara para recortar bordes específicos donde sangra una celda vecina
export const POSE_MASK = {
  DC: 'linear-gradient(to right, black 80%, transparent 90%)',
};

export const SPRITE = { 1: '/silhouettes.jpg', 2: '/silhouettes2.jpg', 3: '/silhouettes3.jpg' };

export function PlayerSilhouette({ posicion }) {
  const [row, col, sheet = 1] = POSE_MAP[posicion] ?? [0, 1, 1];
  const scale = POSE_SCALE[posicion] ?? 1;
  const bsW = (400 * scale).toFixed(2);
  const bsH = (200 * scale).toFixed(2);
  // Centra la celda en el contenedor para cualquier escala.
  const xPct = ((0.5 - (col + 0.5) * scale) / (1 - 4 * scale) * 100).toFixed(3);
  const yAdjust = POSE_Y_ADJUST[posicion] ?? 0;
  const yPct = ((0.5 - (row + 0.5) * scale) / (1 - 2 * scale) * 100 + yAdjust).toFixed(3);
  const mask = POSE_MASK[posicion] ?? null;
  return (
    <div style={{
      width: '100%', height: '100%',
      backgroundImage: `url(${SPRITE[sheet]})`,
      backgroundSize: `${bsW}% ${bsH}%`,
      backgroundPosition: `${xPct}% ${yPct}%`,
      backgroundRepeat: 'no-repeat',
      filter: 'invert(1) brightness(3) contrast(15)',
      opacity: 0.82,
      ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : {}),
    }} />
  );
}
