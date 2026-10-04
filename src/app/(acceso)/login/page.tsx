import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { usuarioActual } from "@/lib/sesion";
import { hayColaboradores } from "@/lib/servicios/cuentas";
import { accionLogin } from "@/app/acciones";
import { FormAcceso } from "@/components/form-acceso";

export const metadata: Metadata = { title: "Ingresar" };

export default async function Login() {
  if (!(await hayColaboradores(await getDb()))) redirect("/setup");
  if (await usuarioActual()) redirect("/");
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold text-slate-900">Ingresar</h1>
      <FormAcceso accion={accionLogin} boton="Ingresar">
        <div>
          <label className="etiqueta" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" autoFocus className="campo" />
        </div>
        <div>
          <label className="etiqueta" htmlFor="password">
            Contraseña
          </label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="campo" />
        </div>
      </FormAcceso>
      <p className="mt-4 text-center text-xs text-slate-500">¿Te olvidaste la contraseña? Pedile a un admin un link nuevo.</p>
    </>
  );
}
