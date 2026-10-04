import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { buscarInvitacion } from "@/lib/servicios/cuentas";
import { accionAceptarInvitacion } from "@/app/acciones";
import { FormAcceso } from "@/components/form-acceso";

export const metadata: Metadata = { title: "Elegí tu contraseña" };

export default async function Invitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const persona = await buscarInvitacion(await getDb(), token);
  if (!persona) {
    return (
      <>
        <h1 className="text-lg font-semibold text-slate-900">Link inválido</h1>
        <p className="mt-2 text-sm text-slate-600">Este link ya se usó o venció. Pedile uno nuevo a un admin.</p>
        <Link href="/login" className="btn-secundario mt-4 w-full">
          Ir al ingreso
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-lg font-semibold text-slate-900">Hola, {persona.nombre.split(" ")[0]}</h1>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Elegí tu contraseña para entrar como <strong>{persona.email}</strong>.
      </p>
      <FormAcceso accion={accionAceptarInvitacion} boton="Guardar y entrar">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="etiqueta">Contraseña (mínimo 8 caracteres)</label>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus className="campo" />
        </div>
        <div>
          <label className="etiqueta">Repetila</label>
          <input name="confirmacion" type="password" required minLength={8} autoComplete="new-password" className="campo" />
        </div>
      </FormAcceso>
    </>
  );
}
