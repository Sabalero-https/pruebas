import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { hoy as hoyEnZona } from "@/lib/dominio";
import { requerirUsuario } from "@/lib/sesion";
import { catalogos, listarTareas } from "@/lib/servicios/consultas";
import { AltaRapida } from "@/components/alta-rapida";
import { ListaTareas } from "@/components/lista-tareas";
import { catalogoUI } from "@/components/tipos";
import { EncabezadoPagina, Metrica } from "@/components/ui";

export const metadata: Metadata = { title: "Mis tareas" };

export default async function MisTareas() {
  const { usuario } = await requerirUsuario();
  const db = await getDb();
  const hoy = hoyEnZona();
  const [filas, cat, enRevisionMias] = await Promise.all([
    listarTareas(db, { responsables: [usuario.id], hoy }),
    catalogos(db),
    listarTareas(db, { responsables: [usuario.id], estados: ["en_revision"], hoy }),
  ]);
  const catalogo = catalogoUI(cat);
  const cuenta = (pred: (v: string | null) => boolean) => filas.filter((f) => pred(f.venceEl)).length;
  const primerNombre = usuario.nombre.split(" ")[0];

  return (
    <>
      <EncabezadoPagina titulo={`Hola, ${primerNombre}`} descripcion="Tus tareas abiertas, ordenadas por vencimiento." />
      <div className="mb-5">
        <AltaRapida catalogo={catalogo} usuarioId={usuario.id} />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica etiqueta="Vencidas" valor={cuenta((v) => !!v && v < hoy)} tono="rojo" href={`/pendientes?responsable=${usuario.id}&vence=vencida`} />
        <Metrica etiqueta="Para hoy" valor={cuenta((v) => v === hoy)} tono="ambar" href={`/pendientes?responsable=${usuario.id}&vence=hoy`} />
        <Metrica etiqueta="En revisión" valor={enRevisionMias.length} tono="ambar" href={`/pendientes?responsable=${usuario.id}&estado=en_revision`} />
        <Metrica etiqueta="Abiertas" valor={filas.length} href={`/pendientes?responsable=${usuario.id}`} />
      </div>
      <ListaTareas filas={filas} catalogo={catalogo} hoy={hoy} vacio="No tenés tareas abiertas. ¡Buen trabajo!" />
    </>
  );
}
