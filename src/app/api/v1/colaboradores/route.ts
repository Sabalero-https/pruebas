import { NextResponse } from "next/server";
import { conApi } from "@/lib/api";
import { catalogos } from "@/lib/servicios/consultas";

export const GET = conApi(async (_req, { db }) => {
  const { colaboradores } = await catalogos(db);
  return NextResponse.json({
    colaboradores: colaboradores.filter((c) => c.activo).map((c) => ({ id: c.id, nombre: c.nombre, email: c.email })),
  });
});
