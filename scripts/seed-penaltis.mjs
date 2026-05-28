import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

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

// Historial de Jeffry — falta injustificada = 1 doce c/u
// jugadorId usa prefijo "hist_" para distinguirlos de registros reales
const PENALTIS = [
  { nombre: 'Mego',            jugadorId: 'hist_mego',            monto: 3 },
  { nombre: 'Carlos',          jugadorId: 'hist_carlos',          monto: 1 },
  { nombre: 'Juan',            jugadorId: 'hist_juan',            monto: 1 },
  { nombre: 'Rooney',          jugadorId: 'hist_rooney',          monto: 1 },
  { nombre: 'Juan Tejada',     jugadorId: 'hist_juan_tejada',     monto: 2 },
  { nombre: 'Ivan Primo',      jugadorId: 'hist_ivan_primo',      monto: 2 },
  { nombre: 'Eduardo',         jugadorId: 'hist_eduardo',         monto: 1 },
  { nombre: 'Arturo Córdova',  jugadorId: 'hist_arturo_cordova',  monto: 1 },
  { nombre: 'Hector Rodriguez',jugadorId: 'hist_hector_rodriguez',monto: 1 },
];

console.log('🍺  Cargando historial de penaltis...\n');

for (const p of PENALTIS) {
  await addDoc(collection(db, 'penaltis'), {
    jugadorId:   p.jugadorId,
    nombre:      p.nombre,
    tipo:        'falta_injustificada',
    monto:       p.monto,
    descripcion: 'Historial previo',
    pagado:      false,
    createdAt:   Timestamp.now(),
  });
  console.log(`  ${p.nombre}: ${p.monto} doce${p.monto > 1 ? 's' : ''} ✓`);
}

console.log('\n✅ Historial cargado.');
process.exit(0);
