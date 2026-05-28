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

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const snap = await getDocs(collection(db, 'penaltis'));
if (snap.empty) { console.log('penaltis: vacía, nada que borrar'); process.exit(0); }
await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'penaltis', d.id))));
console.log(`✅ penaltis: ${snap.size} documentos eliminados.`);
process.exit(0);
