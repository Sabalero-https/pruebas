import { NextResponse } from "next/server";
import { conApi, exigirUuid, leerJson } from "@/lib/api";
import { ErrorValidacion } from "@/lib/dominio";
import { NoEncontrado } from "@/lib/servicios/comun";
import { detalleTarea } from "@/lib/servicios/consultas";
import { comentar } from "@/lib/servicios/tareas";

type P = { id: string };

export const GET = conApi<P>(async (_req, { db, params }) => {
  const t = await detalleTarea(db, exigirUuid(params.id));
  if (!t) throw new NoEncontrado("La tarea no existe");
  return NextResponse.json({
    comentarios: t.comentarios.map((c) => ({ id: c.id, autor: c.autorNombre, cuerpo: c.cuerpo, creado_en: c.creadoEn })),
  });
});

export const POST = conApi<P>(async (req, { db, actor, params }) => {
  const cuerpo = await leerJson(req);
  if (typeof cuerpo.cuerpo !== "string") throw new ErrorValidacion('Falta "cuerpo" (texto del comentario)', "campo_requerido");
  const c = await comentar(db, exigirUuid(params.id), cuerpo.cuerpo, actor);
  return NextResponse.json({ comentario: { id: c.id, autor: c.autorNombre, cuerpo: c.cuerpo, creado_en: c.creadoEn } }, { status: 201 });
});
