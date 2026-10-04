import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  actividad,
  areas,
  clientes,
  colaboradores,
  comentarios,
  tareas,
  type EstadoTarea,
  type Link,
  type Prioridad,
  type Tarea,
} from "../db/schema";
import { ErrorValidacion, etiquetaEstado, etiquetaPrioridad, interpretarFecha } from "../dominio";
import { type Actor, NoEncontrado, exigirTexto, nombreActor, nombresPorId } from "./comun";

export type DatosTarea = {
  titulo: string;
  descripcion?: string | null;
  clienteId: string;
  areaId?: string | null;
  responsableId?: string | null;
  estado?: EstadoTarea;
  prioridad?: Prioridad;
  venceEl?: string | null;
  links?: Link[];
  claveExterna?: string | null;
  origen?: "manual" | "api" | "recurrente" | "migracion";
  reglaId?: string | null;
  fechaProgramada?: string | null;
};

export type CambiosTarea = Partial<
  Pick<
    DatosTarea,
    "titulo" | "descripcion" | "clienteId" | "areaId" | "responsableId" | "estado" | "prioridad" | "venceEl" | "links"
  >
> & { ordenKanban?: number };

const MAX_TITULO = 300;
const MAX_DESCRIPCION = 20000;

// ------------------------------------------------------------- validaciones

function limpiarDescripcion(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const texto = valor.trim();
  if (texto.length > MAX_DESCRIPCION) {
    throw new ErrorValidacion(`La descripción no puede superar ${MAX_DESCRIPCION} caracteres`, "muy_largo");
  }
  return texto || null;
}

export function validarLinks(links: unknown): Link[] {
  if (links === undefined || links === null) return [];
  if (!Array.isArray(links)) throw new ErrorValidacion("Los links deben ser una lista", "links_invalidos");
  if (links.length > 20) throw new ErrorValidacion("Máximo 20 links por tarea", "links_invalidos");
  const vistos = new Set<string>();
  const resultado: Link[] = [];
  for (const item of links) {
    const url = typeof item === "string" ? item : (item as Link)?.url;
    if (typeof url !== "string" || !url.trim()) continue;
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new ErrorValidacion(`Link inválido: ${url}`, "links_invalidos");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ErrorValidacion(`Solo se aceptan links http(s): ${url}`, "links_invalidos");
    }
    if (vistos.has(parsed.href)) continue;
    vistos.add(parsed.href);
    const tituloCrudo = typeof item === "string" ? "" : (item as Link).titulo;
    const titulo = (typeof tituloCrudo === "string" && tituloCrudo.trim()) || parsed.hostname.replace(/^www\./, "");
    resultado.push({ titulo: titulo.slice(0, 120), url: parsed.href });
  }
  return resultado;
}

async function validarCliente(db: Db, id: string) {
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
  if (!cliente) throw new NoEncontrado("El cliente no existe");
  if (cliente.estado === "archivado") {
    throw new ErrorValidacion(`El cliente ${cliente.nombre} está archivado`, "cliente_archivado");
  }
  return cliente;
}

async function validarArea(db: Db, id: string) {
  const [area] = await db.select().from(areas).where(eq(areas.id, id));
  if (!area) throw new NoEncontrado("El área no existe");
  if (!area.activa) throw new ErrorValidacion(`El área ${area.nombre} está desactivada`, "area_inactiva");
  return area;
}

async function validarResponsable(db: Db, id: string) {
  const [persona] = await db.select().from(colaboradores).where(eq(colaboradores.id, id));
  if (!persona) throw new NoEncontrado("El colaborador no existe");
  if (!persona.activo) {
    throw new ErrorValidacion(`${persona.nombre} está desactivado y no puede recibir tareas`, "colaborador_inactivo");
  }
  return persona;
}

// ------------------------------------------------------------- crear

export async function crearTarea(db: Db, datos: DatosTarea, actor: Actor): Promise<{ tarea: Tarea; creada: boolean }> {
  const titulo = exigirTexto(datos.titulo, "El título", MAX_TITULO);
  const claveExterna = datos.claveExterna?.trim() || null;
  if (claveExterna && claveExterna.length > 200) {
    throw new ErrorValidacion("La clave externa no puede superar 200 caracteres", "muy_largo");
  }

  // Reintento de un agente/importador: devolvemos la tarea existente en lugar de duplicarla.
  if (claveExterna) {
    const [existente] = await db.select().from(tareas).where(eq(tareas.claveExterna, claveExterna));
    if (existente) return { tarea: existente, creada: false };
  }

  if (!datos.clienteId) throw new ErrorValidacion("Toda tarea tiene que tener un cliente", "cliente_requerido");
  await validarCliente(db, datos.clienteId);
  if (datos.areaId) await validarArea(db, datos.areaId);
  if (datos.responsableId) await validarResponsable(db, datos.responsableId);

  const estado = datos.estado ?? "por_hacer";
  const valores = {
    titulo,
    descripcion: limpiarDescripcion(datos.descripcion),
    clienteId: datos.clienteId,
    areaId: datos.areaId || null,
    responsableId: datos.responsableId || null,
    estado,
    prioridad: datos.prioridad ?? "normal",
    venceEl: interpretarFecha(datos.venceEl ?? null),
    links: validarLinks(datos.links),
    ordenKanban: Date.now(),
    origen: datos.origen ?? (actor.tipo === "api" ? "api" : "manual"),
    claveExterna,
    reglaId: datos.reglaId ?? null,
    fechaProgramada: datos.fechaProgramada ?? null,
    creadoPor: nombreActor(actor),
    completadaEn: estado === "hecho" ? new Date() : null,
  };

  const [tarea] = await db.insert(tareas).values(valores).onConflictDoNothing().returning();
  if (!tarea) {
    // Otra petición con la misma clave externa (o misma regla+fecha) ganó la carrera.
    const [existente] = claveExterna
      ? await db.select().from(tareas).where(eq(tareas.claveExterna, claveExterna))
      : datos.reglaId && datos.fechaProgramada
        ? await db
            .select()
            .from(tareas)
            .where(and(eq(tareas.reglaId, datos.reglaId), eq(tareas.fechaProgramada, datos.fechaProgramada)))
        : [];
    if (existente) return { tarea: existente, creada: false };
    throw new ErrorValidacion("No se pudo crear la tarea", "conflicto");
  }
  await db.insert(actividad).values({ tareaId: tarea.id, actor: nombreActor(actor), campo: "creada", despues: titulo });
  return { tarea, creada: true };
}

// ------------------------------------------------------------- actualizar

const CAMPOS_HISTORIAL: Record<string, string> = {
  titulo: "título",
  descripcion: "descripción",
  clienteId: "cliente",
  areaId: "área",
  responsableId: "responsable",
  estado: "estado",
  prioridad: "prioridad",
  venceEl: "vencimiento",
  links: "links",
};

export async function obtenerTarea(db: Db, id: string): Promise<Tarea> {
  const [tarea] = await db.select().from(tareas).where(eq(tareas.id, id));
  if (!tarea) throw new NoEncontrado("La tarea no existe");
  return tarea;
}

/**
 * Aplica solo los campos que cambiaron, con la fila bloqueada (SELECT … FOR UPDATE):
 * los cambios simultáneos sobre la misma tarea se aplican uno detrás del otro, sin perder ninguno.
 * - `versionEsperada`: si se manda y la tarea cambió desde que el usuario la abrió, falla con "conflicto"
 *   en vez de pisar el trabajo de otra persona (se usa al editar título/descripción).
 * - Sin `versionEsperada` (cambios puntuales de estado, responsable, fecha) se aplica sobre la versión más nueva.
 */
export async function actualizarTarea(
  db: Db,
  id: string,
  cambios: CambiosTarea,
  actor: Actor,
  opciones: { versionEsperada?: number } = {},
): Promise<Tarea> {
  return db.transaction(async (transaccion) => {
    const tx = transaccion as unknown as Db;
    const [actual] = await tx.select().from(tareas).where(eq(tareas.id, id)).for("update");
    if (!actual) throw new NoEncontrado("La tarea no existe");
    if (actual.archivadaEn) throw new ErrorValidacion("La tarea está archivada. Restaurala para editarla.", "archivada");
    if (opciones.versionEsperada !== undefined && opciones.versionEsperada !== actual.version) {
      throw new ErrorValidacion(
        "Otra persona modificó esta tarea mientras la editabas. Recargá para ver los cambios.",
        "conflicto",
      );
    }

    const nuevos: Partial<Tarea> = {};
    if (cambios.titulo !== undefined) {
      const titulo = exigirTexto(cambios.titulo, "El título", MAX_TITULO);
      if (titulo !== actual.titulo) nuevos.titulo = titulo;
    }
    if (cambios.descripcion !== undefined) {
      const descripcion = limpiarDescripcion(cambios.descripcion);
      if (descripcion !== actual.descripcion) nuevos.descripcion = descripcion;
    }
    if (cambios.clienteId !== undefined && cambios.clienteId !== actual.clienteId) {
      if (!cambios.clienteId) throw new ErrorValidacion("Toda tarea tiene que tener un cliente", "cliente_requerido");
      await validarCliente(tx, cambios.clienteId);
      nuevos.clienteId = cambios.clienteId;
    }
    if (cambios.areaId !== undefined && (cambios.areaId || null) !== actual.areaId) {
      if (cambios.areaId) await validarArea(tx, cambios.areaId);
      nuevos.areaId = cambios.areaId || null;
    }
    if (cambios.responsableId !== undefined && (cambios.responsableId || null) !== actual.responsableId) {
      if (cambios.responsableId) await validarResponsable(tx, cambios.responsableId);
      nuevos.responsableId = cambios.responsableId || null;
    }
    if (cambios.estado !== undefined && cambios.estado !== actual.estado) {
      nuevos.estado = cambios.estado;
      // completada_en siempre consistente con el estado: se marca al terminar y se limpia al reabrir.
      nuevos.completadaEn = cambios.estado === "hecho" ? new Date() : null;
    }
    if (cambios.prioridad !== undefined && cambios.prioridad !== actual.prioridad) nuevos.prioridad = cambios.prioridad;
    if (cambios.venceEl !== undefined) {
      const fecha = interpretarFecha(cambios.venceEl);
      if (fecha !== actual.venceEl) nuevos.venceEl = fecha;
    }
    if (cambios.links !== undefined) {
      const links = validarLinks(cambios.links);
      if (JSON.stringify(links) !== JSON.stringify(actual.links)) nuevos.links = links;
    }
    if (cambios.ordenKanban !== undefined && Number.isFinite(cambios.ordenKanban)) {
      nuevos.ordenKanban = cambios.ordenKanban;
    }

    if (Object.keys(nuevos).length === 0) return actual;

    const [actualizada] = await tx
      .update(tareas)
      .set({ ...nuevos, version: actual.version + 1, actualizadoEn: new Date() })
      .where(eq(tareas.id, id))
      .returning();
    await registrarCambios(tx, actual, nuevos, actor);
    return actualizada;
  });
}

async function registrarCambios(db: Db, antes: Tarea, nuevos: Partial<Tarea>, actor: Actor) {
  const filas: (typeof actividad.$inferInsert)[] = [];
  const quien = nombreActor(actor);
  const ids = (campo: "clienteId" | "areaId" | "responsableId") => [antes[campo], nuevos[campo] ?? null];
  const nombresCliente = "clienteId" in nuevos ? await nombresPorId(db, "cliente", ids("clienteId")) : null;
  const nombresArea = "areaId" in nuevos ? await nombresPorId(db, "area", ids("areaId")) : null;
  const nombresPersona = "responsableId" in nuevos ? await nombresPorId(db, "colaborador", ids("responsableId")) : null;

  const mostrar = (campo: string, valor: unknown): string | null => {
    if (valor === null || valor === undefined) return null;
    switch (campo) {
      case "estado":
        return etiquetaEstado(valor as EstadoTarea);
      case "prioridad":
        return etiquetaPrioridad(valor as Prioridad);
      case "clienteId":
        return nombresCliente?.get(valor as string) ?? "(eliminado)";
      case "areaId":
        return nombresArea?.get(valor as string) ?? "(eliminada)";
      case "responsableId":
        return nombresPersona?.get(valor as string) ?? "(eliminado)";
      case "descripcion":
        return String(valor).slice(0, 140);
      case "links":
        return (valor as Link[]).map((l) => l.titulo).join(", ") || null;
      default:
        return String(valor);
    }
  };

  for (const campo of Object.keys(nuevos)) {
    if (!(campo in CAMPOS_HISTORIAL)) continue;
    filas.push({
      tareaId: antes.id,
      actor: quien,
      campo: CAMPOS_HISTORIAL[campo],
      antes: mostrar(campo, antes[campo as keyof Tarea]),
      despues: mostrar(campo, nuevos[campo as keyof Tarea]),
    });
  }
  if (filas.length) await db.insert(actividad).values(filas);
}

// ------------------------------------------------------------- archivar / comentar

export async function archivarTarea(db: Db, id: string, actor: Actor) {
  const tarea = await obtenerTarea(db, id);
  if (tarea.archivadaEn) return tarea;
  const [actualizada] = await db
    .update(tareas)
    .set({ archivadaEn: new Date(), version: sql`${tareas.version} + 1`, actualizadoEn: new Date() })
    .where(eq(tareas.id, id))
    .returning();
  await db.insert(actividad).values({ tareaId: id, actor: nombreActor(actor), campo: "archivada" });
  return actualizada;
}

export async function restaurarTarea(db: Db, id: string, actor: Actor) {
  const tarea = await obtenerTarea(db, id);
  if (!tarea.archivadaEn) return tarea;
  // Si el cliente quedó archivado, la tarea no puede volver: quedaría una tarea abierta en un cliente archivado.
  await validarCliente(db, tarea.clienteId);
  const [actualizada] = await db
    .update(tareas)
    .set({ archivadaEn: null, version: sql`${tareas.version} + 1`, actualizadoEn: new Date() })
    .where(eq(tareas.id, id))
    .returning();
  await db.insert(actividad).values({ tareaId: id, actor: nombreActor(actor), campo: "restaurada" });
  return actualizada;
}

export async function comentar(db: Db, tareaId: string, cuerpo: string, actor: Actor) {
  const texto = exigirTexto(cuerpo, "El comentario", 10000);
  await obtenerTarea(db, tareaId);
  const [comentario] = await db
    .insert(comentarios)
    .values({
      tareaId,
      autorId: actor.tipo === "colaborador" ? actor.id : null,
      autorNombre: nombreActor(actor),
      cuerpo: texto,
    })
    .returning();
  await db
    .update(tareas)
    .set({ actualizadoEn: new Date() })
    .where(eq(tareas.id, tareaId));
  return comentario;
}

export async function contarTareasAbiertas(db: Db, condicion: ReturnType<typeof eq>) {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tareas)
    .where(and(condicion, sql`${tareas.estado} <> 'hecho'`, sql`${tareas.archivadaEn} is null`));
  return fila?.total ?? 0;
}
