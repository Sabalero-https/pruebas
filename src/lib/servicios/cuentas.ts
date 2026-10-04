// Colaboradores, sesiones, invitaciones y tokens de API.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db";
import {
  actividad,
  clientes,
  colaboradores,
  reglasRecurrentes,
  sesiones,
  tareas,
  tokensApi,
  type Colaborador,
  type Rol,
} from "../db/schema";
import { ErrorValidacion, normalizarEmail } from "../dominio";
import { type Actor, NoEncontrado, exigirAdmin, exigirTexto, nombreActor } from "./comun";
import { crearArea, crearCliente } from "./catalogo";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const DURACION_SESION_MS = 30 * 24 * 3600 * 1000;
const DURACION_INVITACION_MS = 7 * 24 * 3600 * 1000;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenAleatorio(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

// ------------------------------------------------------------- contraseñas

export function validarPassword(password: string): void {
  if (typeof password !== "string" || password.length < 8) {
    throw new ErrorValidacion("La contraseña debe tener al menos 8 caracteres", "password_debil");
  }
  if (password.length > 200) throw new ErrorValidacion("La contraseña es demasiado larga", "password_debil");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verificarPassword(password: string, guardado: string | null): Promise<boolean> {
  if (!guardado) return false;
  const [algoritmo, salt, hash] = guardado.split("$");
  if (algoritmo !== "scrypt" || !salt || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const calculado = await scrypt(password, Buffer.from(salt, "base64"), esperado.length);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

// ------------------------------------------------------------- configuración inicial

export async function hayColaboradores(db: Db): Promise<boolean> {
  const [fila] = await db.select({ n: sql<number>`count(*)::int` }).from(colaboradores);
  return (fila?.n ?? 0) > 0;
}

export const AREAS_INICIALES = [
  "Pauta",
  "Email/Automatizaciones",
  "Desarrollo/Conexiones",
  "Entregables/Reportes",
  "Planificación",
  "Producción Creativa",
  "Estrategia-Ops",
  "Finanzas",
  "Prospección/Nuevos clientes",
];

/** Crea el primer admin, el cliente interno y las áreas. Solo funciona con la base vacía. */
export async function configuracionInicial(
  db: Db,
  datos: { nombre: string; email: string; password: string; nombreInterno?: string },
) {
  return db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    // Bloqueo para que dos pestañas haciendo el setup a la vez no creen dos admins.
    await tx.execute(sql`lock table colaboradores in exclusive mode`);
    if (await hayColaboradores(t)) {
      throw new ErrorValidacion("La app ya está configurada", "ya_configurada");
    }
    const nombre = exigirTexto(datos.nombre, "El nombre", 120);
    const email = normalizarEmail(datos.email);
    if (!REGEX_EMAIL.test(email)) throw new ErrorValidacion("Email inválido", "email_invalido");
    validarPassword(datos.password);
    const [admin] = await tx
      .insert(colaboradores)
      .values({ nombre, email, rol: "admin", passwordHash: await hashPassword(datos.password) })
      .returning();
    const sistema: Actor = { tipo: "sistema", nombre: "Sistema" };
    await crearCliente(t, { nombre: datos.nombreInterno || "Sumo Growth (interno)", esInterno: true, color: "#0f172a" }, sistema);
    for (const area of AREAS_INICIALES) await crearArea(t, area, sistema);
    return admin;
  });
}

// ------------------------------------------------------------- sesiones

export async function crearSesion(db: Db, colaboradorId: string) {
  const token = tokenAleatorio();
  const expiraEn = new Date(Date.now() + DURACION_SESION_MS);
  await db.insert(sesiones).values({ id: hashToken(token), colaboradorId, expiraEn });
  // Limpieza oportunista de sesiones vencidas.
  await db.delete(sesiones).where(sql`${sesiones.expiraEn} < now()`);
  return { token, expiraEn };
}

export async function validarSesion(db: Db, token: string | undefined): Promise<Colaborador | null> {
  if (!token) return null;
  const [fila] = await db
    .select({ colaborador: colaboradores })
    .from(sesiones)
    .innerJoin(colaboradores, eq(colaboradores.id, sesiones.colaboradorId))
    .where(and(eq(sesiones.id, hashToken(token)), gt(sesiones.expiraEn, new Date())));
  // Un colaborador desactivado pierde el acceso aunque tenga la cookie.
  if (!fila || !fila.colaborador.activo) return null;
  return fila.colaborador;
}

export async function cerrarSesion(db: Db, token: string | undefined) {
  if (token) await db.delete(sesiones).where(eq(sesiones.id, hashToken(token)));
}

// Freno simple a la fuerza bruta (en memoria del proceso).
const intentos = new Map<string, { fallos: number; bloqueadoHasta: number }>();

export async function iniciarSesion(db: Db, emailCrudo: string, password: string) {
  const email = normalizarEmail(emailCrudo || "");
  const registro = intentos.get(email);
  if (registro && registro.bloqueadoHasta > Date.now()) {
    throw new ErrorValidacion("Demasiados intentos. Esperá unos minutos.", "bloqueado");
  }
  const [persona] = await db.select().from(colaboradores).where(eq(colaboradores.email, email));
  const ok = persona ? await verificarPassword(password || "", persona.passwordHash) : false;
  if (!persona || !ok || !persona.activo) {
    const fallos = (registro?.fallos ?? 0) + 1;
    intentos.set(email, { fallos, bloqueadoHasta: fallos >= 5 ? Date.now() + 5 * 60_000 : 0 });
    if (persona && ok && !persona.activo) throw new ErrorValidacion("Tu usuario está desactivado", "inactivo");
    throw new ErrorValidacion("Email o contraseña incorrectos", "credenciales");
  }
  intentos.delete(email);
  return { colaborador: persona, ...(await crearSesion(db, persona.id)) };
}

// ------------------------------------------------------------- invitaciones

export async function generarInvitacion(db: Db, colaboradorId: string, actor: Actor) {
  exigirAdmin(actor);
  const [persona] = await db.select().from(colaboradores).where(eq(colaboradores.id, colaboradorId));
  if (!persona) throw new NoEncontrado("El colaborador no existe");
  if (!persona.activo) throw new ErrorValidacion("Reactivá al colaborador antes de generar un link", "colaborador_inactivo");
  const token = tokenAleatorio();
  await db
    .update(colaboradores)
    .set({ invitacionHash: hashToken(token), invitacionExpira: new Date(Date.now() + DURACION_INVITACION_MS) })
    .where(eq(colaboradores.id, colaboradorId));
  return token;
}

export async function buscarInvitacion(db: Db, token: string) {
  if (!token) return null;
  const [persona] = await db
    .select()
    .from(colaboradores)
    .where(and(eq(colaboradores.invitacionHash, hashToken(token)), gt(colaboradores.invitacionExpira, new Date())));
  if (!persona || !persona.activo) return null;
  return persona;
}

/** Sirve tanto para la primera contraseña como para recuperarla. Cierra las sesiones anteriores. */
export async function aceptarInvitacion(db: Db, token: string, password: string) {
  const persona = await buscarInvitacion(db, token);
  if (!persona) throw new ErrorValidacion("El link no es válido o ya venció. Pedile uno nuevo a un admin.", "invitacion_invalida");
  validarPassword(password);
  await db
    .update(colaboradores)
    .set({ passwordHash: await hashPassword(password), invitacionHash: null, invitacionExpira: null })
    .where(eq(colaboradores.id, persona.id));
  await db.delete(sesiones).where(eq(sesiones.colaboradorId, persona.id));
  return { colaborador: persona, ...(await crearSesion(db, persona.id)) };
}

// ------------------------------------------------------------- ABM colaboradores

export async function crearColaborador(db: Db, datos: { nombre: string; email: string; rol?: Rol }, actor: Actor) {
  exigirAdmin(actor);
  const nombre = exigirTexto(datos.nombre, "El nombre", 120);
  const email = normalizarEmail(datos.email || "");
  if (!REGEX_EMAIL.test(email)) throw new ErrorValidacion("Email inválido", "email_invalido");
  const [existente] = await db.select().from(colaboradores).where(eq(colaboradores.email, email));
  if (existente) {
    throw new ErrorValidacion(
      existente.activo ? `Ya existe ${existente.nombre} con ese email` : `${existente.nombre} ya existe pero está desactivado: reactivalo`,
      "duplicado",
    );
  }
  const [persona] = await db.insert(colaboradores).values({ nombre, email, rol: datos.rol ?? "miembro" }).returning();
  const token = await generarInvitacion(db, persona.id, actor);
  return { colaborador: persona, token };
}

export async function editarColaborador(db: Db, id: string, datos: { nombre?: string; email?: string }, actor: Actor) {
  exigirAdmin(actor);
  const cambios: Partial<Colaborador> = {};
  if (datos.nombre !== undefined) cambios.nombre = exigirTexto(datos.nombre, "El nombre", 120);
  if (datos.email !== undefined) {
    const email = normalizarEmail(datos.email);
    if (!REGEX_EMAIL.test(email)) throw new ErrorValidacion("Email inválido", "email_invalido");
    const [otro] = await db
      .select()
      .from(colaboradores)
      .where(and(eq(colaboradores.email, email), ne(colaboradores.id, id)));
    if (otro) throw new ErrorValidacion(`Ese email ya lo usa ${otro.nombre}`, "duplicado");
    cambios.email = email;
  }
  const [persona] = await db.update(colaboradores).set(cambios).where(eq(colaboradores.id, id)).returning();
  if (!persona) throw new NoEncontrado("El colaborador no existe");
  return persona;
}

async function contarAdminsActivos(db: Db) {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(colaboradores)
    .where(and(eq(colaboradores.rol, "admin"), eq(colaboradores.activo, true)));
  return fila?.n ?? 0;
}

export async function cambiarRol(db: Db, id: string, rol: Rol, actor: Actor) {
  exigirAdmin(actor);
  const [persona] = await db.select().from(colaboradores).where(eq(colaboradores.id, id));
  if (!persona) throw new NoEncontrado("El colaborador no existe");
  if (persona.rol === rol) return persona;
  if (persona.rol === "admin" && persona.activo && (await contarAdminsActivos(db)) <= 1) {
    throw new ErrorValidacion("Tiene que quedar al menos un admin activo", "ultimo_admin");
  }
  const [actualizado] = await db.update(colaboradores).set({ rol }).where(eq(colaboradores.id, id)).returning();
  return actualizado;
}

/**
 * Desactiva a un colaborador sin dejar tareas "colgadas" de alguien que ya no está:
 * sus tareas abiertas, reglas recurrentes y cuentas de clientes pasan a `reasignarA` (o quedan sin asignar).
 */
export async function desactivarColaborador(db: Db, id: string, reasignarA: string | null, actor: Actor) {
  exigirAdmin(actor);
  if (actor.tipo === "colaborador" && actor.id === id) {
    throw new ErrorValidacion("No podés desactivarte a vos mismo", "auto_desactivacion");
  }
  const [persona] = await db.select().from(colaboradores).where(eq(colaboradores.id, id));
  if (!persona) throw new NoEncontrado("El colaborador no existe");
  if (!persona.activo) return { colaborador: persona, reasignadas: 0 };
  if (persona.rol === "admin" && (await contarAdminsActivos(db)) <= 1) {
    throw new ErrorValidacion("Tiene que quedar al menos un admin activo", "ultimo_admin");
  }
  let destino: Colaborador | null = null;
  if (reasignarA) {
    if (reasignarA === id) throw new ErrorValidacion("Elegí a otra persona para reasignar", "reasignacion_invalida");
    [destino] = await db.select().from(colaboradores).where(eq(colaboradores.id, reasignarA));
    if (!destino || !destino.activo) throw new ErrorValidacion("La persona elegida no está activa", "reasignacion_invalida");
  }

  return db.transaction(async (tx) => {
    const afectadas = await tx
      .update(tareas)
      .set({ responsableId: destino?.id ?? null, actualizadoEn: new Date(), version: sql`${tareas.version} + 1` })
      .where(and(eq(tareas.responsableId, id), ne(tareas.estado, "hecho"), isNull(tareas.archivadaEn)))
      .returning({ id: tareas.id });
    if (afectadas.length) {
      await tx.insert(actividad).values(
        afectadas.map((t) => ({
          tareaId: t.id,
          actor: nombreActor(actor),
          campo: "responsable",
          antes: persona.nombre,
          despues: destino?.nombre ?? null,
        })),
      );
    }
    await tx
      .update(reglasRecurrentes)
      .set({ responsableId: destino?.id ?? null })
      .where(eq(reglasRecurrentes.responsableId, id));
    await tx
      .update(clientes)
      .set({ responsableId: destino?.id ?? null })
      .where(eq(clientes.responsableId, id));
    await tx.delete(sesiones).where(eq(sesiones.colaboradorId, id));
    const [actualizado] = await tx
      .update(colaboradores)
      .set({ activo: false, invitacionHash: null, invitacionExpira: null })
      .where(eq(colaboradores.id, id))
      .returning();
    return { colaborador: actualizado, reasignadas: afectadas.length };
  });
}

export async function reactivarColaborador(db: Db, id: string, actor: Actor) {
  exigirAdmin(actor);
  const [persona] = await db.update(colaboradores).set({ activo: true }).where(eq(colaboradores.id, id)).returning();
  if (!persona) throw new NoEncontrado("El colaborador no existe");
  return persona;
}

// ------------------------------------------------------------- tokens de API

export async function crearTokenApi(db: Db, nombreCrudo: string, actor: Actor) {
  exigirAdmin(actor);
  const nombre = exigirTexto(nombreCrudo, "El nombre del token", 120);
  const token = `sg_${tokenAleatorio(24)}`;
  const [fila] = await db
    .insert(tokensApi)
    .values({ nombre, hash: hashToken(token), prefijo: token.slice(0, 7) })
    .returning();
  return { token, fila };
}

export async function revocarTokenApi(db: Db, id: string, actor: Actor) {
  exigirAdmin(actor);
  await db.update(tokensApi).set({ activo: false }).where(eq(tokensApi.id, id));
}

export async function autenticarTokenApi(db: Db, cabecera: string | null): Promise<Actor | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(cabecera?.trim() ?? "");
  if (!match) return null;
  const [fila] = await db
    .select()
    .from(tokensApi)
    .where(and(eq(tokensApi.hash, hashToken(match[1])), eq(tokensApi.activo, true)));
  if (!fila) return null;
  if (!fila.ultimoUso || Date.now() - fila.ultimoUso.getTime() > 60_000) {
    await db.update(tokensApi).set({ ultimoUso: new Date() }).where(eq(tokensApi.id, fila.id));
  }
  return { tipo: "api", id: fila.id, nombre: fila.nombre };
}
