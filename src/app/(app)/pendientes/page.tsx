import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { hoy as hoyEnZona } from "@/lib/dominio";
import { filtrosDesdeParams, type Params } from "@/lib/filtros-url";
import { requerirUsuario } from "@/lib/sesion";
import { catalogos, listarTareas, resumenGeneral } from "@/lib/servicios/consultas";
import { AltaRapida } from "@/components/alta-rapida";
import { Filtros } from "@/components/filtros";
import { Kanban } from "@/components/kanban";
import { ListaTareas } from "@/components/lista-tareas";
import { catalogoUI } from "@/components/tipos";
import { EncabezadoPagina, Metrica, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Pendientes" };

const LIMITE = 500;

export default async function Pendientes({ searchParams }: { searchParams: Promise<Params> }) {
  const { usuario } = await requerirUsuario();
  const params = await searchParams;
  const { filtros, agrupar } = filtrosDesdeParams(params);
  const vista = params.vista === "tablero" ? "tablero" : "lista";
  const db = await getDb();
  const hoy = hoyEnZona();
  const [filas, resumen, cat] = await Promise.all([
    listarTareas(db, {
      ...filtros,
      hoy,
      limite: LIMITE,
      // En el tablero se ven también las terminadas de las últimas 2 semanas.
      ...(vista === "tablero" && !filtros.estados && !filtros.incluirHechas ? { hechasUltimosDias: 14 } : {}),
      orden: vista === "tablero" ? "kanban" : "vencimiento",
    }),
    resumenGeneral(db, hoy),
    catalogos(db),
  ]);
  const catalogo = catalogoUI(cat);
  const conVista = (extra: string) => `/pendientes?${extra}${vista === "tablero" ? `${extra ? "&" : ""}vista=tablero` : ""}`;
  const urlVista = (v: string) => {
    const p = new URLSearchParams(Object.entries(params).flatMap(([k, val]) => (typeof val === "string" ? [[k, val]] : [])));
    if (v === "tablero") p.set("vista", "tablero");
    else p.delete("vista");
    return `/pendientes?${p.toString()}`;
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Pendientes de la agencia"
        descripcion="Todas las tareas abiertas de todos los clientes y colaboradores."
        acciones={
          <div className="inline-flex rounded-md border border-stone-300 bg-white p-0.5 text-sm shadow-sm">
            {(["lista", "tablero"] as const).map((v) => (
              <Link
                key={v}
                href={urlVista(v)}
                className={cx("rounded px-3 py-1", vista === v ? "bg-tinta text-white" : "text-stone-600 hover:bg-stone-50")}
              >
                {v === "lista" ? "Lista" : "Tablero"}
              </Link>
            ))}
          </div>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metrica etiqueta="Abiertas" valor={resumen.abiertas} href={conVista("")} />
        <Metrica etiqueta="Vencidas" valor={resumen.vencidas} tono="rojo" href={conVista("vence=vencida")} />
        <Metrica etiqueta="Sin asignar" valor={resumen.sinAsignar} tono="ambar" href={conVista("responsable=sin")} />
        <Metrica etiqueta="Sin fecha" valor={resumen.sinFecha} tono="gris" href={conVista("vence=sin_fecha")} />
        <Metrica etiqueta="En revisión" valor={resumen.enRevision} tono="ambar" href={conVista("estado=en_revision")} />
        <Metrica etiqueta="Esperando cliente" valor={resumen.esperandoCliente} tono="fucsia" href={conVista("estado=esperando_cliente")} />
      </div>
      <div className="mb-4">
        <AltaRapida catalogo={catalogo} usuarioId={usuario.id} />
      </div>
      <Filtros
        catalogo={catalogo}
        mostrar={vista === "tablero" ? ["busqueda", "cliente", "area", "responsable", "prioridad", "vencimiento"] : undefined}
      />
      {filas.length >= LIMITE && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Se muestran las primeras {LIMITE} tareas. Usá los filtros para acotar.
        </p>
      )}
      {vista === "tablero" ? (
        <Kanban filas={filas} hoy={hoy} />
      ) : (
        <ListaTareas filas={filas} catalogo={catalogo} hoy={hoy} agruparPor={agrupar ?? "vencimiento"} vacio="No hay tareas con estos filtros" />
      )}
    </>
  );
}
