import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { REGEX_UUID, hoy as hoyEnZona } from "@/lib/dominio";
import { requerirUsuario } from "@/lib/sesion";
import { catalogos, detalleTarea } from "@/lib/servicios/consultas";
import { BotonArchivar, EditorTarea, FormComentario, PanelPropiedades } from "@/components/detalle-tarea";
import { catalogoUI } from "@/components/tipos";
import { Avatar, ChipCliente, TextoFecha } from "@/components/ui";

export const metadata: Metadata = { title: "Tarea" };

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires",
});

export default async function PaginaTarea({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { id } = await params;
  if (!REGEX_UUID.test(id)) notFound();
  const db = await getDb();
  const [t, cat] = await Promise.all([detalleTarea(db, id), catalogos(db)]);
  if (!t) notFound();
  const hoy = hoyEnZona();
  const archivada = !!t.archivadaEn;

  const origen: Record<string, string> = {
    manual: "Creada a mano",
    api: "Creada por API / agente",
    recurrente: "Generada por una tarea recurrente",
    migracion: "Importada desde ClickUp",
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Link href={`/clientes/${t.clienteSlug}`} className="text-stone-500 hover:text-stone-800">
          ← {t.clienteNombre}
        </Link>
      </div>
      {archivada && (
        <p className="mb-4 rounded-md bg-stone-200 px-3 py-2 text-sm text-stone-700">
          Esta tarea está archivada: no aparece en los paneles. Restaurala para editarla.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <div className="tarjeta p-5">
            <EditorTarea id={t.id} version={t.version} titulo={t.titulo} descripcion={t.descripcion} links={t.links} archivada={archivada} />
          </div>

          <section className="tarjeta p-5">
            <h2 className="mb-3 text-sm font-semibold text-stone-800">Comentarios ({t.comentarios.length})</h2>
            <ul className="mb-4 space-y-4">
              {t.comentarios.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <Avatar nombre={c.autorNombre} tamano="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-stone-500">
                      <span className="font-medium text-stone-700">{c.autorNombre}</span> · {fechaHora.format(c.creadoEn)}
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-stone-700">{c.cuerpo}</div>
                  </div>
                </li>
              ))}
            </ul>
            {!archivada && <FormComentario tareaId={t.id} />}
          </section>

          <section className="tarjeta p-5">
            <h2 className="mb-3 text-sm font-semibold text-stone-800">Historial</h2>
            <ol className="space-y-1.5 text-xs text-stone-600">
              {t.historial.map((h) => (
                <li key={h.id} className="flex gap-2">
                  <span className="w-36 shrink-0 whitespace-nowrap text-stone-400">{fechaHora.format(h.creadoEn)}</span>
                  <span>
                    <span className="font-medium text-stone-700">{h.actor}</span>{" "}
                    {h.campo === "creada"
                      ? "creó la tarea"
                      : h.campo === "archivada"
                        ? "archivó la tarea"
                        : h.campo === "restaurada"
                          ? "restauró la tarea"
                          : (
                            <>
                              cambió {h.campo}
                              {h.campo !== "descripción" && (
                                <>
                                  : <span className="text-stone-400 line-through">{h.antes ?? "vacío"}</span> → <span className="text-stone-800">{h.despues ?? "vacío"}</span>
                                </>
                              )}
                            </>
                          )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="tarjeta p-4">
            <PanelPropiedades
              catalogo={catalogoUI(cat)}
              t={{
                id: t.id,
                version: t.version,
                estado: t.estado,
                prioridad: t.prioridad,
                clienteId: t.clienteId,
                clienteNombre: t.clienteNombre,
                areaId: t.areaId,
                areaNombre: t.areaNombre,
                responsableId: t.responsableId,
                responsableNombre: t.responsableNombre,
                venceEl: t.venceEl,
                archivada,
              }}
            />
          </div>
          <div className="tarjeta space-y-1.5 p-4 text-xs text-stone-500">
            <div className="flex items-center gap-2">
              <ChipCliente nombre={t.clienteNombre} color={t.clienteColor} href={`/clientes/${t.clienteSlug}`} />
              <span className="ml-auto">
                <TextoFecha fecha={t.venceEl} hoy={hoy} cerrada={t.estado === "hecho"} />
              </span>
            </div>
            <div>{origen[t.origen] ?? t.origen}</div>
            <div>
              Creada por {t.creadoPor} el {fechaHora.format(t.creadoEn)}
            </div>
            <div>Última actualización: {fechaHora.format(t.actualizadoEn)}</div>
            {t.completadaEn && <div>Terminada el {fechaHora.format(t.completadaEn)}</div>}
            {t.reglaId && (
              <div>
                <Link href="/recurrentes" className="text-marca-700 hover:underline">
                  Ver tarea recurrente
                </Link>
              </div>
            )}
            {t.claveExterna && <div className="break-all font-mono text-[10px] text-stone-400">clave: {t.claveExterna}</div>}
          </div>
          <BotonArchivar id={t.id} archivada={archivada} />
        </aside>
      </div>
    </div>
  );
}
