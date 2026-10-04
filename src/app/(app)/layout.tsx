import { getDb } from "@/lib/db";
import { requerirUsuario } from "@/lib/sesion";
import { generarRecurrentesSiCorresponde } from "@/lib/servicios/recurrentes";
import { accionLogout } from "@/app/acciones";
import { Navegacion } from "@/components/navegacion";
import { ProveedorAvisos } from "@/components/avisos";
import { Avatar } from "@/components/ui";
import { Wordmark } from "@/components/marca";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { usuario } = await requerirUsuario();
  // Genera las tareas recurrentes del día aunque no haya un cron configurado (es idempotente).
  await generarRecurrentesSiCorresponde(await getDb());

  return (
    <ProveedorAvisos>
      <div className="md:flex">
        <aside className="sticky top-0 z-20 bg-tinta px-3 py-3 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:py-6">
          <div className="mb-3 flex items-center gap-2 px-2.5 md:mb-6">
            <div className="flex flex-col gap-1">
              <Wordmark variante="oscuro" tamano="sm" />
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50 md:block">Tareas</span>
            </div>
            <form action={accionLogout} className="ml-auto md:hidden">
              <button className="text-xs text-stone-400 hover:text-white">Salir</button>
            </form>
          </div>
          <Navegacion esAdmin={usuario.rol === "admin"} />
          <div className="mt-auto hidden items-center gap-2 border-t border-white/10 px-2.5 pt-4 md:flex">
            <Avatar nombre={usuario.nombre} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">{usuario.nombre}</div>
              <form action={accionLogout}>
                <button className="text-xs text-stone-400 hover:text-white">Cerrar sesión</button>
              </form>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </ProveedorAvisos>
  );
}
