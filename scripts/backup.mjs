import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { writeFileSync } from 'fs';

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

async function backupCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

const now = new Date();
const ts  = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

console.log(`\n📦 Iniciando backup — ${now.toLocaleString('es-PE')}\n`);

const [jugadores, partidos, penaltis] = await Promise.all([
  backupCollection('jugadores'),
  backupCollection('partidos'),
  backupCollection('penaltis'),
]);

const backup = {
  generadoEn: now.toISOString(),
  jugadores,
  partidos,
  penaltis,
};

const filename = `backup-rdm-${ts}.json`;
writeFileSync(filename, JSON.stringify(backup, null, 2), 'utf8');

console.log(`✅ jugadores : ${jugadores.length} documentos`);
console.log(`✅ partidos  : ${partidos.length} documentos`);
console.log(`✅ penaltis  : ${penaltis.length} documentos`);
console.log(`\n💾 Guardado en: ${filename}\n`);

process.exit(0);
