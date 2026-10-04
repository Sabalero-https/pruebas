"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ESTADOS, GRUPOS_VENCIMIENTO, PRIORIDADES } from "@/lib/dominio";
import type { CatalogoUI } from "./tipos";

/**
 * Filtros guardados en la URL: cualquier vista filtrada se comparte copiando el link.
 */
export function Filtros({
  catalogo,
  mostrar = ["cliente", "area", "responsable", "estado", "prioridad", "vencimiento", "agrupar", "busqueda"],
  agrupaciones = ["vencimiento", "cliente", "responsable", "estado", "area", "ninguno"],
}: {
  catalogo: CatalogoUI;
  mostrar?: string[];
  agrupaciones?: string[];
}) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [cargando, iniciar] = useTransition();
  const [busqueda, setBusqueda] = useState(params.get("q") ?? "");

  const poner = (clave: string, valor: string) => {
    const p = new URLSearchParams(params.toString());
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    iniciar(() => router.replace(`${ruta}?${p.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    const actual = params.get("q") ?? "";
    if (busqueda === actual) return;
    const t = setTimeout(() => poner("q", busqueda.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const select = (clave: string, etiqueta: string, opciones: { valor: string; etiqueta: string }[]) => (
    <select
      aria-label={etiqueta}
      className="campo w-auto max-w-44"
      value={params.get(clave) ?? ""}
      onChange={(e) => poner(clave, e.target.value)}
    >
      <option value="">{etiqueta}</option>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );

  const hayFiltros = [...params.keys()].some((k) => k !== "agrupar" && k !== "vista");
  const nombresAgrupacion: Record<string, string> = {
    vencimiento: "Vencimiento",
    cliente: "Cliente",
    responsable: "Responsable",
    estado: "Estado",
    area: "Área",
    ninguno: "Sin agrupar",
  };

  return (
    <div className={`mb-4 flex flex-wrap items-center gap-2 ${cargando ? "opacity-70" : ""}`}>
      {mostrar.includes("busqueda") && (
        <input
          type="search"
          placeholder="Buscar…"
          className="campo w-44"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      )}
      {mostrar.includes("cliente") &&
        select(
          "cliente",
          "Todos los clientes",
          catalogo.clientes.filter((c) => c.estado !== "archivado").map((c) => ({ valor: c.id, etiqueta: c.nombre })),
        )}
      {mostrar.includes("area") &&
        select("area", "Todas las áreas", [
          ...catalogo.areas.map((a) => ({ valor: a.id, etiqueta: a.nombre + (a.activa ? "" : " (inactiva)") })),
          { valor: "sin", etiqueta: "Sin área" },
        ])}
      {mostrar.includes("responsable") &&
        select("responsable", "Todo el equipo", [
          ...catalogo.colaboradores.filter((c) => c.activo).map((c) => ({ valor: c.id, etiqueta: c.nombre })),
          { valor: "sin", etiqueta: "Sin asignar" },
        ])}
      {mostrar.includes("estado") &&
        select("estado", "Abiertas", [
          ...ESTADOS.map((e) => ({ valor: e.valor, etiqueta: e.etiqueta })),
          { valor: "todas", etiqueta: "Todas (incluye hechas)" },
        ])}
      {mostrar.includes("prioridad") &&
        select("prioridad", "Cualquier prioridad", PRIORIDADES.map((p) => ({ valor: p.valor, etiqueta: p.etiqueta })))}
      {mostrar.includes("vencimiento") &&
        select("vence", "Cualquier fecha", GRUPOS_VENCIMIENTO.map((g) => ({ valor: g.valor, etiqueta: g.etiqueta })))}
      {mostrar.includes("agrupar") && (
        <label className="ml-auto flex items-center gap-1.5 text-xs text-stone-500">
          Agrupar por
          <select
            className="campo w-auto"
            value={params.get("agrupar") ?? agrupaciones[0]}
            onChange={(e) => poner("agrupar", e.target.value === agrupaciones[0] ? "" : e.target.value)}
          >
            {agrupaciones.map((a) => (
              <option key={a} value={a}>
                {nombresAgrupacion[a]}
              </option>
            ))}
          </select>
        </label>
      )}
      {hayFiltros && (
        <button
          type="button"
          className="btn-fantasma text-xs"
          onClick={() => {
            setBusqueda("");
            const p = new URLSearchParams();
            if (params.get("agrupar")) p.set("agrupar", params.get("agrupar")!);
            if (params.get("vista")) p.set("vista", params.get("vista")!);
            iniciar(() => router.replace(`${ruta}?${p.toString()}`, { scroll: false }));
          }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
