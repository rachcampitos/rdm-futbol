import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, deleteField, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPad0Pql1yLNeEliXJXNjVuPM8rDzAPgI",
  authDomain: "rdm-futbol.firebaseapp.com",
  projectId: "rdm-futbol",
  storageBucket: "rdm-futbol.firebasestorage.app",
  messagingSenderId: "379910756349",
  appId: "1:379910756349:web:9a8423efa068b5183deb94",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Resets sorteo fields on a partido doc, keeping convocados intact.
const weekId = process.argv[2];
if (!weekId) {
  console.error('Uso: node scripts/reset-sorteo.mjs <weekId>');
  console.error('  Ejemplo: node scripts/reset-sorteo.mjs 2026-05-25');
  process.exit(1);
}

const ref  = doc(db, 'partidos', weekId);
const snap = await getDoc(ref);
if (!snap.exists()) {
  console.error(`No existe el partido ${weekId}`);
  process.exit(1);
}

const data = snap.data();
console.log(`Partido ${weekId}: ${data.convocados?.length ?? 0} convocados`);
console.log('Campos a borrar: sorteoRealizado, equipoA, equipoB, iniciado, cerrado, marcadorVivo, resultado, goleadores, formacionA, formacionB, mvpVotos');

await updateDoc(ref, {
  sorteoRealizado: deleteField(),
  equipoA:        deleteField(),
  equipoB:        deleteField(),
  iniciado:       deleteField(),
  cerrado:        deleteField(),
  marcadorVivo:   deleteField(),
  resultado:      deleteField(),
  goleadores:     deleteField(),
  formacionA:     deleteField(),
  formacionB:     deleteField(),
  mvpVotos:       deleteField(),
});

console.log(`✓ Sorteo reseteado. Convocados conservados: ${data.convocados?.length ?? 0}`);
process.exit(0);
