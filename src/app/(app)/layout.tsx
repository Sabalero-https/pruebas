import { getDb } from "@/lib/db";
import { requerirUsuario } from "@/lib/sesion";
import { generarRecurrentesSiCorresponde } from "@/lib/servicios/recurrentes";
import { accionLogout } from "@/app/acciones";
import { Navegacion } from "@/components/navegacion";
import { ProveedorAvisos } from "@/components/avisos";
import { Avatar } from "@/components/ui";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { usuario } = await requerirUsuario();
  // Genera las tareas recurrentes del día aunque no haya un cron configurado (es idempotente).
  await generarRecurrentesSiCorresponde(await getDb());

  return (
    <ProveedorAvisos>
      <div className="md:flex">
        <aside className="sticky top-0 z-20 bg-slate-900 px-3 py-3 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:py-5">
          <div className="mb-3 flex items-center gap-2 px-2.5 md:mb-6">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-marca-500 text-sm font-bold text-white">S</span>
            <span className="text-sm font-semibold text-white">Sumo Tareas</span>
            <form action={accionLogout} className="ml-auto md:hidden">
              <button className="text-xs text-slate-400 hover:text-white">Salir</button>
            </form>
          </div>
          <Navegacion esAdmin={usuario.rol === "admin"} />
          <div className="mt-auto hidden items-center gap-2 border-t border-white/10 px-2.5 pt-4 md:flex">
            <Avatar nombre={usuario.nombre} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">{usuario.nombre}</div>
              <form action={accionLogout}>
                <button className="text-xs text-slate-400 hover:text-white">Cerrar sesión</button>
              </form>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </ProveedorAvisos>
  );
}
