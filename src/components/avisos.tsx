"use client";

import { createContext, useCallback, useContext, useState, useTransition } from "react";
import type { Resultado } from "@/app/acciones";

type Aviso = { id: number; texto: string; tipo: "ok" | "error" };
const Contexto = createContext<(texto: string, tipo?: Aviso["tipo"]) => void>(() => {});

export function ProveedorAvisos({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: Aviso["tipo"] = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "error" ? 6000 : 2500);
  }, []);
  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`pointer-events-auto rounded-md px-4 py-2.5 text-sm shadow-lg ${
              a.tipo === "error" ? "bg-red-600 text-white" : "bg-tinta text-white"
            }`}
          >
            {a.texto}
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos() {
  return useContext(Contexto);
}

/** Ejecuta una acción del servidor en una transición y muestra el error (o el mensaje de éxito) como aviso. */
export function useAccion() {
  const avisar = useAvisos();
  const [pendiente, iniciar] = useTransition();
  const ejecutar = useCallback(
    (fn: () => Promise<Resultado<unknown>>, opciones: { exito?: string; alTerminar?: (ok: boolean) => void } = {}) => {
      iniciar(async () => {
        try {
          const r = await fn();
          if (!r.ok) avisar(r.error, "error");
          else if (opciones.exito) avisar(opciones.exito);
          opciones.alTerminar?.(r.ok);
        } catch {
          avisar("No se pudo conectar con el servidor", "error");
          opciones.alTerminar?.(false);
        }
      });
    },
    [avisar],
  );
  return { pendiente, ejecutar };
}
