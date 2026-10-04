"use client";

import { useEffect, useRef, useState } from "react";
import type { Resultado } from "@/app/acciones";
import { useAccion, useAvisos } from "./avisos";
import { useFormularioAccion } from "./use-formulario";

/**
 * Formulario genérico para acciones del servidor: muestra errores, el mensaje de éxito y
 * (si la acción devuelve un texto, ej. un link de invitación o un token) lo deja listo para copiar.
 */
export function Formulario<T>({
  accion,
  children,
  className,
  boton = "Guardar",
  resetear = true,
  alGuardar,
}: {
  accion: (prev: Resultado<T> | null, fd: FormData) => Promise<Resultado<T>>;
  children: React.ReactNode;
  className?: string;
  boton?: string;
  resetear?: boolean;
  alGuardar?: () => void;
}) {
  const avisar = useAvisos();
  const form = useRef<HTMLFormElement>(null);
  const [estado, alEnviar, pendiente] = useFormularioAccion(accion);
  useEffect(() => {
    if (!estado) return;
    if (estado.ok) {
      if (typeof estado.datos !== "string") avisar(estado.mensaje ?? "Guardado");
      if (resetear) form.current?.reset();
      alGuardar?.();
    } else avisar(estado.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
  return (
    <form ref={form} onSubmit={alEnviar} className={className}>
      {children}
      <div className="flex items-end">
        <button className="btn-primario" disabled={pendiente}>
          {pendiente ? "Guardando…" : boton}
        </button>
      </div>
      {estado?.ok && typeof estado.datos === "string" && <TextoCopiable mensaje={estado.mensaje} texto={estado.datos} />}
    </form>
  );
}

export function TextoCopiable({ mensaje, texto }: { mensaje?: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="col-span-full mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
      {mensaje && <p className="mb-2 text-emerald-800">{mensaje}</p>}
      <div className="flex gap-2">
        <input readOnly value={texto} className="campo font-mono text-xs" onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn-secundario shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              setCopiado(true);
            } catch {}
          }}
        >
          {copiado ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

/** Botón que ejecuta una acción puntual, con confirmación opcional. */
export function BotonAccion({
  accion,
  children,
  confirmar,
  className = "btn-secundario",
  exito,
}: {
  accion: () => Promise<Resultado<unknown>>;
  children: React.ReactNode;
  confirmar?: string;
  className?: string;
  exito?: string;
}) {
  const { pendiente, ejecutar } = useAccion();
  return (
    <button
      type="button"
      className={className}
      disabled={pendiente}
      onClick={() => {
        if (confirmar && !confirm(confirmar)) return;
        ejecutar(accion, { exito });
      }}
    >
      {children}
    </button>
  );
}

/** Botón que pide un link (invitación / reseteo) y lo muestra para copiar. */
export function BotonLink({ accion, children }: { accion: () => Promise<Resultado<string>>; children: React.ReactNode }) {
  const avisar = useAvisos();
  const [link, setLink] = useState<{ mensaje?: string; texto: string } | null>(null);
  const { pendiente, ejecutar } = useAccion();
  return (
    <>
      <button
        type="button"
        className="btn-fantasma text-xs"
        disabled={pendiente}
        onClick={() =>
          ejecutar(async () => {
            const r = await accion();
            if (r.ok && r.datos) setLink({ mensaje: r.mensaje, texto: r.datos });
            else if (!r.ok) avisar(r.error, "error");
            return r.ok ? r : { ok: true };
          })
        }
      >
        {children}
      </button>
      {link && <TextoCopiable mensaje={link.mensaje} texto={link.texto} />}
    </>
  );
}
