// Clientes y áreas.
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db";
import { areas, clientes, colaboradores, reglasRecurrentes, tareas, type EstadoCliente } from "../db/schema";
import { ErrorValidacion, limpiarNombre, normalizarTexto } from "../dominio";
import { type Actor, NoEncontrado, exigirAdmin, exigirTexto, slugUnico } from "./comun";

const REGEX_COLOR = /^#[0-9a-f]{6}$/i;

export const COLORES_CLIENTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#64748b"];

function validarColor(color: string | undefined): string | undefined {
  if (color === undefined || color === "") return undefined;
  if (!REGEX_COLOR.test(color)) throw new ErrorValidacion("Color inválido (usá formato #rrggbb)", "color_invalido");
  return color.toLowerCase();
}

async function validarResponsableCuenta(db: Db, id: string | null | undefined) {
  if (!id) return null;
  const [persona] = await db.select().from(colaboradores).where(eq(colaboradores.id, id));
  if (!persona || !persona.activo) throw new ErrorValidacion("El responsable de cuenta no está activo", "colaborador_inactivo");
  return persona.id;
}

// ------------------------------------------------------------- clientes

export async function crearCliente(
  db: Db,
  datos: { nombre: string; color?: string; responsableId?: string | null; esInterno?: boolean },
  actor: Actor,
) {
  exigirAdmin(actor);
  const nombre = limpiarNombre(exigirTexto(datos.nombre, "El nombre del cliente", 120));
  const nombreClave = normalizarTexto(nombre);
  const [duplicado] = await db.select().from(clientes).where(eq(clientes.nombreClave, nombreClave));
  if (duplicado) {
    throw new ErrorValidacion(
      duplicado.estado === "archivado"
        ? `Ya existe "${duplicado.nombre}" (archivado). Reactivalo en lugar de crear otro.`
        : `Ya existe el cliente "${duplicado.nombre}"`,
      "duplicado",
    );
  }
  const [cantidad] = await db.select({ n: sql<number>`count(*)::int` }).from(clientes);
  const [cliente] = await db
    .insert(clientes)
    .values({
      nombre,
      nombreClave,
      slug: await slugUnico(db, "clientes", nombre),
      color: validarColor(datos.color) ?? COLORES_CLIENTE[(cantidad?.n ?? 0) % COLORES_CLIENTE.length],
      esInterno: datos.esInterno ?? false,
      responsableId: await validarResponsableCuenta(db, datos.responsableId),
    })
    .returning();
  return cliente;
}

export async function editarCliente(
  db: Db,
  id: string,
  datos: { nombre?: string; color?: string; responsableId?: string | null },
  actor: Actor,
) {
  exigirAdmin(actor);
  const cambios: Partial<typeof clientes.$inferInsert> = {};
  if (datos.nombre !== undefined) {
    const nombre = limpiarNombre(exigirTexto(datos.nombre, "El nombre del cliente", 120));
    const nombreClave = normalizarTexto(nombre);
    const [otro] = await db
      .select()
      .from(clientes)
      .where(and(eq(clientes.nombreClave, nombreClave), ne(clientes.id, id)));
    if (otro) throw new ErrorValidacion(`Ya existe el cliente "${otro.nombre}"`, "duplicado");
    // El slug no cambia al renombrar: así no se rompen links compartidos ni integraciones.
    cambios.nombre = nombre;
    cambios.nombreClave = nombreClave;
  }
  const color = validarColor(datos.color);
  if (color) cambios.color = color;
  if (datos.responsableId !== undefined) cambios.responsableId = await validarResponsableCuenta(db, datos.responsableId);
  const [cliente] = await db.update(clientes).set(cambios).where(eq(clientes.id, id)).returning();
  if (!cliente) throw new NoEncontrado("El cliente no existe");
  return cliente;
}

/**
 * - Archivar exige que no queden tareas abiertas (si no, desaparecerían de los paneles sin cerrarse)
 *   y apaga sus tareas recurrentes.
 * - Pausar mantiene todo visible pero las recurrentes dejan de generar tareas.
 */
export async function cambiarEstadoCliente(db: Db, id: string, estado: EstadoCliente, actor: Actor) {
  exigirAdmin(actor);
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
  if (!cliente) throw new NoEncontrado("El cliente no existe");
  if (cliente.estado === estado) return cliente;
  if (estado === "archivado") {
    if (cliente.esInterno) throw new ErrorValidacion("El cliente interno no se puede archivar", "cliente_interno");
    const [abiertas] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tareas)
      .where(and(eq(tareas.clienteId, id), ne(tareas.estado, "hecho"), isNull(tareas.archivadaEn)));
    if ((abiertas?.n ?? 0) > 0) {
      throw new ErrorValidacion(
        `${cliente.nombre} tiene ${abiertas.n} tarea(s) abierta(s). Cerralas, archivalas o movelas a otro cliente antes de archivarlo.`,
        "tiene_tareas_abiertas",
        { abiertas: abiertas.n },
      );
    }
    await db.update(reglasRecurrentes).set({ activa: false }).where(eq(reglasRecurrentes.clienteId, id));
  }
  const [actualizado] = await db.update(clientes).set({ estado }).where(eq(clientes.id, id)).returning();
  return actualizado;
}

// ------------------------------------------------------------- áreas

export async function crearArea(db: Db, nombreCrudo: string, actor: Actor) {
  exigirAdmin(actor);
  const nombre = limpiarNombre(exigirTexto(nombreCrudo, "El nombre del área", 80));
  const nombreClave = normalizarTexto(nombre);
  const [duplicada] = await db.select().from(areas).where(eq(areas.nombreClave, nombreClave));
  if (duplicada) {
    throw new ErrorValidacion(
      duplicada.activa ? `Ya existe el área "${duplicada.nombre}"` : `El área "${duplicada.nombre}" existe pero está desactivada`,
      "duplicado",
    );
  }
  const [maximo] = await db.select({ n: sql<number>`coalesce(max(${areas.orden}), 0)::int` }).from(areas);
  const [area] = await db
    .insert(areas)
    .values({ nombre, nombreClave, slug: await slugUnico(db, "areas", nombre), orden: (maximo?.n ?? 0) + 10 })
    .returning();
  return area;
}

export async function editarArea(db: Db, id: string, datos: { nombre?: string; orden?: number; activa?: boolean }, actor: Actor) {
  exigirAdmin(actor);
  const cambios: Partial<typeof areas.$inferInsert> = {};
  if (datos.nombre !== undefined) {
    const nombre = limpiarNombre(exigirTexto(datos.nombre, "El nombre del área", 80));
    const nombreClave = normalizarTexto(nombre);
    const [otra] = await db
      .select()
      .from(areas)
      .where(and(eq(areas.nombreClave, nombreClave), ne(areas.id, id)));
    if (otra) throw new ErrorValidacion(`Ya existe el área "${otra.nombre}"`, "duplicado");
    cambios.nombre = nombre;
    cambios.nombreClave = nombreClave;
  }
  if (datos.orden !== undefined && Number.isFinite(datos.orden)) cambios.orden = Math.round(datos.orden);
  if (datos.activa !== undefined) cambios.activa = datos.activa;
  const [area] = await db.update(areas).set(cambios).where(eq(areas.id, id)).returning();
  if (!area) throw new NoEncontrado("El área no existe");
  return area;
}

/** Solo se puede borrar un área que nunca se usó. Si tiene tareas, se desactiva (las tareas la conservan). */
export async function eliminarArea(db: Db, id: string, actor: Actor) {
  exigirAdmin(actor);
  const [uso] = await db
    .select({
      tareas: sql<number>`(select count(*)::int from ${tareas} where ${tareas.areaId} = ${id})`,
      reglas: sql<number>`(select count(*)::int from ${reglasRecurrentes} where ${reglasRecurrentes.areaId} = ${id})`,
    })
    .from(sql`(select 1) as x`);
  if ((uso?.tareas ?? 0) > 0 || (uso?.reglas ?? 0) > 0) {
    throw new ErrorValidacion(
      `El área tiene ${uso.tareas} tarea(s) y ${uso.reglas} recurrente(s). Desactivala en lugar de borrarla.`,
      "en_uso",
    );
  }
  await db.delete(areas).where(eq(areas.id, id));
}
