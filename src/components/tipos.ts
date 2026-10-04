import type { Catalogos } from "@/lib/servicios/consultas";

/** Versión liviana de los catálogos que se manda a los componentes de cliente. */
export type CatalogoUI = {
  clientes: { id: string; nombre: string; color: string; estado: string; esInterno: boolean }[];
  areas: { id: string; nombre: string; activa: boolean }[];
  colaboradores: { id: string; nombre: string; activo: boolean }[];
};

export function catalogoUI(c: Catalogos): CatalogoUI {
  return {
    clientes: c.clientes.map(({ id, nombre, color, estado, esInterno }) => ({ id, nombre, color, estado, esInterno })),
    areas: c.areas.map(({ id, nombre, activa }) => ({ id, nombre, activa })),
    colaboradores: c.colaboradores.map(({ id, nombre, activo }) => ({ id, nombre, activo })),
  };
}
