"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { estadoCliente, estadoTarea, frecuencia, prioridad, rolUsuario } from "@/lib/db/schema";
import { ErrorValidacion } from "@/lib/dominio";
import { borrarCookieSesion, guardarCookieSesion, requerirAdmin, requerirUsuario } from "@/lib/sesion";
import { COOKIE_SESION } from "@/lib/sesion";
import { cookies } from "next/headers";
import {
  aceptarInvitacion,
  cambiarRol,
  cerrarSesion,
  configuracionInicial,
  crearColaborador,
  crearSesion,
  crearTokenApi,
  desactivarColaborador,
  editarColaborador,
  generarInvitacion,
  iniciarSesion,
  reactivarColaborador,
  revocarTokenApi,
} from "@/lib/servicios/cuentas";
import {
  actualizarTarea,
  archivarTarea,
  comentar,
  crearTarea,
  restaurarTarea,
  type CambiosTarea,
} from "@/lib/servicios/tareas";
import {
  cambiarEstadoCliente,
  crearArea,
  crearCliente,
  editarArea,
  editarCliente,
  eliminarArea,
} from "@/lib/servicios/catalogo";
import {
  cambiarActivaRegla,
  crearRegla,
  editarRegla,
  eliminarRegla,
  generarRecurrentes,
} from "@/lib/servicios/recurrentes";

export type Resultado<T = unknown> = { ok: true; datos?: T; mensaje?: string } | { ok: false; error: string };

async function ejecutar<T>(fn: () => Promise<T>, mensaje?: string): Promise<Resultado<T>> {
  try {
    const datos = await fn();
    revalidatePath("/", "layout");
    return { ok: true, datos, mensaje };
  } catch (error) {
    unstable_rethrow(error); // deja pasar redirect()/notFound()
    if (error instanceof ErrorValidacion) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues.map((i) => i.message).join(". ") || "Datos inválidos" };
    }
    console.error(error);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo." };
  }
}

const texto = (fd: FormData, campo: string) => {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
};
const opcional = (fd: FormData, campo: string) => texto(fd, campo).trim() || null;

async function urlBase() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ================================================================ acceso

export async function accionSetup(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const r = await ejecutar(async () => {
    const db = await getDb();
    const admin = await configuracionInicial(db, {
      nombre: texto(fd, "nombre"),
      email: texto(fd, "email"),
      password: texto(fd, "password"),
      nombreInterno: opcional(fd, "interno") ?? undefined,
    });
    const { token, expiraEn } = await crearSesion(db, admin.id);
    await guardarCookieSesion(token, expiraEn);
  });
  if (r.ok) redirect("/");
  return r;
}

export async function accionLogin(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const r = await ejecutar(async () => {
    const { token, expiraEn } = await iniciarSesion(await getDb(), texto(fd, "email"), texto(fd, "password"));
    await guardarCookieSesion(token, expiraEn);
  });
  if (r.ok) redirect("/");
  return r;
}

export async function accionAceptarInvitacion(_: Resultado | null, fd: FormData): Promise<Resultado> {
  const r = await ejecutar(async () => {
    if (texto(fd, "password") !== texto(fd, "confirmacion")) {
      throw new ErrorValidacion("Las contraseñas no coinciden");
    }
    const { token, expiraEn } = await aceptarInvitacion(await getDb(), texto(fd, "token"), texto(fd, "password"));
    await guardarCookieSesion(token, expiraEn);
  });
  if (r.ok) redirect("/");
  return r;
}

export async function accionLogout() {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  await cerrarSesion(await getDb(), token);
  await borrarCookieSesion();
  redirect("/login");
}

// ================================================================ tareas

const uuidONulo = z.union([z.uuid(), z.literal(""), z.null()]).transform((v) => v || null);

const esquemaCambios = z
  .object({
    titulo: z.string(),
    descripcion: z.string().nullable(),
    clienteId: z.uuid({ message: "Elegí un cliente" }),
    areaId: uuidONulo,
    responsableId: uuidONulo,
    estado: z.enum(estadoTarea.enumValues),
    prioridad: z.enum(prioridad.enumValues),
    venceEl: z.string().nullable(),
    links: z.array(z.object({ titulo: z.string(), url: z.string() })),
    ordenKanban: z.number(),
  })
  .partial()
  .strict();

export async function accionCrearTarea(_: Resultado<string> | null, fd: FormData): Promise<Resultado<string>> {
  return ejecutar(async () => {
    const { actor } = await requerirUsuario();
    const datos = esquemaCambios.parse({
      titulo: texto(fd, "titulo"),
      descripcion: opcional(fd, "descripcion"),
      clienteId: texto(fd, "clienteId"),
      areaId: texto(fd, "areaId"),
      responsableId: texto(fd, "responsableId"),
      estado: opcional(fd, "estado") ?? undefined,
      prioridad: opcional(fd, "prioridad") ?? undefined,
      venceEl: opcional(fd, "venceEl"),
    });
    const { tarea } = await crearTarea(await getDb(), { ...datos, titulo: datos.titulo ?? "", clienteId: datos.clienteId! }, actor);
    return tarea.id;
  }, "Tarea creada");
}

/** Cambios puntuales desde listas, tablero y detalle (estado, responsable, fecha, etc.). */
export async function accionActualizarTarea(id: string, cambios: CambiosTarea): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirUsuario();
    await actualizarTarea(await getDb(), z.uuid().parse(id), esquemaCambios.parse(cambios), actor);
  });
}

/** Edición de título/descripción/links: falla si otra persona guardó antes (versión). */
export async function accionEditarTarea(_: Resultado | null, fd: FormData): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirUsuario();
    const links = texto(fd, "links")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((linea) => {
        const m = /^(.*?)\s*\|\s*(https?:\/\/\S+)$/.exec(linea);
        return m ? { titulo: m[1], url: m[2] } : { titulo: "", url: linea };
      });
    await actualizarTarea(
      await getDb(),
      z.uuid().parse(texto(fd, "id")),
      { titulo: texto(fd, "titulo"), descripcion: texto(fd, "descripcion"), links },
      actor,
      { versionEsperada: Number(texto(fd, "version")) },
    );
  }, "Cambios guardados");
}

export async function accionArchivarTarea(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirUsuario();
    await archivarTarea(await getDb(), z.uuid().parse(id), actor);
  }, "Tarea archivada");
}

export async function accionRestaurarTarea(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirUsuario();
    await restaurarTarea(await getDb(), z.uuid().parse(id), actor);
  }, "Tarea restaurada");
}

export async function accionComentar(_: Resultado | null, fd: FormData): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirUsuario();
    await comentar(await getDb(), z.uuid().parse(texto(fd, "tareaId")), texto(fd, "cuerpo"), actor);
  });
}

// ================================================================ administración

export async function accionCrearColaborador(_: Resultado<string> | null, fd: FormData): Promise<Resultado<string>> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    const { token } = await crearColaborador(
      await getDb(),
      { nombre: texto(fd, "nombre"), email: texto(fd, "email"), rol: z.enum(rolUsuario.enumValues).parse(texto(fd, "rol") || "miembro") },
      actor,
    );
    return `${await urlBase()}/invitacion/${token}`;
  }, "Colaborador creado. Compartile este link para que elija su contraseña:");
}

export async function accionGenerarLink(id: string): Promise<Resultado<string>> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    const token = await generarInvitacion(await getDb(), z.uuid().parse(id), actor);
    return `${await urlBase()}/invitacion/${token}`;
  }, "Link generado (vale 7 días y un solo uso):");
}

export async function accionEditarColaborador(_: Resultado | null, fd: FormData): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    const id = z.uuid().parse(texto(fd, "id"));
    const db = await getDb();
    await editarColaborador(db, id, { nombre: texto(fd, "nombre"), email: texto(fd, "email") }, actor);
    await cambiarRol(db, id, z.enum(rolUsuario.enumValues).parse(texto(fd, "rol")), actor);
  }, "Guardado");
}

export async function accionDesactivarColaborador(_: Resultado<number> | null, fd: FormData): Promise<Resultado<number>> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    const { reasignadas } = await desactivarColaborador(
      await getDb(),
      z.uuid().parse(texto(fd, "id")),
      opcional(fd, "reasignarA"),
      actor,
    );
    return reasignadas;
  }, "Colaborador desactivado");
}

export async function accionReactivarColaborador(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    await reactivarColaborador(await getDb(), z.uuid().parse(id), actor);
  });
}

export async function accionGuardarCliente(_: Resultado | null, fd: FormData): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    const db = await getDb();
    const datos = { nombre: texto(fd, "nombre"), color: texto(fd, "color"), responsableId: opcional(fd, "responsableId") };
    const id = opcional(fd, "id");
    if (id) await editarCliente(db, z.uuid().parse(id), datos, actor);
    else await crearCliente(db, datos, actor);
  }, "Cliente guardado");
}

export async function accionEstadoCliente(id: string, estado: string): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    await cambiarEstadoCliente(await getDb(), z.uuid().parse(id), z.enum(estadoCliente.enumValues).parse(estado), actor);
  });
}

export async function accionGuardarArea(_: Resultado | null, fd: FormData): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    const db = await getDb();
    const id = opcional(fd, "id");
    if (id) {
      await editarArea(db, z.uuid().parse(id), { nombre: texto(fd, "nombre"), orden: Number(texto(fd, "orden") || 0) }, actor);
    } else {
      await crearArea(db, texto(fd, "nombre"), actor);
    }
  }, "Área guardada");
}

export async function accionActivarArea(id: string, activa: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    await editarArea(await getDb(), z.uuid().parse(id), { activa }, actor);
  });
}

export async function accionEliminarArea(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    await eliminarArea(await getDb(), z.uuid().parse(id), actor);
  });
}

export async function accionCrearToken(_: Resultado<string> | null, fd: FormData): Promise<Resultado<string>> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    const { token } = await crearTokenApi(await getDb(), texto(fd, "nombre"), actor);
    return token;
  }, "Token creado. Copialo ahora: no se vuelve a mostrar.");
}

export async function accionRevocarToken(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    await revocarTokenApi(await getDb(), z.uuid().parse(id), actor);
  });
}

// ================================================================ recurrentes

export async function accionGuardarRegla(_: Resultado | null, fd: FormData): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    const db = await getDb();
    const datos = {
      titulo: texto(fd, "titulo"),
      descripcion: opcional(fd, "descripcion"),
      clienteId: z.uuid({ message: "Elegí un cliente" }).parse(texto(fd, "clienteId")),
      areaId: uuidONulo.parse(texto(fd, "areaId")),
      responsableId: uuidONulo.parse(texto(fd, "responsableId")),
      prioridad: z.enum(prioridad.enumValues).parse(texto(fd, "prioridad") || "normal"),
      frecuencia: z.enum(frecuencia.enumValues).parse(texto(fd, "frecuencia")),
      diaSemana: Number(texto(fd, "diaSemana")) || null,
      diaMes: Number(texto(fd, "diaMes")) || null,
      diasParaVencer: Number(texto(fd, "diasParaVencer") || 0),
    };
    const id = opcional(fd, "id");
    if (id) await editarRegla(db, z.uuid().parse(id), datos, actor);
    else await crearRegla(db, datos, actor);
  }, "Recurrente guardada");
}

export async function accionActivarRegla(id: string, activa: boolean): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    await cambiarActivaRegla(await getDb(), z.uuid().parse(id), activa, actor);
  });
}

export async function accionEliminarRegla(id: string): Promise<Resultado> {
  return ejecutar(async () => {
    const { actor } = await requerirAdmin();
    await eliminarRegla(await getDb(), z.uuid().parse(id), actor);
  });
}

export async function accionGenerarRecurrentes(): Promise<Resultado<{ creadas: number }>> {
  return ejecutar(async () => {
    await requerirAdmin();
    return generarRecurrentes(await getDb());
  });
}
