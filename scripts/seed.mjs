import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPad0Pql1yLNeEliXJXNjVuPM8rDzAPgI",
  authDomain: "rdm-futbol.firebaseapp.com",
  projectId: "rdm-futbol",
  storageBucket: "rdm-futbol.firebasestorage.app",
  messagingSenderId: "379910756349",
  appId: "1:379910756349:web:9a8423efa068b5183deb94",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const JUGADORES = [
  { nombre: 'Carlos Mendoza',    posicion: 'POR'  },
  { nombre: 'Miguel Quispe',     posicion: 'POR'  },
  { nombre: 'Juan Rojas',        posicion: 'LTI'  },
  { nombre: 'Roberto Silva',     posicion: 'DFCi' },
  { nombre: 'Pedro Huanca',      posicion: 'DFCd' },
  { nombre: 'Luis Paredes',      posicion: 'LTD'  },
  { nombre: 'Diego Mamani',      posicion: 'LTI'  },
  { nombre: 'Oscar Flores',      posicion: 'DFCi' },
  { nombre: 'Raul Quispe',       posicion: 'DFCd' },
  { nombre: 'Jorge Cáceres',     posicion: 'LTD'  },
  { nombre: 'Marco Condori',     posicion: 'MDC'  },
  { nombre: 'Antonio Vargas',    posicion: 'MC'   },
  { nombre: 'Fernando Torres',   posicion: 'MCI'  },
  { nombre: 'Sergio Huanca',     posicion: 'MCD'  },
  { nombre: 'Alfredo Llanos',    posicion: 'MOC'  },
  { nombre: 'Christian Apaza',   posicion: 'MC'   },
  { nombre: 'Julio Ramos',       posicion: 'MDC'  },
  { nombre: 'Richard Chávez',    posicion: 'MOC'  },
  { nombre: 'Edwin Quispe',      posicion: 'EXI'  },
  { nombre: 'Jhon Coyla',        posicion: 'DC'   },
  { nombre: 'Walter Puma',       posicion: 'DC'   },
  { nombre: 'Alex Cusi',         posicion: 'EXD'  },
  { nombre: 'César Mamani',      posicion: 'SD'   },
  { nombre: 'Harold Pilco',      posicion: 'EXI'  },
];

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

async function seed() {
  console.log('🌱 Insertando jugadores...');

  const ids = [];

  for (let i = 0; i < JUGADORES.length; i++) {
    const j = JUGADORES[i];
    const ref = await addDoc(collection(db, 'jugadores'), {
      nombre: j.nombre,
      posicion: j.posicion,
      activo: true,
      createdAt: new Date(Date.now() - (JUGADORES.length - i) * 1000),
    });
    ids.push({ id: ref.id, ...j });
    console.log(`  ✓ ${j.nombre} (${j.posicion})`);
  }

  // Confirmar 20 de 24 jugadores para esta semana
  const confirmados = ids.slice(0, 20);
  const pagados = confirmados.slice(0, 14); // 14 ya pagaron

  const convocados = confirmados.map(j => ({
    jugadorId: j.id,
    nombre: j.nombre,
    posicion: j.posicion,
    estado: 'confirmado',
    pagado: pagados.some(p => p.id === j.id),
  }));

  // Equipos: 10 vs 10
  const equipoA = confirmados.slice(0, 10).map(j => j.id);
  const equipoB = confirmados.slice(10, 20).map(j => j.id);

  const weekId = getWeekId();
  console.log(`\n🗓️  Creando partido semana ${weekId}...`);

  await setDoc(doc(db, 'partidos', weekId), {
    fecha: weekId,
    cuota: 15,
    convocados,
    equipoA,
    equipoB,
    sorteoRealizado: true,
  });

  console.log('  ✓ Partido creado: 20 confirmados, 14 pagados, sorteo listo');

  // Penaltis de prueba
  console.log('\n🟨 Creando penaltis de prueba...');

  const penaltisData = [
    { jugadorId: ids[21].id, nombre: ids[21].nombre, tipo: 'cancelacion_tardia', monto: 20, descripcion: 'Canceló 1 hora antes', pagado: false },
    { jugadorId: ids[22].id, nombre: ids[22].nombre, tipo: 'no_show',            monto: 30, descripcion: 'No apareció al partido', pagado: false },
    { jugadorId: ids[3].id,  nombre: ids[3].nombre,  tipo: 'cancelacion_tardia', monto: 20, descripcion: 'Canceló por trabajo',   pagado: true  },
  ];

  for (const p of penaltisData) {
    await addDoc(collection(db, 'penaltis'), {
      ...p,
      createdAt: new Date(),
    });
    console.log(`  ✓ Penalti: ${p.nombre} — S/ ${p.monto}`);
  }

  console.log('\n✅ Seed completo. Abre la app y prueba todo.');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
