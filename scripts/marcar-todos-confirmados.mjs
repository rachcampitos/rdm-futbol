import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

// weekId = lunes de la semana actual
function getWeekId() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const weekId = getWeekId();
console.log(`\n📅 Semana: ${weekId}\n`);

const snap = await getDocs(collection(db, 'jugadores'));
const activos = snap.docs
  .filter(d => d.data().activo !== false)
  .map(d => ({ id: d.id, ...d.data() }));

const convocados = activos.map(j => ({
  jugadorId: j.id,
  nombre:    j.nombre,
  posicion:  j.posicion ?? 'DC',
  estado:    'confirmado',
  pagado:    true,
}));

await setDoc(doc(db, 'partidos', weekId), {
  fecha:           weekId,
  convocados,
  equipoA:         [],
  equipoB:         [],
  sorteoRealizado: false,
}, { merge: true });

console.log(`✅ ${activos.length} jugadores marcados como confirmados y pagados:`);
activos.forEach(j => console.log(`   ${j.nombre}`));
process.exit(0);
