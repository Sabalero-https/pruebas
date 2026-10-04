import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { hoy as hoyEnZona } from "@/lib/dominio";
import { filtrosDesdeParams, type Params } from "@/lib/filtros-url";
import { requerirUsuario } from "@/lib/sesion";
import { catalogos, listarTareas, resumenPorCliente } from "@/lib/servicios/consultas";
import { AltaRapida } from "@/components/alta-rapida";
import { Filtros } from "@/components/filtros";
import { Kanban } from "@/components/kanban";
import { ListaTareas } from "@/components/lista-tareas";
import { catalogoUI } from "@/components/tipos";
import { EncabezadoPagina, Metrica, cx } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await catalogos(await getDb());
  return { title: cat.clientes.find((c) => c.slug === slug)?.nombre ?? "Cliente" };
}

export default async function PaginaCliente({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Params>;
}) {
  const { usuario } = await requerirUsuario();
  const { slug } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const cat = await catalogos(db);
  const cliente = cat.clientes.find((c) => c.slug === slug);
  if (!cliente) notFound();

  const hoy = hoyEnZona();
  const { filtros, agrupar } = filtrosDesdeParams(sp);
  const vista = sp.vista === "tablero" ? "tablero" : "lista";
  const [filas, resumen] = await Promise.all([
    listarTareas(db, {
      ...filtros,
      clienteIds: [cliente.id],
      hoy,
      ...(vista === "tablero" && !filtros.estados && !filtros.incluirHechas ? { hechasUltimosDias: 14 } : {}),
      orden: vista === "tablero" ? "kanban" : "vencimiento",
    }),
    resumenPorCliente(db, hoy),
  ]);
  const s = resumen.find((r) => r.clienteId === cliente.id);
  const catalogo = catalogoUI(cat);
  const responsable = cat.colaboradores.find((c) => c.id === cliente.responsableId);
  const base = `/clientes/${cliente.slug}`;

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/clientes" className="text-stone-500 hover:text-stone-800">
          ← Clientes
        </Link>
      </div>
      <EncabezadoPagina
        titulo={cliente.nombre}
        descripcion={`Responsable de cuenta: ${responsable?.nombre ?? "sin asignar"}`}
        acciones={
          <div className="inline-flex rounded-md border border-stone-300 bg-white p-0.5 text-sm shadow-sm">
            {(["lista", "tablero"] as const).map((v) => (
              <Link
                key={v}
                href={v === "tablero" ? `${base}?vista=tablero` : base}
                className={cx("rounded px-3 py-1", vista === v ? "bg-tinta text-white" : "text-stone-600 hover:bg-stone-50")}
              >
                {v === "lista" ? "Por área" : "Tablero"}
              </Link>
            ))}
          </div>
        }
      />
      {cliente.estado !== "activo" && (
        <p className={cx("mb-4 rounded-md px-3 py-2 text-sm", cliente.estado === "archivado" ? "bg-stone-200 text-stone-700" : "bg-amber-50 text-amber-800")}>
          {cliente.estado === "archivado"
            ? "Cliente archivado: no se le pueden cargar tareas nuevas."
            : "Cliente pausado: sus tareas recurrentes no se generan hasta que se reactive."}
        </p>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metrica etiqueta="Abiertas" valor={s?.abiertas ?? 0} href={base} />
        <Metrica etiqueta="Vencidas" valor={s?.vencidas ?? 0} tono="rojo" href={`${base}?vence=vencida`} />
        <Metrica etiqueta="En revisión" valor={s?.enRevision ?? 0} tono="ambar" href={`${base}?estado=en_revision`} />
        <Metrica etiqueta="Esperando cliente" valor={s?.esperandoCliente ?? 0} tono="fucsia" href={`${base}?estado=esperando_cliente`} />
        <Metrica etiqueta="Sin asignar" valor={s?.sinAsignar ?? 0} tono="ambar" href={`${base}?responsable=sin`} />
      </div>
      {cliente.estado !== "archivado" && (
        <div className="mb-4">
          <AltaRapida catalogo={catalogo} usuarioId={usuario.id} clienteFijo={cliente.id} />
        </div>
      )}
      <Filtros
        catalogo={catalogo}
        mostrar={["busqueda", "area", "responsable", ...(vista === "lista" ? ["estado"] : []), "prioridad", "vencimiento", ...(vista === "lista" ? ["agrupar"] : [])]}
        agrupaciones={["area", "vencimiento", "responsable", "estado", "ninguno"]}
      />
      {vista === "tablero" ? (
        <Kanban filas={filas} hoy={hoy} ocultarCliente />
      ) : (
        <ListaTareas filas={filas} catalogo={catalogo} hoy={hoy} agruparPor={agrupar ?? "area"} ocultarCliente vacio="Este cliente no tiene tareas abiertas" />
      )}
    </>
  );
}
