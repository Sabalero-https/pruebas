import { ESTADOS, GRUPOS_VENCIMIENTO, clasificarVencimiento } from "@/lib/dominio";
import type { FilaTarea as Fila } from "@/lib/servicios/consultas";
import { FilaTarea } from "./fila-tarea";
import type { CatalogoUI } from "./tipos";
import { Vacio, cx } from "./ui";

export type Agrupacion = "vencimiento" | "cliente" | "responsable" | "estado" | "area" | "ninguno";

type Grupo = { clave: string; titulo: string; color?: string; filas: Fila[]; destacado?: boolean };

export function agrupar(filas: Fila[], por: Agrupacion, hoy: string): Grupo[] {
  if (por === "ninguno") return [{ clave: "todas", titulo: "", filas }];
  const mapa = new Map<string, Grupo>();
  const agregar = (clave: string, titulo: string, fila: Fila, color?: string) => {
    if (!mapa.has(clave)) mapa.set(clave, { clave, titulo, color, filas: [] });
    mapa.get(clave)!.filas.push(fila);
  };
  for (const f of filas) {
    switch (por) {
      case "vencimiento": {
        const v = f.estado === "hecho" ? "hecho" : clasificarVencimiento(f.venceEl, hoy);
        agregar(v, GRUPOS_VENCIMIENTO.find((g) => g.valor === v)?.etiqueta ?? "Terminadas", f);
        break;
      }
      case "cliente":
        agregar(f.clienteId, f.clienteNombre, f, f.clienteColor);
        break;
      case "responsable":
        agregar(f.responsableId ?? "sin", f.responsableNombre ? f.responsableNombre + (f.responsableActivo ? "" : " (inactivo)") : "Sin asignar", f);
        break;
      case "estado":
        agregar(f.estado, ESTADOS.find((e) => e.valor === f.estado)!.etiqueta, f);
        break;
      case "area":
        agregar(f.areaId ?? "sin", f.areaNombre ?? "Sin área", f);
        break;
    }
  }
  const grupos = [...mapa.values()];
  const orden: Record<Agrupacion, (g: Grupo) => string | number> = {
    vencimiento: (g) => [...GRUPOS_VENCIMIENTO.map((x) => x.valor), "hecho"].indexOf(g.clave as never),
    estado: (g) => ESTADOS.findIndex((e) => e.valor === g.clave),
    cliente: (g) => g.titulo.toLowerCase(),
    responsable: (g) => (g.clave === "sin" ? "~" : g.titulo.toLowerCase()),
    area: (g) => (g.clave === "sin" ? "~" : g.titulo.toLowerCase()),
    ninguno: () => 0,
  };
  grupos.sort((a, b) => (orden[por](a) < orden[por](b) ? -1 : orden[por](a) > orden[por](b) ? 1 : 0));
  for (const g of grupos) g.destacado = por === "vencimiento" && g.clave === "vencida";
  return grupos;
}

export function ListaTareas({
  filas,
  catalogo,
  hoy,
  agruparPor = "vencimiento",
  ocultarCliente = false,
  vacio = "No hay tareas para mostrar",
}: {
  filas: Fila[];
  catalogo: CatalogoUI;
  hoy: string;
  agruparPor?: Agrupacion;
  ocultarCliente?: boolean;
  vacio?: string;
}) {
  if (filas.length === 0) return <Vacio titulo={vacio} />;
  return (
    <div className="space-y-5">
      {agrupar(filas, agruparPor, hoy).map((g) => (
        <section key={g.clave}>
          {g.titulo && (
            <h2 className={cx("mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide", g.destacado ? "text-red-600" : "text-slate-500")}>
              {g.color && <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: g.color }} />}
              {g.titulo}
              <span className="rounded-full bg-slate-200/70 px-1.5 text-[11px] font-medium text-slate-600">{g.filas.length}</span>
            </h2>
          )}
          <ul className={cx("tarjeta overflow-hidden", g.destacado && "border-red-200")}>
            {g.filas.map((f) => (
              <FilaTarea key={f.id} tarea={f} catalogo={catalogo} hoy={hoy} ocultarCliente={ocultarCliente} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
