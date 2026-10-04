"use client";

import Link from "next/link";
import { accionActualizarTarea } from "@/app/acciones";
import type { EstadoTarea, Prioridad } from "@/lib/db/schema";
import { ESTADOS, PRIORIDADES, clasificarVencimiento } from "@/lib/dominio";
import type { FilaTarea as Fila } from "@/lib/servicios/consultas";
import type { CambiosTarea } from "@/lib/servicios/tareas";
import { useAccion } from "./avisos";
import type { CatalogoUI } from "./tipos";
import { COLOR_ESTADO, ChipCliente, InsigniaPrioridad, TextoFecha, cx } from "./ui";

export function SelectorResponsable({
  valor,
  nombreActual,
  catalogo,
  onChange,
  className,
  disabled,
}: {
  valor: string | null;
  nombreActual?: string | null;
  catalogo: CatalogoUI;
  onChange: (id: string | null) => void;
  className?: string;
  disabled?: boolean;
}) {
  const activos = catalogo.colaboradores.filter((c) => c.activo);
  // Si la tarea quedó asignada a alguien desactivado, se muestra igual (marcado) en vez de aparentar "sin asignar".
  const huerfano = valor && !activos.some((c) => c.id === valor);
  return (
    <select
      aria-label="Responsable"
      className={cx(className, huerfano && "text-red-600")}
      value={valor ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Sin asignar</option>
      {huerfano && <option value={valor}>{nombreActual ?? "Desconocido"} (inactivo)</option>}
      {activos.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  );
}

export function SelectorEstado({
  valor,
  onChange,
  className,
  disabled,
}: {
  valor: EstadoTarea;
  onChange: (e: EstadoTarea) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label="Estado"
      className={cx(className, "font-medium ring-1 ring-inset", COLOR_ESTADO[valor])}
      value={valor}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as EstadoTarea)}
    >
      {ESTADOS.map((e) => (
        <option key={e.valor} value={e.valor}>
          {e.etiqueta}
        </option>
      ))}
    </select>
  );
}

export function FilaTarea({
  tarea,
  catalogo,
  hoy,
  ocultarCliente = false,
}: {
  tarea: Fila;
  catalogo: CatalogoUI;
  hoy: string;
  ocultarCliente?: boolean;
}) {
  const { pendiente, ejecutar } = useAccion();
  const cambiar = (cambios: CambiosTarea, exito?: string) =>
    ejecutar(() => accionActualizarTarea(tarea.id, cambios), { exito });
  const hecha = tarea.estado === "hecho";
  const vencida = !hecha && clasificarVencimiento(tarea.venceEl, hoy) === "vencida";

  return (
    <li
      className={cx(
        "group flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-stone-100 px-3 py-2 last:border-b-0 hover:bg-stone-50/70 sm:flex-nowrap",
        pendiente && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={hecha ? "Reabrir tarea" : "Marcar como hecha"}
        title={hecha ? "Reabrir" : "Marcar como hecha"}
        disabled={pendiente}
        onClick={() => cambiar({ estado: hecha ? "por_hacer" : "hecho" }, hecha ? "Tarea reabierta" : "¡Tarea terminada!")}
        className={cx(
          "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[10px] transition",
          hecha ? "border-emerald-500 bg-emerald-500 text-white" : "border-stone-300 text-transparent hover:border-emerald-500 hover:text-emerald-500",
        )}
      >
        ✓
      </button>

      <div className="min-w-0 flex-1 basis-60">
        <div className="flex items-center gap-2">
          <Link
            href={`/tareas/${tarea.id}`}
            className={cx("truncate text-sm font-medium text-stone-800 hover:text-marca-700", hecha && "text-stone-400 line-through")}
          >
            {tarea.titulo}
          </Link>
          <InsigniaPrioridad prioridad={tarea.prioridad} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
          {!ocultarCliente && (
            <ChipCliente nombre={tarea.clienteNombre} color={tarea.clienteColor} href={`/clientes/${tarea.clienteSlug}`} />
          )}
          {tarea.areaNombre && <span className="truncate">{tarea.areaNombre}</span>}
          {tarea.cantidadComentarios > 0 && <span title="Comentarios">💬 {tarea.cantidadComentarios}</span>}
          {tarea.origen === "recurrente" && <span title="Tarea recurrente">↻</span>}
          {tarea.origen === "api" && <span title="Creada por un agente/API">🤖</span>}
        </div>
      </div>

      <SelectorEstado
        className="campo-mini w-36"
        valor={tarea.estado}
        disabled={pendiente}
        onChange={(estado) => cambiar({ estado })}
      />
      <SelectorResponsable
        className="campo-mini w-36"
        valor={tarea.responsableId}
        nombreActual={tarea.responsableNombre}
        catalogo={catalogo}
        disabled={pendiente}
        onChange={(responsableId) => cambiar({ responsableId })}
      />
      <label className="relative flex w-28 items-center" title="Vencimiento">
        <span className={cx("pointer-events-none absolute left-1.5", vencida && "font-medium")}>
          <TextoFecha fecha={tarea.venceEl} hoy={hoy} cerrada={hecha} />
        </span>
        <input
          type="date"
          aria-label="Vencimiento"
          className="campo-mini w-full cursor-pointer text-transparent focus:text-stone-700 [&::-webkit-calendar-picker-indicator]:opacity-40"
          value={tarea.venceEl ?? ""}
          disabled={pendiente}
          onChange={(e) => cambiar({ venceEl: e.target.value || null })}
        />
      </label>
      <select
        aria-label="Prioridad"
        className="campo-mini w-24"
        value={tarea.prioridad}
        disabled={pendiente}
        onChange={(e) => cambiar({ prioridad: e.target.value as Prioridad })}
      >
        {PRIORIDADES.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.etiqueta}
          </option>
        ))}
      </select>
    </li>
  );
}
