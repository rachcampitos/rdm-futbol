import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPad0Pql1yLNeEliXJXNjVuPM8rDzAPgI",
  authDomain: "rdm-futbol.firebaseapp.com",
  projectId: "rdm-futbol",
  storageBucket: "rdm-futbol.firebasestorage.app",
  messagingSenderId: "379910756349",
  appId: "1:379910756349:web:9a8423efa068b5183deb94",
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);

async function borrarColeccion(nombre) {
  const snap = await getDocs(collection(db, nombre));
  if (snap.empty) { console.log(`  ${nombre}: vacía, nada que borrar`); return; }
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, nombre, d.id))));
  console.log(`  ${nombre}: ${snap.size} documentos eliminados ✓`);
}

// ⚠️  PELIGRO: borra TODO. Solo usar en entorno de desarrollo.
// Para producción usa scripts individuales:
//   node scripts/borrar-penaltis.mjs
//   node scripts/borrar-partido.mjs
const args = process.argv.slice(2);
if (!args.includes('--confirmar')) {
  console.error('\n🚫  BLOQUEADO — este script borra todos los jugadores, partidos y penaltis.');
  console.error('   Solo úsalo en desarrollo local, NUNCA en producción.');
  console.error('   Si realmente quieres continuar: node scripts/reset-db.mjs --confirmar\n');
  process.exit(1);
}

console.log('🗑  Limpiando base de datos...\n');
await borrarColeccion('jugadores');
await borrarColeccion('partidos');
await borrarColeccion('penaltis');
console.log('\n✅ Listo — base de datos limpia.');
process.exit(0);
