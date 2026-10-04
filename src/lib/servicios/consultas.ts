// Consultas de lectura para los paneles. Todos los paneles son la misma tabla de tareas con distintos filtros.
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import {
  actividad,
  areas,
  clientes,
  colaboradores,
  comentarios,
  tareas,
  type EstadoTarea,
  type Prioridad,
} from "../db/schema";
import { finDeSemana, hoy as hoyEnZona, type Vencimiento } from "../dominio";

export type FiltrosTareas = {
  clienteIds?: string[];
  areaIds?: string[];
  /** ids de colaboradores; "sin" = sin responsable */
  responsables?: string[];
  estados?: EstadoTarea[];
  prioridades?: Prioridad[];
  vencimiento?: Vencimiento;
  venceDesde?: string;
  venceHasta?: string;
  busqueda?: string;
  claveExterna?: string;
  /** Por defecto solo tareas abiertas. */
  incluirHechas?: boolean;
  /** Incluye tareas hechas en los últimos N días (para el Kanban). */
  hechasUltimosDias?: number;
  soloArchivadas?: boolean;
  limite?: number;
  offset?: number;
  orden?: "vencimiento" | "prioridad" | "actualizacion" | "kanban";
  hoy?: string;
};

export const columnasTarea = {
  id: tareas.id,
  titulo: tareas.titulo,
  estado: tareas.estado,
  prioridad: tareas.prioridad,
  venceEl: tareas.venceEl,
  clienteId: tareas.clienteId,
  clienteNombre: clientes.nombre,
  clienteSlug: clientes.slug,
  clienteColor: clientes.color,
  clienteEstado: clientes.estado,
  areaId: tareas.areaId,
  areaNombre: areas.nombre,
  responsableId: tareas.responsableId,
  responsableNombre: colaboradores.nombre,
  responsableActivo: colaboradores.activo,
  ordenKanban: tareas.ordenKanban,
  origen: tareas.origen,
  claveExterna: tareas.claveExterna,
  version: tareas.version,
  links: tareas.links,
  creadoEn: tareas.creadoEn,
  actualizadoEn: tareas.actualizadoEn,
  completadaEn: tareas.completadaEn,
  archivadaEn: tareas.archivadaEn,
  cantidadComentarios: sql<number>`(select count(*)::int from ${comentarios} where ${comentarios.tareaId} = ${tareas.id})`,
};

export type FilaTarea = Awaited<ReturnType<typeof listarTareas>>[number];

const pesoPrioridad = sql`case ${tareas.prioridad} when 'urgente' then 0 when 'alta' then 1 when 'normal' then 2 else 3 end`;

export function condicionesTareas(f: FiltrosTareas): SQL[] {
  const hoy = f.hoy ?? hoyEnZona();
  const c: SQL[] = [];
  c.push(f.soloArchivadas ? sql`${tareas.archivadaEn} is not null` : isNull(tareas.archivadaEn));
  if (f.clienteIds?.length) c.push(inArray(tareas.clienteId, f.clienteIds));
  if (f.areaIds?.length) {
    const conArea = f.areaIds.filter((a) => a !== "sin");
    const partes: SQL[] = [];
    if (conArea.length) partes.push(inArray(tareas.areaId, conArea));
    if (f.areaIds.includes("sin")) partes.push(isNull(tareas.areaId));
    c.push(or(...partes)!);
  }
  if (f.responsables?.length) {
    const ids = f.responsables.filter((r) => r !== "sin");
    const partes: SQL[] = [];
    if (ids.length) partes.push(inArray(tareas.responsableId, ids));
    if (f.responsables.includes("sin")) partes.push(isNull(tareas.responsableId));
    c.push(or(...partes)!);
  }
  if (f.estados?.length) {
    c.push(inArray(tareas.estado, f.estados));
  } else if (f.hechasUltimosDias) {
    c.push(
      or(
        sql`${tareas.estado} <> 'hecho'`,
        gte(tareas.completadaEn, new Date(Date.now() - f.hechasUltimosDias * 86400000)),
      )!,
    );
  } else if (!f.incluirHechas) {
    c.push(sql`${tareas.estado} <> 'hecho'`);
  }
  if (f.prioridades?.length) c.push(inArray(tareas.prioridad, f.prioridades));
  if (f.venceDesde) c.push(gte(tareas.venceEl, f.venceDesde));
  if (f.venceHasta) c.push(lte(tareas.venceEl, f.venceHasta));
  switch (f.vencimiento) {
    case "vencida":
      c.push(lt(tareas.venceEl, hoy));
      break;
    case "hoy":
      c.push(eq(tareas.venceEl, hoy));
      break;
    case "semana":
      c.push(and(gte(tareas.venceEl, hoy), lte(tareas.venceEl, finDeSemana(hoy)))!);
      break;
    case "proxima":
      c.push(sql`${tareas.venceEl} > ${finDeSemana(hoy)}`);
      break;
    case "sin_fecha":
      c.push(isNull(tareas.venceEl));
      break;
  }
  if (f.busqueda?.trim()) {
    const patron = `%${f.busqueda.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    c.push(or(ilike(tareas.titulo, patron), ilike(tareas.descripcion, patron))!);
  }
  if (f.claveExterna) c.push(eq(tareas.claveExterna, f.claveExterna));
  return c;
}

export async function listarTareas(db: Db, f: FiltrosTareas = {}) {
  const orden =
    f.orden === "prioridad"
      ? [asc(pesoPrioridad), sql`${tareas.venceEl} asc nulls last`, asc(tareas.creadoEn)]
      : f.orden === "actualizacion"
        ? [desc(tareas.actualizadoEn)]
        : f.orden === "kanban"
          ? [asc(tareas.ordenKanban), asc(tareas.creadoEn)]
          : [sql`${tareas.venceEl} asc nulls last`, asc(pesoPrioridad), asc(tareas.creadoEn)];
  return db
    .select(columnasTarea)
    .from(tareas)
    .innerJoin(clientes, eq(clientes.id, tareas.clienteId))
    .leftJoin(areas, eq(areas.id, tareas.areaId))
    .leftJoin(colaboradores, eq(colaboradores.id, tareas.responsableId))
    .where(and(...condicionesTareas(f)))
    .orderBy(...orden)
    .limit(Math.min(f.limite ?? 500, 1000))
    .offset(f.offset ?? 0);
}

export async function detalleTarea(db: Db, id: string) {
  const [fila] = await db
    .select({ ...columnasTarea, descripcion: tareas.descripcion, creadoPor: tareas.creadoPor, reglaId: tareas.reglaId })
    .from(tareas)
    .innerJoin(clientes, eq(clientes.id, tareas.clienteId))
    .leftJoin(areas, eq(areas.id, tareas.areaId))
    .leftJoin(colaboradores, eq(colaboradores.id, tareas.responsableId))
    .where(eq(tareas.id, id));
  if (!fila) return null;
  const [listaComentarios, historial] = await Promise.all([
    db.select().from(comentarios).where(eq(comentarios.tareaId, id)).orderBy(asc(comentarios.creadoEn)),
    db.select().from(actividad).where(eq(actividad.tareaId, id)).orderBy(desc(actividad.id)).limit(100),
  ]);
  return { ...fila, comentarios: listaComentarios, historial };
}

// ------------------------------------------------------------- resúmenes

const abiertas = and(isNull(tareas.archivadaEn), sql`${tareas.estado} <> 'hecho'`);

export async function resumenGeneral(db: Db, fechaHoy = hoyEnZona()) {
  const [fila] = await db
    .select({
      abiertas: sql<number>`count(*)::int`,
      vencidas: sql<number>`count(*) filter (where ${tareas.venceEl} < ${fechaHoy})::int`,
      hoy: sql<number>`count(*) filter (where ${tareas.venceEl} = ${fechaHoy})::int`,
      sinAsignar: sql<number>`count(*) filter (where ${tareas.responsableId} is null)::int`,
      sinFecha: sql<number>`count(*) filter (where ${tareas.venceEl} is null)::int`,
      enRevision: sql<number>`count(*) filter (where ${tareas.estado} = 'en_revision')::int`,
      esperandoCliente: sql<number>`count(*) filter (where ${tareas.estado} = 'esperando_cliente')::int`,
    })
    .from(tareas)
    .where(abiertas);
  return fila;
}

export async function resumenPorColaborador(db: Db, fechaHoy = hoyEnZona()) {
  return db
    .select({
      responsableId: tareas.responsableId,
      abiertas: sql<number>`count(*)::int`,
      vencidas: sql<number>`count(*) filter (where ${tareas.venceEl} < ${fechaHoy})::int`,
      semana: sql<number>`count(*) filter (where ${tareas.venceEl} >= ${fechaHoy} and ${tareas.venceEl} <= ${finDeSemana(fechaHoy)})::int`,
      enRevision: sql<number>`count(*) filter (where ${tareas.estado} = 'en_revision')::int`,
      urgentes: sql<number>`count(*) filter (where ${tareas.prioridad} = 'urgente')::int`,
    })
    .from(tareas)
    .where(abiertas)
    .groupBy(tareas.responsableId);
}

export async function resumenPorCliente(db: Db, fechaHoy = hoyEnZona()) {
  return db
    .select({
      clienteId: tareas.clienteId,
      abiertas: sql<number>`count(*)::int`,
      vencidas: sql<number>`count(*) filter (where ${tareas.venceEl} < ${fechaHoy})::int`,
      enRevision: sql<number>`count(*) filter (where ${tareas.estado} = 'en_revision')::int`,
      esperandoCliente: sql<number>`count(*) filter (where ${tareas.estado} = 'esperando_cliente')::int`,
      sinAsignar: sql<number>`count(*) filter (where ${tareas.responsableId} is null)::int`,
      proximaEntrega: sql<string | null>`min(${tareas.venceEl}) filter (where ${tareas.venceEl} >= ${fechaHoy})`,
    })
    .from(tareas)
    .where(abiertas)
    .groupBy(tareas.clienteId);
}

// ------------------------------------------------------------- catálogos

export async function catalogos(db: Db) {
  const [listaClientes, listaAreas, listaColaboradores] = await Promise.all([
    db.select().from(clientes).orderBy(desc(clientes.esInterno), asc(clientes.nombre)),
    db.select().from(areas).orderBy(asc(areas.orden), asc(areas.nombre)),
    db
      .select({
        id: colaboradores.id,
        nombre: colaboradores.nombre,
        email: colaboradores.email,
        rol: colaboradores.rol,
        activo: colaboradores.activo,
        pendiente: sql<boolean>`${colaboradores.passwordHash} is null`,
      })
      .from(colaboradores)
      .orderBy(asc(colaboradores.nombre)),
  ]);
  return { clientes: listaClientes, areas: listaAreas, colaboradores: listaColaboradores };
}

export type Catalogos = Awaited<ReturnType<typeof catalogos>>;
