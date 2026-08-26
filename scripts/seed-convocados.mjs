import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDPad0Pql1yLNeEliXJXNjVuPM8rDzAPgI',
  projectId: 'rdm-futbol',
});
const db = getFirestore(app);

const WEEK_ID = '2026-06-01';

const IDS = [
  '0WLMs6aCtGFq1JbHja6a', // Luis L.
  '1PD9HacxZ6mHsfVMENDB', // Daniel Espejo
  '9cugEub7GPPDRCqCDSxt', // Gustavo
  'CXX3mrTkBt0FE1Hex2mD', // Cristhian Fernández
  'JWriVtxv2CSIJLKqxnsz', // Jean Pierre Pradel
  'Ry9jtnb06MFGc84yPAPr', // Christian C.
  'SqkpE9uYjvuZUz06ygdm', // Jose La Rosa
  'nFLkJ4f3f4rHGWwwX1x7', // Arturo Q.
  'p71tE2wKOaog1x0JKnGS', // Jonathan C.
  'seqDudKO4cpQfGkpQo2J', // Juan Tejada Rojas
  'absSez00BTBygEDrHk6E', // Marlon Tello
  'gwdIOJd5fTiCb0VmAEcr', // Alberto Bendezu
  'yEt55VzAXPFFpHwfKTj1', // Jeffry Gomez
  '91f8qTshgRNn9BwmwYU5', // Flavio
  'XzMttUgdWctzS50qum5w', // Geibel C.
  'e34eR3fwGxtoFBpP8lOS', // Javier Plateros
  'LbJp50g2324n81OyFXDt', // Johny Kuoman
  '8kqsRx1CNYfesEVJQxtm', // Julio Bonelli
  '9ZvwV04xbOrf32khQzkJ', // Luis Reinoso
  'DG0gsiRuTLsaxxMJRfCN', // Wilfredo Vasquez
  'C59ZE6sp9rSCxs7mHRph', // Alexander
  'mrOXh7CytT830njJuHYl', // Raul Campos
];

// Fetch jugadores to get real names and positions
const snap = await getDocs(collection(db, 'jugadores'));
const jugadores = {};
snap.forEach(d => { jugadores[d.id] = d.data(); });

const convocados = IDS.map(id => {
  const j = jugadores[id];
  if (!j) { console.warn(`⚠️  Jugador no encontrado: ${id}`); return null; }
  return {
    jugadorId: id,
    nombre: j.nombre,
    posicion: j.posicion,
    estado: 'confirmado',
    pagado: false,
  };
}).filter(Boolean);

await setDoc(doc(db, 'partidos', WEEK_ID), {
  fecha: WEEK_ID,
  cuota: 19,
  convocados,
  sorteoRealizado: false,
}, { merge: true });

console.log(`✅ ${convocados.length} jugadores confirmados en ${WEEK_ID}:`);
convocados.forEach((c, i) => console.log(`   ${i + 1}. ${c.nombre} (${c.posicion})`));
process.exit(0);
