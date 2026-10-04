import { redirect } from "next/navigation";
import type { Params } from "@/lib/filtros-url";

// El tablero es la vista "Tablero" de Pendientes (mismos filtros, mismo link compartible).
export default async function Tablero({ searchParams }: { searchParams: Promise<Params> }) {
  const p = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  );
  p.set("vista", "tablero");
  redirect(`/pendientes?${p.toString()}`);
}
