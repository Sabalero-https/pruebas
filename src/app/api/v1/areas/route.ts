import { NextResponse } from "next/server";
import { conApi } from "@/lib/api";
import { catalogos } from "@/lib/servicios/consultas";

export const GET = conApi(async (_req, { db }) => {
  const { areas } = await catalogos(db);
  return NextResponse.json({ areas: areas.map((a) => ({ id: a.id, nombre: a.nombre, slug: a.slug, activa: a.activa })) });
});
