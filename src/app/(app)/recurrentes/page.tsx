import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { reglasRecurrentes } from "@/lib/db/schema";
import { describirFrecuencia, etiquetaPrioridad, formatearFecha, hoy as hoyEnZona } from "@/lib/dominio";
import { requerirUsuario } from "@/lib/sesion";
import { catalogos } from "@/lib/servicios/consultas";
import { accionActivarRegla, accionEliminarRegla, accionGenerarRecurrentes } from "@/app/acciones";
import { BotonAccion } from "@/components/formularios";
import { FormRegla } from "@/components/form-regla";
import { catalogoUI } from "@/components/tipos";
import { ChipCliente, EncabezadoPagina, Vacio, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Recurrentes" };

export default async function Recurrentes() {
  const { usuario } = await requerirUsuario();
  const esAdmin = usuario.rol === "admin";
  const db = await getDb();
  const hoy = hoyEnZona();
  const [reglas, cat] = await Promise.all([
    db.select().from(reglasRecurrentes).orderBy(asc(reglasRecurrentes.titulo)),
    catalogos(db),
  ]);
  const catalogo = catalogoUI(cat);
  const clientes = new Map(cat.clientes.map((c) => [c.id, c]));
  const areas = new Map(cat.areas.map((a) => [a.id, a]));
  const personas = new Map(cat.colaboradores.map((c) => [c.id, c]));

  return (
    <>
      <EncabezadoPagina
        titulo="Tareas recurrentes"
        descripcion="Se generan solas en la fecha que corresponde (Daily Forecast, optimización semanal, reporte mensual…)."
        acciones={
          esAdmin && (
            <BotonAccion accion={accionGenerarRecurrentes} exito="Recurrentes al día">
              Generar ahora
            </BotonAccion>
          )
        }
      />
      {esAdmin && (
        <details className="tarjeta mb-6 p-4" open={reglas.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-stone-800">+ Nueva tarea recurrente</summary>
          <div className="mt-4">
            <FormRegla catalogo={catalogo} />
          </div>
        </details>
      )}
      {reglas.length === 0 ? (
        <Vacio titulo="No hay tareas recurrentes">{esAdmin ? "Creá la primera con el formulario de arriba." : "Un admin las puede crear."}</Vacio>
      ) : (
        <ul className="space-y-2">
          {reglas.map((r) => {
            const cliente = clientes.get(r.clienteId);
            const responsable = r.responsableId ? personas.get(r.responsableId) : null;
            const area = r.areaId ? areas.get(r.areaId) : null;
            const avisos = [
              cliente?.estado === "pausado" && "el cliente está pausado: no se generan tareas",
              responsable && !responsable.activo && "el responsable está inactivo: se crearán sin asignar",
              area && !area.activa && "el área está desactivada: se crearán sin área",
            ].filter(Boolean);
            return (
              <li key={r.id} className={cx("tarjeta p-4", !r.activa && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800">{r.titulo}</span>
                      {!r.activa && <span className="rounded bg-stone-200 px-1.5 text-[11px] text-stone-600">Pausada</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                      {cliente && <ChipCliente nombre={cliente.nombre} color={cliente.color} />}
                      <span>{describirFrecuencia(r)}</span>
                      {area && <span>{area.nombre}</span>}
                      <span>{responsable ? responsable.nombre : "Sin asignar"}</span>
                      <span>Prioridad {etiquetaPrioridad(r.prioridad).toLowerCase()}</span>
                      {r.diasParaVencer > 0 && <span>vence a los {r.diasParaVencer} días</span>}
                    </div>
                    {avisos.length > 0 && <div className="mt-1 text-xs text-amber-700">⚠ {avisos.join(" · ")}</div>}
                  </div>
                  <div className="text-right text-xs text-stone-500">
                    {r.activa ? (
                      <>
                        Próxima: <span className="font-medium text-stone-700">{formatearFecha(r.proximaEn, hoy)}</span>
                      </>
                    ) : (
                      "No genera tareas"
                    )}
                  </div>
                  {esAdmin && (
                    <div className="flex gap-1">
                      <BotonAccion accion={accionActivarRegla.bind(null, r.id, !r.activa)} className="btn-fantasma text-xs">
                        {r.activa ? "Pausar" : "Reactivar"}
                      </BotonAccion>
                      <BotonAccion
                        accion={accionEliminarRegla.bind(null, r.id)}
                        confirmar="¿Eliminar esta tarea recurrente? Las tareas ya generadas se conservan."
                        className="btn-fantasma text-xs text-red-600"
                      >
                        Eliminar
                      </BotonAccion>
                    </div>
                  )}
                </div>
                {esAdmin && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-marca-700">Editar</summary>
                    <div className="mt-3">
                      <FormRegla catalogo={catalogo} regla={r} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
