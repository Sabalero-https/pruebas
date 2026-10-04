import { eq, inArray, or } from "drizzle-orm";
import type { Db } from "../db";
import { areas, clientes, colaboradores, type Rol } from "../db/schema";
import { ErrorValidacion, REGEX_UUID, normalizarEmail, normalizarTexto, slugificar } from "../dominio";

/** Quién hace un cambio. Queda registrado en el historial de cada tarea. */
export type Actor =
  | { tipo: "colaborador"; id: string; nombre: string; rol: Rol }
  | { tipo: "api"; id: string; nombre: string }
  | { tipo: "sistema"; nombre: string };

export const SISTEMA: Actor = { tipo: "sistema", nombre: "Sistema" };

export function nombreActor(actor: Actor): string {
  if (actor.tipo === "api") return `API · ${actor.nombre}`;
  return actor.nombre;
}

export function exigirAdmin(actor: Actor): void {
  if (actor.tipo === "colaborador" && actor.rol === "admin") return;
  if (actor.tipo === "sistema") return;
  throw new ErrorValidacion("Solo un admin puede hacer esto", "sin_permiso");
}

export class NoEncontrado extends ErrorValidacion {
  constructor(mensaje: string) {
    super(mensaje, "no_encontrado");
  }
}

// ------------------------------------------------------------- resolución por nombre
// La API y el importador reciben clientes/áreas/personas como id, slug, email o nombre.
// Resolver todo en un solo lugar evita que "Flex Sports", "flex-sports" y "flex sports" sean tres cosas distintas.

export async function resolverCliente(db: Db, ref: string) {
  const valor = ref.trim();
  if (!valor) throw new ErrorValidacion("Falta el cliente", "cliente_requerido");
  const condiciones = [eq(clientes.slug, slugificar(valor)), eq(clientes.nombreClave, normalizarTexto(valor))];
  if (REGEX_UUID.test(valor)) condiciones.push(eq(clientes.id, valor));
  const filas = await db.select().from(clientes).where(or(...condiciones));
  const porId = filas.find((c) => c.id === valor);
  if (porId) return porId;
  if (filas.length === 0) throw new NoEncontrado(`No existe el cliente "${ref}"`);
  if (filas.length > 1) {
    throw new ErrorValidacion(`"${ref}" coincide con más de un cliente`, "ambiguo", {
      candidatos: filas.map((c) => ({ id: c.id, nombre: c.nombre, slug: c.slug })),
    });
  }
  return filas[0];
}

export async function resolverArea(db: Db, ref: string) {
  const valor = ref.trim();
  if (!valor) throw new ErrorValidacion("Área vacía", "area_invalida");
  const condiciones = [eq(areas.slug, slugificar(valor)), eq(areas.nombreClave, normalizarTexto(valor))];
  if (REGEX_UUID.test(valor)) condiciones.push(eq(areas.id, valor));
  const filas = await db.select().from(areas).where(or(...condiciones));
  const porId = filas.find((a) => a.id === valor);
  if (porId) return porId;
  if (filas.length === 0) throw new NoEncontrado(`No existe el área "${ref}"`);
  if (filas.length > 1) {
    throw new ErrorValidacion(`"${ref}" coincide con más de un área`, "ambiguo", {
      candidatos: filas.map((a) => ({ id: a.id, nombre: a.nombre })),
    });
  }
  return filas[0];
}

export async function resolverColaborador(db: Db, ref: string) {
  const valor = ref.trim();
  if (!valor) throw new ErrorValidacion("Colaborador vacío", "colaborador_invalido");
  if (REGEX_UUID.test(valor)) {
    const [fila] = await db.select().from(colaboradores).where(eq(colaboradores.id, valor));
    if (fila) return fila;
  }
  if (valor.includes("@")) {
    const [fila] = await db.select().from(colaboradores).where(eq(colaboradores.email, normalizarEmail(valor)));
    if (fila) return fila;
    throw new NoEncontrado(`No existe un colaborador con el email "${ref}"`);
  }
  // Por nombre: coincide con el nombre completo o con el primer nombre, si no es ambiguo.
  const todos = await db.select().from(colaboradores);
  const buscado = normalizarTexto(valor);
  const exactos = todos.filter((c) => normalizarTexto(c.nombre) === buscado);
  const candidatos = exactos.length ? exactos : todos.filter((c) => normalizarTexto(c.nombre).split(" ")[0] === buscado);
  if (candidatos.length === 0) throw new NoEncontrado(`No existe el colaborador "${ref}"`);
  if (candidatos.length > 1) {
    throw new ErrorValidacion(`"${ref}" coincide con más de un colaborador`, "ambiguo", {
      candidatos: candidatos.map((c) => ({ id: c.id, nombre: c.nombre, email: c.email })),
    });
  }
  return candidatos[0];
}

/** Nombres visibles para el historial (si se borró algo, muestra "(eliminado)"). */
export async function nombresPorId(db: Db, tipo: "cliente" | "area" | "colaborador", ids: (string | null)[]) {
  const validos = ids.filter((x): x is string => !!x);
  const mapa = new Map<string, string>();
  if (!validos.length) return mapa;
  const tabla = tipo === "cliente" ? clientes : tipo === "area" ? areas : colaboradores;
  const filas = await db.select({ id: tabla.id, nombre: tabla.nombre }).from(tabla).where(inArray(tabla.id, validos));
  for (const f of filas) mapa.set(f.id, f.nombre);
  return mapa;
}

/** Genera un slug único agregando -2, -3... si ya existe. */
export async function slugUnico(db: Db, tabla: "clientes" | "areas", base: string, excluirId?: string) {
  const t = tabla === "clientes" ? clientes : areas;
  const raiz = slugificar(base);
  const existentes = await db.select({ id: t.id, slug: t.slug }).from(t);
  const usados = new Set(existentes.filter((e) => e.id !== excluirId).map((e) => e.slug));
  if (!usados.has(raiz)) return raiz;
  for (let i = 2; ; i++) if (!usados.has(`${raiz}-${i}`)) return `${raiz}-${i}`;
}

export function exigirTexto(valor: unknown, campo: string, max: number): string {
  if (typeof valor !== "string") throw new ErrorValidacion(`${campo} es obligatorio`, "campo_requerido");
  const limpio = valor.trim();
  if (!limpio) throw new ErrorValidacion(`${campo} es obligatorio`, "campo_requerido");
  if (limpio.length > max) throw new ErrorValidacion(`${campo} no puede superar ${max} caracteres`, "muy_largo");
  return limpio;
}
