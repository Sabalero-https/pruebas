"use client";

import { startTransition, useActionState } from "react";
import type { Resultado } from "@/app/acciones";

/**
 * Como useActionState, pero sin el reseteo automático de React 19 al enviar un <form action>:
 * si el servidor devuelve un error (contraseña mal, conflicto de edición, nombre duplicado)
 * la persona no pierde lo que escribió. Cada formulario limpia sus campos solo cuando sale bien.
 */
export function useFormularioAccion<T>(accion: (prev: Resultado<T> | null, fd: FormData) => Promise<Resultado<T>>) {
  const [estado, despachar, pendiente] = useActionState<Resultado<T> | null, FormData>(accion, null);
  const alEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => despachar(datos));
  };
  return [estado, alEnviar, pendiente] as const;
}
