/**
 * Simula un after-match para el video tutorial:
 * - Cierra el partido 2026-05-25 con resultado 3-1
 * - Jeffry gomez: 2 goles  |  Christian C.: 1 gol
 * - 9 jugadores votan por Jeffry como MVP, 3 por Christian
 * - participantesIds con los 21 convocados
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, deleteField } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDPad0Pql1yLNeEliXJXNjVuPM8rDzAPgI',
  projectId: 'rdm-futbol',
});
const db = getFirestore(app);

const WEEK_ID   = '2026-05-25';
const JEFFRY_ID    = 'yEt55VzAXPFFpHwfKTj1'; // goleador
const CHRISTIAN_ID = 'Ry9jtnb06MFGc84yPAPr'; // segundo goleador
const MVP_ID       = 'gwdIOJd5fTiCb0VmAEcr'; // Alberto Bendezu — defensa elegido MVP

// Todos los convocados (los 21)
const TODOS = [
  '0WLMs6aCtGFq1JbHja6a', // Luis L.
  '1PD9HacxZ6mHsfVMENDB', // Daniel Espejo
  '9cugEub7GPPDRCqCDSxt', // Gustavo
  'CXX3mrTkBt0FE1Hex2mD', // Cristhian Fernández
  'JWriVtxv2CSIJLKqxnsz', // Jean Pierre Pradel
  'Ry9jtnb06MFGc84yPAPr', // Christian C.
  'SqkpE9uYjvuZUz06ygdm', // Jose La Rosa
  'nFLkJ4f3f4rHGWwwX1x7', // Arturo Q.
  'p71tE2wKOaog1x0JKnGS', // Jonathan C.
  'seqDudKO4cpQfGkpQo2J', // Juan Tejada rojas
  'absSez00BTBygEDrHk6E', // Marlon Tello
  'gwdIOJd5fTiCb0VmAEcr', // Alberto Bendezu
  'yEt55VzAXPFFpHwfKTj1', // Jeffry gomez
  '91f8qTshgRNn9BwmwYU5', // Flavio
  'XzMttUgdWctzS50qum5w', // Geibel C.
  'e34eR3fwGxtoFBpP8lOS', // JAVIER PLATEROS
  'LbJp50g2324n81OyFXDt', // Johny Kuoman
  '8kqsRx1CNYfesEVJQxtm', // Julio Bonelli
  '9ZvwV04xbOrf32khQzkJ', // Luis Reinoso
  'DG0gsiRuTLsaxxMJRfCN', // Wilfredo Vasquez
  'C59ZE6sp9rSCxs7mHRph', // Alexander
  'mrOXh7CytT830njJuHYl', // Raul Campos
];

// 9 votan por Alberto (defensa MVP), 3 por Jeffry, 3 por Christian
const sinMvp    = TODOS.filter(id => id !== MVP_ID);
const votanMvp  = sinMvp.slice(0, 9);
const votanJeff = sinMvp.slice(9, 12);
const votanChri = sinMvp.slice(12, 15);

const mvpVotos = {};
votanMvp.forEach(id  => { mvpVotos[id] = MVP_ID; });
votanJeff.forEach(id => { mvpVotos[id] = JEFFRY_ID; });
votanChri.forEach(id => { mvpVotos[id] = CHRISTIAN_ID; });

await updateDoc(doc(db, 'partidos', WEEK_ID), {
  cerrado: true,
  resultado: { golesA: 3, golesB: 1 },
  goleadores: [
    { jugadorId: JEFFRY_ID,    nombre: 'Jeffry gomez',  goles: 2 },
    { jugadorId: CHRISTIAN_ID, nombre: 'Christian C.',  goles: 1 },
  ],
  participantesIds: TODOS,
  mvpVotos,
  // limpiar campos de sorteo activo
  sorteoRealizado: deleteField(),
  equipoA:         deleteField(),
  equipoB:         deleteField(),
  iniciado:        deleteField(),
  marcadorVivo:    deleteField(),
  formacionA:      deleteField(),
  formacionB:      deleteField(),
});

console.log('✅ After-match seeded:');
console.log('   Resultado: Azul 3 — Rojo 1');
console.log('   Goleadores: Jeffry (2), Christian C. (1)');
console.log(`   Votos MVP: Alberto ${votanMvp.length}, Jeffry ${votanJeff.length}, Christian ${votanChri.length}`);
console.log('   → Alberto Bendezu es el MVP (defensa)');
console.log('   → Jeffry es el Goleador del Partido');
console.log('\n   Enlace de Jeffry (goleador):');
console.log(`   https://rdm-futbol.pages.dev/?uid=${JEFFRY_ID}`);
console.log('\n   Enlace de Alberto (MVP defensa):');
console.log(`   https://rdm-futbol.pages.dev/?uid=${MVP_ID}`);
process.exit(0);
