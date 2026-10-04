// Tareas recurrentes: reglas que generan tareas reales en las fechas que corresponden.
import { and, asc, eq, lte } from "drizzle-orm";
import type { Db } from "../db";
import { areas, clientes, colaboradores, reglasRecurrentes, type Frecuencia, type Prioridad } from "../db/schema";
import {
  ErrorValidacion,
  hoy as hoyEnZona,
  proximaOcurrencia,
  sumarDias,
  ultimaOcurrencia,
  validarFrecuencia,
} from "../dominio";
import { type Actor, NoEncontrado, SISTEMA, exigirAdmin, exigirTexto } from "./comun";
import { crearTarea } from "./tareas";

export type DatosRegla = {
  titulo: string;
  descripcion?: string | null;
  clienteId: string;
  areaId?: string | null;
  responsableId?: string | null;
  prioridad?: Prioridad;
  frecuencia: Frecuencia;
  diaSemana?: number | null;
  diaMes?: number | null;
  diasParaVencer?: number;
};

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/**
 * Permite títulos como "Reporte mensual {mes}" → "Reporte mensual octubre 2026",
 * para que cada tarea generada se distinga de la anterior.
 */
export function armarTitulo(plantilla: string, fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return plantilla
    .replaceAll("{fecha}", `${d}/${m}/${a}`)
    .replaceAll("{mes}", `${MESES_LARGOS[Number(m) - 1]} ${a}`)
    .replaceAll("{anio}", a);
}

async function validarDatos(db: Db, datos: DatosRegla) {
  const titulo = exigirTexto(datos.titulo, "El título", 300);
  validarFrecuencia(datos);
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, datos.clienteId));
  if (!cliente) throw new NoEncontrado("El cliente no existe");
  if (cliente.estado === "archivado") throw new ErrorValidacion("El cliente está archivado", "cliente_archivado");
  if (datos.areaId) {
    const [area] = await db.select().from(areas).where(eq(areas.id, datos.areaId));
    if (!area?.activa) throw new ErrorValidacion("El área no existe o está desactivada", "area_inactiva");
  }
  if (datos.responsableId) {
    const [persona] = await db.select().from(colaboradores).where(eq(colaboradores.id, datos.responsableId));
    if (!persona?.activo) throw new ErrorValidacion("El responsable no está activo", "colaborador_inactivo");
  }
  const diasParaVencer = Math.round(datos.diasParaVencer ?? 0);
  if (!(diasParaVencer >= 0 && diasParaVencer <= 60)) {
    throw new ErrorValidacion("Los días para vencer van de 0 a 60", "dias_invalidos");
  }
  return {
    titulo,
    descripcion: datos.descripcion?.trim() || null,
    clienteId: datos.clienteId,
    areaId: datos.areaId || null,
    responsableId: datos.responsableId || null,
    prioridad: datos.prioridad ?? "normal",
    frecuencia: datos.frecuencia,
    diaSemana: datos.frecuencia === "semanal" ? datos.diaSemana! : null,
    diaMes: datos.frecuencia === "mensual" ? datos.diaMes! : null,
    diasParaVencer,
  };
}

export async function crearRegla(db: Db, datos: DatosRegla, actor: Actor, fechaHoy = hoyEnZona()) {
  exigirAdmin(actor);
  const valores = await validarDatos(db, datos);
  const [regla] = await db
    .insert(reglasRecurrentes)
    .values({ ...valores, proximaEn: proximaOcurrencia(valores, fechaHoy) })
    .returning();
  return regla;
}

export async function editarRegla(db: Db, id: string, datos: DatosRegla, actor: Actor, fechaHoy = hoyEnZona()) {
  exigirAdmin(actor);
  const [actual] = await db.select().from(reglasRecurrentes).where(eq(reglasRecurrentes.id, id));
  if (!actual) throw new NoEncontrado("La regla no existe");
  const valores = await validarDatos(db, datos);
  const cambioFrecuencia =
    actual.frecuencia !== valores.frecuencia || actual.diaSemana !== valores.diaSemana || actual.diaMes !== valores.diaMes;
  const [regla] = await db
    .update(reglasRecurrentes)
    .set({ ...valores, ...(cambioFrecuencia ? { proximaEn: proximaOcurrencia(valores, fechaHoy) } : {}) })
    .where(eq(reglasRecurrentes.id, id))
    .returning();
  return regla;
}

export async function cambiarActivaRegla(db: Db, id: string, activa: boolean, actor: Actor, fechaHoy = hoyEnZona()) {
  exigirAdmin(actor);
  const [regla] = await db.select().from(reglasRecurrentes).where(eq(reglasRecurrentes.id, id));
  if (!regla) throw new NoEncontrado("La regla no existe");
  if (activa) {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.id, regla.clienteId));
    if (cliente?.estado === "archivado") throw new ErrorValidacion("El cliente está archivado", "cliente_archivado");
  }
  // Al reactivar se recalcula la próxima fecha desde hoy: no se generan de golpe las semanas en que estuvo pausada.
  const [actualizada] = await db
    .update(reglasRecurrentes)
    .set({ activa, ...(activa ? { proximaEn: proximaOcurrencia(regla, fechaHoy) } : {}) })
    .where(eq(reglasRecurrentes.id, id))
    .returning();
  return actualizada;
}

export async function eliminarRegla(db: Db, id: string, actor: Actor) {
  exigirAdmin(actor);
  // Las tareas ya generadas se conservan (regla_id queda en null).
  await db.delete(reglasRecurrentes).where(eq(reglasRecurrentes.id, id));
}

/**
 * Genera las tareas que tocan hasta hoy. Es idempotente: se puede llamar muchas veces
 * (cron, carga de página, dos servidores a la vez) y nunca duplica.
 * Si el proceso estuvo apagado varios días, genera solo la ocurrencia más reciente
 * (no 5 "Daily Forecast" de golpe).
 */
export async function generarRecurrentes(db: Db, fechaHoy = hoyEnZona()) {
  const pendientes = await db
    .select({ regla: reglasRecurrentes, cliente: clientes })
    .from(reglasRecurrentes)
    .innerJoin(clientes, eq(clientes.id, reglasRecurrentes.clienteId))
    .where(and(eq(reglasRecurrentes.activa, true), lte(reglasRecurrentes.proximaEn, fechaHoy)))
    .orderBy(asc(reglasRecurrentes.proximaEn));

  let creadas = 0;
  let omitidas = 0;
  for (const { regla, cliente } of pendientes) {
    if (cliente.estado === "archivado") {
      await db.update(reglasRecurrentes).set({ activa: false }).where(eq(reglasRecurrentes.id, regla.id));
      omitidas++;
      continue;
    }
    const ocurrencia = ultimaOcurrencia(regla, fechaHoy);
    const siguiente = proximaOcurrencia(regla, sumarDias(fechaHoy, 1));

    if (cliente.estado === "activo" && ocurrencia >= regla.proximaEn) {
      // Si el responsable o el área se desactivaron, la tarea igual se crea (sin asignar / sin área) para que no se pierda.
      const [responsable] = regla.responsableId
        ? await db.select().from(colaboradores).where(eq(colaboradores.id, regla.responsableId))
        : [];
      const [area] = regla.areaId ? await db.select().from(areas).where(eq(areas.id, regla.areaId)) : [];
      const { creada } = await crearTarea(
        db,
        {
          titulo: armarTitulo(regla.titulo, ocurrencia),
          descripcion: regla.descripcion,
          clienteId: regla.clienteId,
          areaId: area?.activa ? area.id : null,
          responsableId: responsable?.activo ? responsable.id : null,
          prioridad: regla.prioridad,
          venceEl: sumarDias(ocurrencia, regla.diasParaVencer),
          origen: "recurrente",
          reglaId: regla.id,
          fechaProgramada: ocurrencia,
          claveExterna: `regla:${regla.id}:${ocurrencia}`,
        },
        SISTEMA,
      );
      if (creada) creadas++;
      else omitidas++;
    } else {
      omitidas++;
    }
    // Solo avanza si nadie la avanzó antes (dos ejecuciones simultáneas).
    await db
      .update(reglasRecurrentes)
      .set({ proximaEn: siguiente })
      .where(and(eq(reglasRecurrentes.id, regla.id), eq(reglasRecurrentes.proximaEn, regla.proximaEn)));
  }
  return { creadas, omitidas };
}

let ultimaEjecucion = 0;

/** Llamada barata desde las páginas: corre como máximo una vez cada 10 minutos por proceso. */
export async function generarRecurrentesSiCorresponde(db: Db) {
  if (Date.now() - ultimaEjecucion < 10 * 60_000) return;
  ultimaEjecucion = Date.now();
  try {
    await generarRecurrentes(db);
  } catch (error) {
    ultimaEjecucion = 0;
    console.error("Error generando tareas recurrentes", error);
  }
}
