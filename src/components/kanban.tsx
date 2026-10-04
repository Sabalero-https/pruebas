"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accionActualizarTarea } from "@/app/acciones";
import type { EstadoTarea } from "@/lib/db/schema";
import { ESTADOS } from "@/lib/dominio";
import type { FilaTarea } from "@/lib/servicios/consultas";
import { useAccion } from "./avisos";
import { Avatar, ChipCliente, InsigniaPrioridad, PUNTO_ESTADO, TextoFecha, cx } from "./ui";

/** Tablero por estado. Arrastrar una tarjeta cambia el estado y el orden; en celular se usa el selector. */
export function Kanban({ filas, hoy, ocultarCliente = false }: { filas: FilaTarea[]; hoy: string; ocultarCliente?: boolean }) {
  const router = useRouter();
  const { ejecutar } = useAccion();
  const [tarjetas, setTarjetas] = useState(filas);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  useEffect(() => setTarjetas(filas), [filas]);

  const columnas = ESTADOS.map((e) => ({
    ...e,
    tarjetas: tarjetas.filter((t) => t.estado === e.valor).sort((a, b) => a.ordenKanban - b.ordenKanban),
  }));

  const mover = (id: string, estado: EstadoTarea, antesDe: string | null) => {
    const columna = columnas.find((c) => c.valor === estado)!.tarjetas.filter((t) => t.id !== id);
    let orden: number;
    const idx = antesDe ? columna.findIndex((t) => t.id === antesDe) : -1;
    if (idx === -1) orden = (columna.at(-1)?.ordenKanban ?? 0) + 1000;
    else {
      const anterior = columna[idx - 1]?.ordenKanban ?? columna[idx].ordenKanban - 1000;
      orden = (anterior + columna[idx].ordenKanban) / 2;
    }
    const original = tarjetas.find((t) => t.id === id);
    if (!original || (original.estado === estado && original.ordenKanban === orden)) return;
    setTarjetas((ts) => ts.map((t) => (t.id === id ? { ...t, estado, ordenKanban: orden } : t)));
    ejecutar(() => accionActualizarTarea(id, { estado, ordenKanban: orden }), {
      alTerminar: (ok) => {
        if (!ok) setTarjetas(filas); // vuelve atrás si el servidor rechazó el cambio
        router.refresh();
      },
    });
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4">
      <div className="grid min-w-[1150px] grid-cols-6 gap-3">
        {columnas.map((col) => (
          <section
            key={col.valor}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(col.valor);
            }}
            onDragLeave={() => setSobre((s) => (s === col.valor ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              setSobre(null);
              if (id) mover(id, col.valor, null);
            }}
            className={cx("flex min-h-64 flex-col rounded-lg bg-slate-100/80 p-2 transition", sobre === col.valor && "bg-marca-50 ring-2 ring-marca-500/40")}
          >
            <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span className={cx("h-2 w-2 rounded-full", PUNTO_ESTADO[col.valor])} />
              {col.etiqueta}
              <span className="ml-auto font-medium text-slate-400">{col.tarjetas.length}</span>
            </h2>
            <ol className="flex flex-1 flex-col gap-2">
              {col.tarjetas.map((t) => (
                <li
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", t.id);
                    e.dataTransfer.effectAllowed = "move";
                    setArrastrando(t.id);
                  }}
                  onDragEnd={() => setArrastrando(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = e.dataTransfer.getData("text/plain");
                    setSobre(null);
                    if (id && id !== t.id) mover(id, col.valor, t.id);
                  }}
                  className={cx(
                    "tarjeta cursor-grab p-2.5 active:cursor-grabbing",
                    arrastrando === t.id && "opacity-40",
                  )}
                >
                  <Link href={`/tareas/${t.id}`} className="line-clamp-3 text-sm font-medium text-slate-800 hover:text-marca-700">
                    {t.titulo}
                  </Link>
                  {!ocultarCliente && (
                    <div className="mt-1.5 min-w-0 [&>span]:max-w-full">
                      <ChipCliente nombre={t.clienteNombre} color={t.clienteColor} />
                    </div>
                  )}
                  {t.areaNombre && <div className="mt-0.5 truncate text-xs text-slate-400">{t.areaNombre}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Avatar nombre={t.responsableNombre} tamano="sm" />
                    <TextoFecha fecha={t.venceEl} hoy={hoy} cerrada={t.estado === "hecho"} />
                    <span className="ml-auto">
                      <InsigniaPrioridad prioridad={t.prioridad} />
                    </span>
                  </div>
                  <select
                    aria-label="Mover a"
                    className="campo-mini mt-2 w-full md:hidden"
                    value={t.estado}
                    onChange={(e) => mover(t.id, e.target.value as EstadoTarea, null)}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e.valor} value={e.valor}>
                        {e.etiqueta}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
