"use client";

import type { Resultado } from "@/app/acciones";
import { useFormularioAccion } from "./use-formulario";

/** Formulario de login / setup / invitación con el error visible debajo. */
export function FormAcceso({
  accion,
  boton,
  children,
}: {
  accion: (prev: Resultado | null, fd: FormData) => Promise<Resultado>;
  boton: string;
  children: React.ReactNode;
}) {
  const [estado, alEnviar, pendiente] = useFormularioAccion(accion);
  return (
    <form onSubmit={alEnviar} className="space-y-3">
      {children}
      {estado && !estado.ok && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{estado.error}</p>}
      <button className="btn-primario w-full py-2" disabled={pendiente}>
        {pendiente ? "Un momento…" : boton}
      </button>
    </form>
  );
}
