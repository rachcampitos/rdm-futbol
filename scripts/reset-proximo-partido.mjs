import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDPad0Pql1yLNeEliXJXNjVuPM8rDzAPgI',
  projectId: 'rdm-futbol',
});
const db = getFirestore(app);

const WEEK_ID = '2026-06-01';

await deleteDoc(doc(db, 'partidos', WEEK_ID));
console.log(`✅ Partido ${WEEK_ID} eliminado — próxima semana en blanco`);
process.exit(0);
