import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { hoy as hoyEnZona } from "@/lib/dominio";
import { filtrosDesdeParams, type Params } from "@/lib/filtros-url";
import { requerirUsuario } from "@/lib/sesion";
import { catalogos, listarTareas, resumenPorColaborador, type FilaTarea } from "@/lib/servicios/consultas";
import { Filtros } from "@/components/filtros";
import { catalogoUI } from "@/components/tipos";
import { Avatar, ChipCliente, EncabezadoPagina, InsigniaEstado, InsigniaPrioridad, TextoFecha, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Por colaborador" };

export default async function Equipo({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirUsuario();
  const { filtros } = filtrosDesdeParams(await searchParams);
  const db = await getDb();
  const hoy = hoyEnZona();
  const [filas, resumen, cat] = await Promise.all([
    listarTareas(db, { clienteIds: filtros.clienteIds, areaIds: filtros.areaIds, busqueda: filtros.busqueda, hoy }),
    resumenPorColaborador(db, hoy),
    catalogos(db),
  ]);

  // Personas activas + quien esté inactivo pero todavía tenga tareas abiertas (dato a corregir).
  const conTareas = new Set(filas.map((f) => f.responsableId));
  const personas = cat.colaboradores.filter((c) => c.activo || conTareas.has(c.id));
  const columnas = [
    ...personas.map((p) => ({ id: p.id, nombre: p.nombre, activo: p.activo })),
    { id: null as string | null, nombre: "Sin asignar", activo: true },
  ];
  const stats = new Map(resumen.map((r) => [r.responsableId, r]));
  const porPersona = (id: string | null) => filas.filter((f) => f.responsableId === id);

  return (
    <>
      <EncabezadoPagina
        titulo="Por colaborador"
        descripcion="Carga de trabajo de cada persona. Ideal para repartir tareas en la reunión semanal."
      />
      <Filtros catalogo={catalogoUI(cat)} mostrar={["busqueda", "cliente", "area"]} />
      <div className="-mx-4 overflow-x-auto px-4 pb-4">
        <div className="flex gap-3">
          {columnas.map((col) => {
            const tareas = porPersona(col.id);
            const s = stats.get(col.id);
            return (
              <section key={col.id ?? "sin"} className={cx("flex w-72 shrink-0 flex-col rounded-lg bg-stone-100/80 p-2", !col.activo && "ring-2 ring-red-200")}>
                <header className="mb-2 flex items-center gap-2 px-1 pt-1">
                  <Avatar nombre={col.id ? col.nombre : null} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/pendientes?responsable=${col.id ?? "sin"}`}
                      className="block truncate text-sm font-semibold text-stone-800 hover:underline"
                    >
                      {col.nombre}
                    </Link>
                    {!col.activo && <div className="text-xs text-red-600">Inactivo: reasigná sus tareas</div>}
                  </div>
                </header>
                <div className="mb-2 grid grid-cols-4 gap-1 text-center">
                  {[
                    ["Abiertas", s?.abiertas ?? 0, "text-stone-800"],
                    ["Vencidas", s?.vencidas ?? 0, "text-red-600"],
                    ["Semana", s?.semana ?? 0, "text-amber-700"],
                    ["Revisión", s?.enRevision ?? 0, "text-amber-700"],
                  ].map(([etiqueta, valor, color]) => (
                    <div key={etiqueta as string} className="rounded bg-white px-1 py-1.5">
                      <div className={cx("text-base font-semibold tabular-nums", valor === 0 ? "text-stone-300" : (color as string))}>{valor}</div>
                      <div className="text-[10px] uppercase tracking-wide text-stone-500">{etiqueta}</div>
                    </div>
                  ))}
                </div>
                <ol className="flex flex-col gap-1.5">
                  {tareas.length === 0 && <li className="px-2 py-6 text-center text-xs text-stone-400">Sin tareas abiertas</li>}
                  {tareas.map((t) => (
                    <TarjetaCompacta key={t.id} t={t} hoy={hoy} />
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

function TarjetaCompacta({ t, hoy }: { t: FilaTarea; hoy: string }) {
  return (
    <li className="tarjeta p-2">
      <Link href={`/tareas/${t.id}`} className="line-clamp-2 text-sm font-medium text-stone-800 hover:text-marca-700">
        {t.titulo}
      </Link>
      <div className="mt-1 flex items-center gap-2">
        <ChipCliente nombre={t.clienteNombre} color={t.clienteColor} />
        <span className="ml-auto">
          <TextoFecha fecha={t.venceEl} hoy={hoy} />
        </span>
      </div>
      {(t.estado !== "por_hacer" || t.prioridad === "urgente" || t.prioridad === "alta") && (
        <div className="mt-1.5 flex items-center gap-1.5">
          {t.estado !== "por_hacer" && <InsigniaEstado estado={t.estado} />}
          <InsigniaPrioridad prioridad={t.prioridad} />
        </div>
      )}
    </li>
  );
}
