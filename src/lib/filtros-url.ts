// Convierte los parámetros de la URL en filtros válidos. Valores inválidos (links viejos, ids borrados, texto
// cualquiera) se ignoran en lugar de romper la página.
import { estadoTarea, prioridad, type EstadoTarea, type Prioridad } from "./db/schema";
import { GRUPOS_VENCIMIENTO, REGEX_UUID, type Vencimiento } from "./dominio";
import type { FiltrosTareas } from "./servicios/consultas";
import type { Agrupacion } from "@/components/lista-tareas";

export type Params = Record<string, string | string[] | undefined>;

function uno(p: Params, clave: string): string | undefined {
  const v = p[clave];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

export function filtrosDesdeParams(p: Params): { filtros: FiltrosTareas; agrupar?: Agrupacion } {
  const filtros: FiltrosTareas = {};
  const cliente = uno(p, "cliente");
  if (cliente && REGEX_UUID.test(cliente)) filtros.clienteIds = [cliente];
  const area = uno(p, "area");
  if (area && (area === "sin" || REGEX_UUID.test(area))) filtros.areaIds = [area];
  const responsable = uno(p, "responsable");
  if (responsable && (responsable === "sin" || REGEX_UUID.test(responsable))) filtros.responsables = [responsable];
  const estado = uno(p, "estado");
  if (estado === "todas") filtros.incluirHechas = true;
  else if (estado && (estadoTarea.enumValues as string[]).includes(estado)) filtros.estados = [estado as EstadoTarea];
  const prio = uno(p, "prioridad");
  if (prio && (prioridad.enumValues as string[]).includes(prio)) filtros.prioridades = [prio as Prioridad];
  const vence = uno(p, "vence");
  if (vence && GRUPOS_VENCIMIENTO.some((g) => g.valor === vence)) filtros.vencimiento = vence as Vencimiento;
  const q = uno(p, "q");
  if (q) filtros.busqueda = q.slice(0, 200);
  const agrupar = uno(p, "agrupar");
  const validas = ["vencimiento", "cliente", "responsable", "estado", "area", "ninguno"];
  return { filtros, agrupar: agrupar && validas.includes(agrupar) ? (agrupar as Agrupacion) : undefined };
}
