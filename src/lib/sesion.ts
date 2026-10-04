import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import type { Colaborador } from "./db/schema";
import type { Actor } from "./servicios/comun";
import { validarSesion } from "./servicios/cuentas";

export const COOKIE_SESION = "sg_sesion";

/** Usuario logueado (una sola consulta por request gracias a cache()). */
export const usuarioActual = cache(async (): Promise<Colaborador | null> => {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  return validarSesion(await getDb(), token);
});

export function actorDe(c: Colaborador): Actor {
  return { tipo: "colaborador", id: c.id, nombre: c.nombre, rol: c.rol };
}

export async function requerirUsuario() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");
  return { usuario, actor: actorDe(usuario) };
}

export async function requerirAdmin() {
  const r = await requerirUsuario();
  if (r.usuario.rol !== "admin") redirect("/");
  return r;
}

export async function guardarCookieSesion(token: string, expiraEn: Date) {
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEn,
  });
}

export async function borrarCookieSesion() {
  (await cookies()).delete(COOKIE_SESION);
}
