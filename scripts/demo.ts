// Carga datos de ejemplo para probar la app. Solo funciona con la base vacía.
//   npm run demo   → después: npm run dev y entrar con ana@demo.local / demo1234
import { getDb } from "@/lib/db";
import { hoy, sumarDias } from "@/lib/dominio";
import { crearArea, crearCliente } from "@/lib/servicios/catalogo";
import type { Actor } from "@/lib/servicios/comun";
import { catalogos } from "@/lib/servicios/consultas";
import {
  aceptarInvitacion,
  configuracionInicial,
  crearColaborador,
  crearTokenApi,
  hayColaboradores,
} from "@/lib/servicios/cuentas";
import { crearRegla, generarRecurrentes } from "@/lib/servicios/recurrentes";
import { actualizarTarea, comentar, crearTarea, type DatosTarea } from "@/lib/servicios/tareas";

const db = await getDb();
if (await hayColaboradores(db)) {
  console.error(
    process.env.DATABASE_URL
      ? "La base ya tiene datos: el demo solo se carga en una base vacía."
      : "La base ya tiene datos. Para empezar de cero borrá la carpeta .data/ (con la app apagada).",
  );
  process.exit(1);
}

const PASSWORD = "demo1234";
const ana = await configuracionInicial(db, { nombre: "Ana Martínez", email: "ana@demo.local", password: PASSWORD });
const admin: Actor = { tipo: "colaborador", id: ana.id, nombre: ana.nombre, rol: "admin" };

const persona = async (nombre: string, email: string) => {
  const { colaborador, token } = await crearColaborador(db, { nombre, email }, admin);
  await aceptarInvitacion(db, token, PASSWORD);
  return colaborador;
};
const bruno = await persona("Bruno Díaz", "bruno@demo.local");
const carla = await persona("Carla Gómez", "carla@demo.local");
const actorDe = (c: { id: string; nombre: string }): Actor => ({ tipo: "colaborador", id: c.id, nombre: c.nombre, rol: "miembro" });

const cafe = await crearCliente(db, { nombre: "Café Andino", responsableId: bruno.id }, admin);
const moto = await crearCliente(db, { nombre: "Moto Sur", responsableId: carla.id }, admin);
const lumen = await crearCliente(db, { nombre: "Lumen Skincare", responsableId: ana.id }, admin);
await crearArea(db, "SEO", admin);

const cat = await catalogos(db);
const interno = cat.clientes.find((c) => c.esInterno)!;
const area = (nombre: string) => cat.areas.find((a) => a.nombre === nombre)!.id;
const h = hoy();
const d = (n: number) => sumarDias(h, n);

const tareas: [DatosTarea, Actor, string?][] = [
  [{ titulo: "Optimización semanal de campañas", clienteId: cafe.id, areaId: area("Pauta"), responsableId: bruno.id, venceEl: d(-2), prioridad: "alta" }, admin],
  [{ titulo: "Revisión de creativos de octubre", clienteId: cafe.id, areaId: area("Producción Creativa"), responsableId: carla.id, venceEl: d(0), estado: "en_curso" }, admin],
  [{ titulo: "Enviar status semanal al cliente", clienteId: cafe.id, areaId: area("Entregables/Reportes"), responsableId: bruno.id, venceEl: d(1) }, admin],
  [{ titulo: "Configurar flujo de carrito abandonado", clienteId: cafe.id, areaId: area("Email/Automatizaciones"), venceEl: d(4), estado: "esperando_cliente", descripcion: "Esperando accesos a Klaviyo." }, admin],
  [{ titulo: "Conectar API de stock con Meta Catalog", clienteId: moto.id, areaId: area("Desarrollo/Conexiones"), responsableId: carla.id, venceEl: d(-1), prioridad: "urgente" }, admin],
  [{ titulo: "Estructura de pauta — próximo mes", clienteId: moto.id, areaId: area("Pauta"), venceEl: d(6), estado: "en_revision", claveExterna: "demo:agente3:pauta" }, { tipo: "api", id: "demo", nombre: "Agente 3 — Pauta" }],
  [{ titulo: "Grilla de contenidos — próximo mes", clienteId: moto.id, areaId: area("Planificación"), responsableId: carla.id, venceEl: d(3), estado: "en_revision", claveExterna: "demo:agente2:grilla" }, { tipo: "api", id: "demo", nombre: "Agente 2 — Grilla" }],
  [{ titulo: "Nueva campaña de lanzamiento (URGENTE)", clienteId: moto.id, areaId: area("Producción Creativa"), prioridad: "urgente" }, admin],
  [{ titulo: "Auditoría SEO inicial", clienteId: lumen.id, areaId: area("SEO"), responsableId: ana.id, venceEl: d(9) }, admin],
  [{ titulo: "Calendario comercial del trimestre", clienteId: lumen.id, areaId: area("Planificación"), responsableId: ana.id, venceEl: d(2), estado: "en_curso" }, admin],
  [{ titulo: "Reporte mensual + P&L", clienteId: lumen.id, areaId: area("Entregables/Reportes"), responsableId: bruno.id, venceEl: d(12), prioridad: "alta" }, admin],
  [{ titulo: "Ideas de colaboración con influencers", clienteId: lumen.id, areaId: area("Producción Creativa"), estado: "backlog" }, admin],
  [{ titulo: "SOP — Onboarding de clientes", clienteId: interno.id, areaId: area("Estrategia-Ops"), responsableId: ana.id, venceEl: d(5) }, admin],
  [{ titulo: "Facturación del mes", clienteId: interno.id, areaId: area("Finanzas"), responsableId: ana.id, venceEl: d(-3), prioridad: "alta" }, admin],
  [{ titulo: "Propuesta para prospecto e-commerce", clienteId: interno.id, areaId: area("Prospección/Nuevos clientes"), responsableId: carla.id, venceEl: d(7) }, admin],
  [{ titulo: "Política de privacidad", clienteId: interno.id, areaId: area("Estrategia-Ops"), responsableId: bruno.id }, admin, "hecho"],
  [{ titulo: "Calendario de contenido de septiembre", clienteId: cafe.id, areaId: area("Planificación"), responsableId: carla.id }, admin, "hecho"],
];

for (const [datos, actor, estadoFinal] of tareas) {
  const { tarea } = await crearTarea(db, datos, actor);
  if (estadoFinal) await actualizarTarea(db, tarea.id, { estado: "hecho" }, actor);
  if (datos.titulo.startsWith("Revisión de creativos")) {
    await comentar(db, tarea.id, "Subí los 6 creativos a Drive, faltan los videos verticales.", actorDe(carla));
    await comentar(db, tarea.id, "Perfecto, los reviso a la tarde.", actorDe(bruno));
  }
}

await crearRegla(db, { titulo: "Daily Forecast", clienteId: cafe.id, areaId: area("Entregables/Reportes"), responsableId: bruno.id, frecuencia: "diaria_habil", prioridad: "alta" }, admin);
await crearRegla(db, { titulo: "Optimización semanal — {fecha}", clienteId: moto.id, areaId: area("Pauta"), responsableId: carla.id, frecuencia: "semanal", diaSemana: 1, diasParaVencer: 1 }, admin);
await crearRegla(db, { titulo: "Reporte mensual {mes}", clienteId: lumen.id, areaId: area("Entregables/Reportes"), responsableId: ana.id, frecuencia: "mensual", diaMes: 1, diasParaVencer: 5 }, admin);
await generarRecurrentes(db);

const { token } = await crearTokenApi(db, "Agente demo", admin);

console.log(`
Datos de ejemplo cargados ✔

  Usuarios (contraseña: ${PASSWORD})
    ana@demo.local    (admin)
    bruno@demo.local
    carla@demo.local

  Token de API para probar: ${token}

Ahora: npm run dev  →  http://localhost:3000
`);
process.exit(0);
