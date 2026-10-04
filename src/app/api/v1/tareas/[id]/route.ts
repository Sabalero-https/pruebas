import { NextResponse } from "next/server";
import { conApi, exigirUuid, interpretarCuerpoTarea, leerJson, tareaJson } from "@/lib/api";
import { NoEncontrado } from "@/lib/servicios/comun";
import { detalleTarea } from "@/lib/servicios/consultas";
import { actualizarTarea, archivarTarea } from "@/lib/servicios/tareas";

type P = { id: string };

export const GET = conApi<P>(async (req, { db, params }) => {
  const t = await detalleTarea(db, exigirUuid(params.id));
  if (!t) throw new NoEncontrado("La tarea no existe");
  return NextResponse.json({
    tarea: tareaJson(req, t),
    comentarios: t.comentarios.map((c) => ({ id: c.id, autor: c.autorNombre, cuerpo: c.cuerpo, creado_en: c.creadoEn })),
    historial: t.historial.map((h) => ({ actor: h.actor, campo: h.campo, antes: h.antes, despues: h.despues, creado_en: h.creadoEn })),
  });
});

/** PATCH: cambios parciales. Mandá "version" para que falle (409) si alguien la modificó desde que la leíste. */
export const PATCH = conApi<P>(async (req, { db, actor, params }) => {
  const id = exigirUuid(params.id);
  const { datos, version } = await interpretarCuerpoTarea(db, await leerJson(req), true);
  await actualizarTarea(db, id, datos, actor, { versionEsperada: version });
  return NextResponse.json({ tarea: tareaJson(req, (await detalleTarea(db, id))!) });
});

/** DELETE: archiva (no borra): se puede restaurar desde la app. */
export const DELETE = conApi<P>(async (req, { db, actor, params }) => {
  const id = exigirUuid(params.id);
  await archivarTarea(db, id, actor);
  return NextResponse.json({ tarea: tareaJson(req, (await detalleTarea(db, id))!) });
});
