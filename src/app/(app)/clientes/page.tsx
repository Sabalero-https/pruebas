import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { formatearFecha, hoy as hoyEnZona } from "@/lib/dominio";
import { requerirUsuario } from "@/lib/sesion";
import { catalogos, resumenPorCliente } from "@/lib/servicios/consultas";
import { Avatar, EncabezadoPagina, Vacio, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Por cliente" };

export default async function Clientes() {
  const { usuario } = await requerirUsuario();
  const db = await getDb();
  const hoy = hoyEnZona();
  const [cat, resumen] = await Promise.all([catalogos(db), resumenPorCliente(db, hoy)]);
  const stats = new Map(resumen.map((r) => [r.clienteId, r]));
  const personas = new Map(cat.colaboradores.map((c) => [c.id, c]));
  const visibles = cat.clientes.filter((c) => c.estado !== "archivado");
  const archivados = cat.clientes.filter((c) => c.estado === "archivado");

  return (
    <>
      <EncabezadoPagina
        titulo="Por cliente"
        descripcion="Estado de cada cuenta. Entrá a un cliente para ver sus tareas por área."
        acciones={
          usuario.rol === "admin" && (
            <Link href="/admin?seccion=clientes" className="btn-secundario">
              Gestionar clientes
            </Link>
          )
        }
      />
      {visibles.length === 0 && <Vacio titulo="Todavía no hay clientes">Un admin los puede crear en Administración.</Vacio>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibles.map((c) => {
          const s = stats.get(c.id);
          const responsable = c.responsableId ? personas.get(c.responsableId) : null;
          const salud = !s ? "sin" : s.vencidas > 0 ? "rojo" : s.enRevision + s.esperandoCliente > 0 ? "ambar" : "verde";
          return (
            <Link key={c.id} href={`/clientes/${c.slug}`} className="tarjeta block p-4 transition hover:border-marca-500 hover:shadow">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded" style={{ backgroundColor: c.color }} />
                <h2 className="truncate font-semibold text-slate-900">{c.nombre}</h2>
                {c.esInterno && <span className="rounded bg-slate-100 px-1.5 text-[11px] text-slate-500">Interno</span>}
                {c.estado === "pausado" && <span className="rounded bg-amber-100 px-1.5 text-[11px] text-amber-800">Pausado</span>}
                <span
                  title={salud === "rojo" ? "Tiene tareas vencidas" : salud === "ambar" ? "Hay cosas esperando revisión o al cliente" : "Al día"}
                  className={cx(
                    "ml-auto h-2.5 w-2.5 rounded-full",
                    salud === "rojo" ? "bg-red-500" : salud === "ambar" ? "bg-amber-400" : salud === "verde" ? "bg-emerald-500" : "bg-slate-200",
                  )}
                />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  ["Abiertas", s?.abiertas ?? 0, "text-slate-800"],
                  ["Vencidas", s?.vencidas ?? 0, "text-red-600"],
                  ["Revisión", s?.enRevision ?? 0, "text-amber-700"],
                  ["Esp. cliente", s?.esperandoCliente ?? 0, "text-fuchsia-700"],
                ].map(([etiqueta, valor, color]) => (
                  <div key={etiqueta as string}>
                    <div className={cx("text-lg font-semibold tabular-nums", valor === 0 ? "text-slate-300" : (color as string))}>{valor}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">{etiqueta}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <Avatar nombre={responsable?.nombre ?? null} tamano="sm" />
                <span className="truncate">{responsable ? responsable.nombre : "Sin responsable de cuenta"}</span>
                <span className="ml-auto whitespace-nowrap">
                  {s?.proximaEntrega ? `Próxima: ${formatearFecha(s.proximaEntrega, hoy)}` : "Sin entregas próximas"}
                </span>
              </div>
              {(s?.sinAsignar ?? 0) > 0 && (
                <div className="mt-2 text-xs text-amber-700">{s!.sinAsignar} tarea(s) sin asignar</div>
              )}
            </Link>
          );
        })}
      </div>
      {archivados.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-slate-500">Clientes archivados ({archivados.length})</summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {archivados.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.slug}`} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-500 hover:text-slate-800">
                  {c.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
