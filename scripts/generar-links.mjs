import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

const BASE = 'https://rdm-futbol.pages.dev';
const snap = await getDocs(collection(db, 'jugadores'));

console.log('\n🔗 ENLACES PERSONALES — enviar por WhatsApp\n');
snap.docs
  .filter(d => d.data().activo !== false)
  .sort((a, b) => a.data().nombre.localeCompare(b.data().nombre))
  .forEach(d => {
    const { nombre } = d.data();
    console.log(`${nombre}:\n  ${BASE}?uid=${d.id}\n`);
  });

process.exit(0);
