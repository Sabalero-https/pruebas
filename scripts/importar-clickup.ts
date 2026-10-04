// Importa tareas desde ClickUp.
//
//   CLICKUP_TOKEN=pk_... npm run importar:clickup              → simulación: muestra qué se importaría
//   CLICKUP_TOKEN=pk_... npm run importar:clickup -- --aplicar → importa de verdad
//
// Opciones:
//   --aplicar                 escribe en la base (sin esto solo simula)
//   --json archivo.json       usa un export guardado en vez de llamar a la API
//   --guardar archivo.json    guarda lo descargado de ClickUp (para revisar o reintentar)
//   --espacio-interno NOMBRE  espacio/carpeta de ClickUp que corresponde a la agencia (default "Sumo Growth")
//
// Es seguro correrlo varias veces: cada tarea guarda su id de ClickUp y no se duplica.
import fs from "node:fs";
import { getDb } from "@/lib/db";
import { aplicarImportacion, descargarClickUp, planificarImportacion, type ExportClickUp } from "@/lib/importador-clickup";
import { catalogos } from "@/lib/servicios/consultas";
import { etiquetaEstado } from "@/lib/dominio";

const args = process.argv.slice(2);
const opcion = (nombre: string) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
const aplicar = args.includes("--aplicar");

let datos: ExportClickUp;
if (opcion("--json")) {
  datos = JSON.parse(fs.readFileSync(opcion("--json")!, "utf8"));
} else {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    console.error("Falta CLICKUP_TOKEN (ClickUp → Settings → Apps → API Token) o --json archivo.json");
    process.exit(1);
  }
  console.log("Descargando de ClickUp…");
  datos = await descargarClickUp(token, process.env.CLICKUP_TEAM_ID);
  if (opcion("--guardar")) fs.writeFileSync(opcion("--guardar")!, JSON.stringify(datos, null, 2));
}

const db = await getDb();
const cat = await catalogos(db);
const interno = cat.clientes.find((c) => c.esInterno);
if (!interno) {
  console.error("Primero hacé la configuración inicial de la app (crear el admin) en /setup.");
  process.exit(1);
}
const plan = planificarImportacion(datos, {
  espacioInterno: opcion("--espacio-interno") ?? "Sumo Growth",
  clienteInterno: interno.nombre,
  emailsConocidos: cat.colaboradores.map((c) => c.email),
});

console.log(`\n${plan.tareas.length} tareas en ${plan.clientes.length} clientes y ${plan.areas.length} áreas\n`);
const porCliente = new Map<string, typeof plan.tareas>();
for (const t of plan.tareas) porCliente.set(t.cliente, [...(porCliente.get(t.cliente) ?? []), t]);
for (const [cliente, tareas] of porCliente) {
  console.log(`▸ ${cliente}`);
  for (const t of tareas) {
    console.log(`   [${etiquetaEstado(t.estado)}] ${t.titulo}  · ${t.area}${t.venceEl ? ` · vence ${t.venceEl}` : ""}${t.responsableEmail ? ` · ${t.responsableEmail}` : " · sin asignar"}`);
  }
}
if (plan.advertencias.length) {
  console.log("\nAdvertencias:");
  for (const a of plan.advertencias) console.log(`  ⚠ ${a}`);
}

if (!aplicar) {
  console.log("\nSimulación: no se guardó nada. Repetí con --aplicar para importar.");
  process.exit(0);
}
const r = await aplicarImportacion(db, plan, { tipo: "sistema", nombre: "Importación ClickUp" });
console.log(`\nListo: ${r.creadas} tareas creadas, ${r.existentes} ya existían.`);
if (r.clientesCreados.length) console.log(`Clientes creados: ${r.clientesCreados.join(", ")}`);
if (r.areasCreadas.length) console.log(`Áreas creadas: ${r.areasCreadas.join(", ")}`);
process.exit(0);
