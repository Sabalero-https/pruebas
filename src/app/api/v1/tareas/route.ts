import { NextResponse } from "next/server";
import { aDatosCreacion, conApi, interpretarCuerpoTarea, leerJson, tareaJson } from "@/lib/api";
import { GRUPOS_VENCIMIENTO, exigirEstado, exigirPrioridad, interpretarFecha, type Vencimiento } from "@/lib/dominio";
import { ErrorValidacion } from "@/lib/dominio";
import { resolverArea, resolverCliente, resolverColaborador } from "@/lib/servicios/comun";
import { detalleTarea, listarTareas, type FiltrosTareas } from "@/lib/servicios/consultas";
import { crearTarea } from "@/lib/servicios/tareas";

/** GET /api/v1/tareas: filtros: cliente, area, responsable (o "sin"), estado (lista separada por comas o "todas"),
 *  prioridad, vence (vencida|hoy|semana|proxima|sin_fecha), vence_desde, vence_hasta, q, clave_externa, limite, offset */
export const GET = conApi(async (req, { db }) => {
  const p = new URL(req.url).searchParams;
  const f: FiltrosTareas = {};
  if (p.get("cliente")) f.clienteIds = [(await resolverCliente(db, p.get("cliente")!)).id];
  if (p.get("area")) f.areaIds = [p.get("area") === "sin" ? "sin" : (await resolverArea(db, p.get("area")!)).id];
  if (p.get("responsable")) {
    f.responsables = [p.get("responsable") === "sin" ? "sin" : (await resolverColaborador(db, p.get("responsable")!)).id];
  }
  const estado = p.get("estado");
  if (estado === "todas") f.incluirHechas = true;
  else if (estado) f.estados = estado.split(",").map((e) => exigirEstado(e));
  if (p.get("prioridad")) f.prioridades = p.get("prioridad")!.split(",").map((x) => exigirPrioridad(x));
  const vence = p.get("vence");
  if (vence) {
    if (!GRUPOS_VENCIMIENTO.some((g) => g.valor === vence)) throw new ErrorValidacion(`"vence" inválido: ${vence}`);
    f.vencimiento = vence as Vencimiento;
  }
  if (p.get("vence_desde")) f.venceDesde = interpretarFecha(p.get("vence_desde")) ?? undefined;
  if (p.get("vence_hasta")) f.venceHasta = interpretarFecha(p.get("vence_hasta")) ?? undefined;
  if (p.get("q")) f.busqueda = p.get("q")!;
  if (p.get("clave_externa")) {
    f.claveExterna = p.get("clave_externa")!;
    f.incluirHechas = true;
  }
  const limite = Math.min(Math.max(Number(p.get("limite") ?? 100) || 100, 1), 200);
  const offset = Math.max(Number(p.get("offset") ?? 0) || 0, 0);
  const filas = await listarTareas(db, { ...f, limite: limite + 1, offset });
  return NextResponse.json({
    tareas: filas.slice(0, limite).map((t) => tareaJson(req, t)),
    hay_mas: filas.length > limite,
    siguiente_offset: filas.length > limite ? offset + limite : null,
  });
});

/** POST /api/v1/tareas: crea una tarea. Con clave_externa es idempotente (200 si ya existía, 201 si se creó). */
export const POST = conApi(async (req, { db, actor }) => {
  const { datos } = await interpretarCuerpoTarea(db, await leerJson(req), false);
  const { tarea, creada } = await crearTarea(db, aDatosCreacion(datos), actor);
  const detalle = await detalleTarea(db, tarea.id);
  return NextResponse.json({ tarea: tareaJson(req, detalle!), creada }, { status: creada ? 201 : 200 });
});
