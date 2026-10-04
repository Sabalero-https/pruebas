import { NextResponse } from "next/server";
import { conApi } from "@/lib/api";
import { catalogos } from "@/lib/servicios/consultas";

export const GET = conApi(async (req, { db }) => {
  const incluirArchivados = new URL(req.url).searchParams.get("incluir_archivados") === "true";
  const { clientes } = await catalogos(db);
  return NextResponse.json({
    clientes: clientes
      .filter((c) => incluirArchivados || c.estado !== "archivado")
      .map((c) => ({ id: c.id, nombre: c.nombre, slug: c.slug, estado: c.estado, es_interno: c.esInterno })),
  });
});
