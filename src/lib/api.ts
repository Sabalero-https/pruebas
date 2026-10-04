// Utilidades de la API REST v1 (la usan los agentes de IA e integraciones).
import { NextResponse } from "next/server";
import { getDb, type Db } from "./db";
import type { Link } from "./db/schema";
import {
  ErrorValidacion,
  exigirEstado,
  exigirPrioridad,
  interpretarFecha,
  REGEX_UUID,
} from "./dominio";
import { type Actor, NoEncontrado, resolverArea, resolverCliente, resolverColaborador } from "./servicios/comun";
import { autenticarTokenApi } from "./servicios/cuentas";
import type { FilaTarea } from "./servicios/consultas";
import type { CambiosTarea, DatosTarea } from "./servicios/tareas";

const ESTADO_HTTP: Record<string, number> = {
  no_encontrado: 404,
  ambiguo: 409,
  conflicto: 409,
  sin_permiso: 403,
  json_invalido: 400,
};

export function errorJson(status: number, codigo: string, mensaje: string, detalles?: unknown) {
  return NextResponse.json({ error: { codigo, mensaje, ...(detalles ? { detalles } : {}) } }, { status });
}

type Manejador<C> = (req: Request, ctx: { db: Db; actor: Actor; params: C }) => Promise<Response>;

/** Autentica con el token, ejecuta y traduce errores de negocio a respuestas HTTP claras. */
export function conApi<C = Record<string, never>>(fn: Manejador<C>) {
  return async (req: Request, contexto: { params?: Promise<C> }) => {
    try {
      const db = await getDb();
      const actor = await autenticarTokenApi(db, req.headers.get("authorization"));
      if (!actor) return errorJson(401, "no_autorizado", "Falta el token o no es válido (Authorization: Bearer sg_...)");
      const params = (contexto?.params ? await contexto.params : {}) as C;
      return await fn(req, { db, actor, params });
    } catch (error) {
      if (error instanceof ErrorValidacion) {
        return errorJson(ESTADO_HTTP[error.codigo] ?? 422, error.codigo, error.message, error.detalles);
      }
      console.error(error);
      return errorJson(500, "error_interno", "Error inesperado");
    }
  };
}

export async function leerJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const cuerpo = await req.json();
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) throw new Error();
    return cuerpo as Record<string, unknown>;
  } catch {
    throw new ErrorValidacion("El cuerpo tiene que ser un objeto JSON", "json_invalido");
  }
}

const CAMPOS_TAREA = new Set([
  "titulo",
  "descripcion",
  "cliente",
  "area",
  "responsable",
  "estado",
  "prioridad",
  "vence_el",
  "links",
  "clave_externa",
  "version",
]);

function textoONulo(valor: unknown, campo: string): string | null {
  if (valor === null) return null;
  if (typeof valor !== "string") throw new ErrorValidacion(`"${campo}" tiene que ser texto o null`);
  return valor;
}

/** Traduce el JSON de la API (nombres, alias de estado, fechas en varios formatos) a cambios del servicio. */
export async function interpretarCuerpoTarea(db: Db, cuerpo: Record<string, unknown>, parcial: boolean) {
  const desconocidos = Object.keys(cuerpo).filter((k) => !CAMPOS_TAREA.has(k));
  if (desconocidos.length) {
    throw new ErrorValidacion(`Campos desconocidos: ${desconocidos.join(", ")}`, "campos_desconocidos", {
      validos: [...CAMPOS_TAREA],
    });
  }
  const datos: CambiosTarea & { claveExterna?: string | null } = {};
  if ("titulo" in cuerpo) datos.titulo = textoONulo(cuerpo.titulo, "titulo") ?? "";
  if ("descripcion" in cuerpo) datos.descripcion = textoONulo(cuerpo.descripcion, "descripcion");
  if ("cliente" in cuerpo) {
    const ref = textoONulo(cuerpo.cliente, "cliente");
    if (!ref) throw new ErrorValidacion("Toda tarea tiene que tener un cliente", "cliente_requerido");
    datos.clienteId = (await resolverCliente(db, ref)).id;
  }
  if ("area" in cuerpo) {
    const ref = textoONulo(cuerpo.area, "area");
    datos.areaId = ref ? (await resolverArea(db, ref)).id : null;
  }
  if ("responsable" in cuerpo) {
    const ref = textoONulo(cuerpo.responsable, "responsable");
    datos.responsableId = ref ? (await resolverColaborador(db, ref)).id : null;
  }
  if ("estado" in cuerpo) datos.estado = exigirEstado(String(cuerpo.estado ?? ""));
  if ("prioridad" in cuerpo) datos.prioridad = exigirPrioridad(cuerpo.prioridad as string);
  if ("vence_el" in cuerpo) datos.venceEl = interpretarFecha(cuerpo.vence_el);
  if ("links" in cuerpo) datos.links = (cuerpo.links ?? []) as Link[];
  if ("clave_externa" in cuerpo) {
    if (parcial) throw new ErrorValidacion("La clave externa no se puede cambiar", "campo_inmutable");
    datos.claveExterna = textoONulo(cuerpo.clave_externa, "clave_externa");
  }
  if (!parcial && !datos.clienteId) throw new ErrorValidacion('Falta "cliente"', "cliente_requerido");
  if (!parcial && !datos.titulo) throw new ErrorValidacion('Falta "titulo"', "campo_requerido");
  let version: number | undefined;
  if ("version" in cuerpo) {
    if (!Number.isInteger(cuerpo.version)) throw new ErrorValidacion('"version" tiene que ser un número entero');
    version = cuerpo.version as number;
  }
  return { datos, version };
}

export function aDatosCreacion(d: CambiosTarea & { claveExterna?: string | null }): DatosTarea {
  return { ...d, titulo: d.titulo ?? "", clienteId: d.clienteId! };
}

export function urlApp(req: Request, ruta: string) {
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  return `${base}${ruta}`;
}

export function tareaJson(req: Request, t: FilaTarea & { descripcion?: string | null }) {
  return {
    id: t.id,
    titulo: t.titulo,
    descripcion: t.descripcion ?? undefined,
    estado: t.estado,
    prioridad: t.prioridad,
    vence_el: t.venceEl,
    cliente: { id: t.clienteId, nombre: t.clienteNombre, slug: t.clienteSlug },
    area: t.areaId ? { id: t.areaId, nombre: t.areaNombre } : null,
    responsable: t.responsableId ? { id: t.responsableId, nombre: t.responsableNombre, activo: t.responsableActivo } : null,
    links: t.links,
    origen: t.origen,
    clave_externa: t.claveExterna,
    version: t.version,
    comentarios: t.cantidadComentarios,
    archivada: !!t.archivadaEn,
    creado_en: t.creadoEn,
    actualizado_en: t.actualizadoEn,
    completada_en: t.completadaEn,
    url: urlApp(req, `/tareas/${t.id}`),
  };
}

export function exigirUuid(id: string) {
  if (!REGEX_UUID.test(id)) throw new NoEncontrado("La tarea no existe");
  return id;
}
