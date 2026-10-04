"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  accionActualizarTarea,
  accionArchivarTarea,
  accionComentar,
  accionEditarTarea,
  accionRestaurarTarea,
} from "@/app/acciones";
import type { EstadoTarea, Link as LinkTarea, Prioridad } from "@/lib/db/schema";
import { PRIORIDADES } from "@/lib/dominio";
import type { CambiosTarea } from "@/lib/servicios/tareas";
import { useAccion, useAvisos } from "./avisos";
import { useFormularioAccion } from "./use-formulario";
import { SelectorEstado, SelectorResponsable } from "./fila-tarea";
import type { CatalogoUI } from "./tipos";

type Props = {
  id: string;
  version: number;
  estado: EstadoTarea;
  prioridad: Prioridad;
  clienteId: string;
  clienteNombre: string;
  areaId: string | null;
  areaNombre: string | null;
  responsableId: string | null;
  responsableNombre: string | null;
  venceEl: string | null;
  archivada: boolean;
};

export function PanelPropiedades({ t, catalogo }: { t: Props; catalogo: CatalogoUI }) {
  const { pendiente, ejecutar } = useAccion();
  const cambiar = (c: CambiosTarea) => ejecutar(() => accionActualizarTarea(t.id, c), { exito: "Guardado" });
  const deshabilitado = pendiente || t.archivada;
  const clientes = catalogo.clientes.filter((c) => c.estado !== "archivado" || c.id === t.clienteId);
  const areas = catalogo.areas.filter((a) => a.activa || a.id === t.areaId);

  const fila = (etiqueta: string, control: React.ReactNode) => (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2 py-1.5">
      <span className="text-xs font-medium text-slate-500">{etiqueta}</span>
      {control}
    </div>
  );

  return (
    <div className={pendiente ? "opacity-70" : ""}>
      {fila("Estado", <SelectorEstado className="campo py-1" valor={t.estado} disabled={deshabilitado} onChange={(estado) => cambiar({ estado })} />)}
      {fila(
        "Responsable",
        <SelectorResponsable
          className="campo py-1"
          valor={t.responsableId}
          nombreActual={t.responsableNombre}
          catalogo={catalogo}
          disabled={deshabilitado}
          onChange={(responsableId) => cambiar({ responsableId })}
        />,
      )}
      {fila(
        "Vencimiento",
        <div className="flex gap-1">
          <input
            type="date"
            className="campo py-1"
            value={t.venceEl ?? ""}
            disabled={deshabilitado}
            onChange={(e) => cambiar({ venceEl: e.target.value || null })}
          />
          {t.venceEl && !t.archivada && (
            <button type="button" className="btn-fantasma px-2" title="Quitar fecha" onClick={() => cambiar({ venceEl: null })}>
              ✕
            </button>
          )}
        </div>,
      )}
      {fila(
        "Prioridad",
        <select className="campo py-1" value={t.prioridad} disabled={deshabilitado} onChange={(e) => cambiar({ prioridad: e.target.value as Prioridad })}>
          {PRIORIDADES.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>,
      )}
      {fila(
        "Cliente",
        <select className="campo py-1" value={t.clienteId} disabled={deshabilitado} onChange={(e) => cambiar({ clienteId: e.target.value })}>
          {clientes.map((c) => (
            <option key={c.id} value={c.id} disabled={c.estado === "archivado"}>
              {c.nombre}
              {c.estado === "archivado" ? " (archivado)" : c.estado === "pausado" ? " (pausado)" : ""}
            </option>
          ))}
        </select>,
      )}
      {fila(
        "Área",
        <select className="campo py-1" value={t.areaId ?? ""} disabled={deshabilitado} onChange={(e) => cambiar({ areaId: e.target.value || null })}>
          <option value="">Sin área</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id} disabled={!a.activa}>
              {a.nombre}
              {a.activa ? "" : " (desactivada)"}
            </option>
          ))}
        </select>,
      )}
    </div>
  );
}

export function EditorTarea({
  id,
  version,
  titulo,
  descripcion,
  links,
  archivada,
}: {
  id: string;
  version: number;
  titulo: string;
  descripcion: string | null;
  links: LinkTarea[];
  archivada: boolean;
}) {
  const router = useRouter();
  const avisar = useAvisos();
  const [editando, setEditando] = useState(false);
  const [estado, alEnviar, pendiente] = useFormularioAccion(accionEditarTarea);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      setEditando(false);
      avisar("Cambios guardados");
    } else avisar(estado.error, "error");
  }, [estado, avisar]);

  if (!editando) {
    return (
      <div>
        <div className="flex items-start gap-3">
          <h1 className="flex-1 text-xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
          {!archivada && (
            <button type="button" className="btn-secundario shrink-0" onClick={() => setEditando(true)}>
              Editar
            </button>
          )}
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {descripcion || <span className="text-slate-400">Sin descripción.</span>}
        </div>
        {links.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-marca-700 hover:bg-marca-50"
                >
                  🔗 {l.titulo}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={alEnviar} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <div>
        <label className="etiqueta" htmlFor="titulo">
          Título
        </label>
        <input id="titulo" name="titulo" required maxLength={300} defaultValue={titulo} className="campo text-base font-medium" />
      </div>
      <div>
        <label className="etiqueta" htmlFor="descripcion">
          Descripción
        </label>
        <textarea id="descripcion" name="descripcion" rows={8} defaultValue={descripcion ?? ""} className="campo" />
      </div>
      <div>
        <label className="etiqueta" htmlFor="links">
          Links (uno por línea, opcional «Nombre | https://…»)
        </label>
        <textarea
          id="links"
          name="links"
          rows={3}
          defaultValue={links.map((l) => `${l.titulo} | ${l.url}`).join("\n")}
          className="campo font-mono text-xs"
          placeholder="Brief | https://docs.google.com/…"
        />
      </div>
      <div className="flex gap-2">
        <button className="btn-primario" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className="btn-fantasma" onClick={() => setEditando(false)}>
          Cancelar
        </button>
        {estado && !estado.ok && estado.error.includes("Recargá") && (
          <button type="button" className="btn-secundario" onClick={() => router.refresh()}>
            Recargar
          </button>
        )}
      </div>
    </form>
  );
}

export function FormComentario({ tareaId }: { tareaId: string }) {
  const avisar = useAvisos();
  const form = useRef<HTMLFormElement>(null);
  const [estado, alEnviar, pendiente] = useFormularioAccion(accionComentar);
  useEffect(() => {
    if (!estado) return;
    if (estado.ok) form.current?.reset();
    else avisar(estado.error, "error");
  }, [estado, avisar]);
  return (
    <form ref={form} onSubmit={alEnviar} className="flex flex-col gap-2">
      <input type="hidden" name="tareaId" value={tareaId} />
      <textarea
        name="cuerpo"
        rows={3}
        required
        maxLength={10000}
        className="campo"
        placeholder="Escribí un comentario, un avance o un link al entregable…"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Ctrl/⌘ + Enter para enviar</span>
        <button className="btn-primario" disabled={pendiente}>
          {pendiente ? "Enviando…" : "Comentar"}
        </button>
      </div>
    </form>
  );
}

export function BotonArchivar({ id, archivada }: { id: string; archivada: boolean }) {
  const { pendiente, ejecutar } = useAccion();
  return archivada ? (
    <button type="button" className="btn-secundario w-full" disabled={pendiente} onClick={() => ejecutar(() => accionRestaurarTarea(id), { exito: "Tarea restaurada" })}>
      Restaurar tarea
    </button>
  ) : (
    <button
      type="button"
      className="btn-peligro w-full"
      disabled={pendiente}
      onClick={() => {
        if (confirm("¿Archivar esta tarea? Deja de aparecer en los paneles (se puede restaurar).")) {
          ejecutar(() => accionArchivarTarea(id), { exito: "Tarea archivada" });
        }
      }}
    >
      Archivar tarea
    </button>
  );
}
