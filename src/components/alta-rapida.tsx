"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { accionCrearTarea } from "@/app/acciones";
import { PRIORIDADES } from "@/lib/dominio";
import { useAvisos } from "./avisos";
import { useFormularioAccion } from "./use-formulario";
import type { CatalogoUI } from "./tipos";

const CLAVE_CLIENTE = "sumo:ultimo-cliente";

/** Barra para crear tareas en segundos desde cualquier pantalla. Atajo: tecla N. */
export function AltaRapida({
  catalogo,
  usuarioId,
  clienteFijo,
}: {
  catalogo: CatalogoUI;
  usuarioId: string;
  clienteFijo?: string;
}) {
  const router = useRouter();
  const avisar = useAvisos();
  const titulo = useRef<HTMLInputElement>(null);
  const clientes = catalogo.clientes.filter((c) => c.estado !== "archivado");
  const [clienteId, setClienteId] = useState(clienteFijo ?? "");
  const [estado, alEnviar, pendiente] = useFormularioAccion<string>(accionCrearTarea);

  // Recordar el último cliente usado (si sigue existiendo y no está archivado).
  useEffect(() => {
    if (clienteFijo) return;
    try {
      const guardado = localStorage.getItem(CLAVE_CLIENTE);
      if (guardado && clientes.some((c) => c.id === guardado)) setClienteId(guardado);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteFijo]);

  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      if (titulo.current) titulo.current.value = "";
      titulo.current?.focus();
      avisar("Tarea creada");
      router.refresh();
    } else {
      avisar(estado.error, "error");
    }
  }, [estado, avisar, router]);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (destino.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      titulo.current?.focus();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        try {
          if (!clienteFijo && clienteId) localStorage.setItem(CLAVE_CLIENTE, clienteId);
        } catch {}
        alEnviar(e);
      }}
      className="tarjeta flex flex-wrap items-center gap-2 p-2"
    >
      <input
        ref={titulo}
        name="titulo"
        required
        maxLength={300}
        autoComplete="off"
        placeholder="Nueva tarea…  (atajo: N)"
        className="campo min-w-48 flex-1 border-transparent shadow-none focus:border-marca-500"
      />
      <select
        name="clienteId"
        required
        aria-label="Cliente"
        className="campo w-auto max-w-44"
        value={clienteId}
        onChange={(e) => setClienteId(e.target.value)}
      >
        <option value="" disabled>
          Cliente…
        </option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
            {c.estado === "pausado" ? " (pausado)" : ""}
          </option>
        ))}
      </select>
      <select name="areaId" aria-label="Área" className="campo w-auto max-w-40" defaultValue="">
        <option value="">Sin área</option>
        {catalogo.areas
          .filter((a) => a.activa)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
      </select>
      <select name="responsableId" aria-label="Responsable" className="campo w-auto max-w-40" defaultValue={usuarioId}>
        <option value="">Sin asignar</option>
        {catalogo.colaboradores
          .filter((c) => c.activo)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.id === usuarioId ? `${c.nombre} (yo)` : c.nombre}
            </option>
          ))}
      </select>
      <input name="venceEl" type="date" aria-label="Vencimiento" className="campo w-auto" />
      <select name="prioridad" aria-label="Prioridad" className="campo w-auto" defaultValue="normal">
        {PRIORIDADES.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.etiqueta}
          </option>
        ))}
      </select>
      <button className="btn-primario" disabled={pendiente}>
        {pendiente ? "Creando…" : "Crear"}
      </button>
    </form>
  );
}
