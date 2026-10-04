import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { hayColaboradores } from "@/lib/servicios/cuentas";
import { accionSetup } from "@/app/acciones";
import { FormAcceso } from "@/components/form-acceso";

export const metadata: Metadata = { title: "Configuración inicial" };

export default async function Setup() {
  // Solo existe mientras la base está vacía: después nadie puede volver a crear un admin por acá.
  if (await hayColaboradores(await getDb())) redirect("/login");
  return (
    <>
      <h1 className="text-lg font-semibold text-stone-900">Configuración inicial</h1>
      <p className="mb-4 mt-1 text-sm text-stone-500">
        Creá el primer usuario administrador. También se crean el cliente interno y las áreas de trabajo.
      </p>
      <FormAcceso accion={accionSetup} boton="Crear y entrar">
        <div>
          <label className="etiqueta">Tu nombre</label>
          <input name="nombre" required autoFocus className="campo" />
        </div>
        <div>
          <label className="etiqueta">Email</label>
          <input name="email" type="email" required className="campo" />
        </div>
        <div>
          <label className="etiqueta">Contraseña (mínimo 8 caracteres)</label>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="campo" />
        </div>
        <div>
          <label className="etiqueta">Nombre del cliente interno</label>
          <input name="interno" defaultValue="Sumo Growth (interno)" className="campo" />
        </div>
      </FormAcceso>
    </>
  );
}
