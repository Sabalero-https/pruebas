// Importación desde ClickUp: convierte la estructura Espacio > Carpeta > Lista > Tarea
// en Cliente > Área > Tarea, normalizando estados, prioridades, fechas y responsables.
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { areas, clientes, colaboradores, comentarios } from "./db/schema";
import {
  interpretarEstado,
  interpretarFecha,
  interpretarPrioridad,
  limpiarNombre,
  normalizarEmail,
  normalizarTexto,
} from "./dominio";
import type { Actor } from "./servicios/comun";
import { crearArea, crearCliente } from "./servicios/catalogo";
import { crearTarea } from "./servicios/tareas";

// ------------------------------------------------------------- formato de ClickUp (lo que usamos)

export type TareaClickUp = {
  id: string;
  name: string;
  text_content?: string | null;
  description?: string | null;
  status?: { status: string } | null;
  priority?: { priority: string } | null;
  due_date?: string | number | null;
  date_closed?: string | number | null;
  assignees?: { id: number; username?: string | null; email?: string | null }[];
  tags?: { name: string }[];
  parent?: string | null;
  url?: string;
  comentarios?: { comment_text: string; user?: { username?: string | null } | null; date?: string | number }[];
};
export type ListaClickUp = { id: string; name: string; tasks: TareaClickUp[] };
export type CarpetaClickUp = { id: string; name: string; lists: ListaClickUp[] };
export type EspacioClickUp = { id: string; name: string; folders: CarpetaClickUp[]; lists: ListaClickUp[] };
export type ExportClickUp = { spaces: EspacioClickUp[] };

// ------------------------------------------------------------- plan de importación

export type TareaPlan = {
  claveExterna: string;
  titulo: string;
  descripcion: string | null;
  cliente: string;
  area: string;
  estado: NonNullable<ReturnType<typeof interpretarEstado>>;
  prioridad: NonNullable<ReturnType<typeof interpretarPrioridad>>;
  venceEl: string | null;
  responsableEmail: string | null;
  url?: string;
  comentarios: { autor: string; cuerpo: string; fecha: Date }[];
};

export type Plan = { tareas: TareaPlan[]; advertencias: string[]; clientes: string[]; areas: string[] };

export function planificarImportacion(
  datos: ExportClickUp,
  opciones: { espacioInterno: string; clienteInterno: string; emailsConocidos: string[]; zona?: string },
): Plan {
  const advertencias: string[] = [];
  const tareas: TareaPlan[] = [];
  const conocidos = new Set(opciones.emailsConocidos.map(normalizarEmail));
  const nombresTarea = new Map<string, string>();
  const estadosRaros = new Map<string, number>();

  for (const espacio of datos.spaces) {
    for (const carpeta of espacio.folders) for (const lista of carpeta.lists) for (const t of lista.tasks) nombresTarea.set(t.id, t.name);
    for (const lista of espacio.lists) for (const t of lista.tasks) nombresTarea.set(t.id, t.name);
  }

  const procesar = (t: TareaClickUp, cliente: string, area: string) => {
    const notas: string[] = [];
    let estado = interpretarEstado(t.status?.status ?? "");
    if (!estado) {
      estado = t.date_closed ? "hecho" : "por_hacer";
      estadosRaros.set(t.status?.status ?? "(sin estado)", (estadosRaros.get(t.status?.status ?? "(sin estado)") ?? 0) + 1);
    }
    let venceEl: string | null = null;
    try {
      venceEl = interpretarFecha(t.due_date === null || t.due_date === undefined ? null : Number(t.due_date), opciones.zona);
    } catch {
      advertencias.push(`"${t.name}": fecha de vencimiento inválida (${t.due_date}), se importa sin fecha`);
    }
    const asignados = (t.assignees ?? []).filter((a) => a.email || a.username);
    const encontrado = asignados.find((a) => a.email && conocidos.has(normalizarEmail(a.email)));
    const otros = asignados.filter((a) => a !== encontrado).map((a) => a.username || a.email);
    if (otros.length) {
      notas.push(`En ClickUp también estaba asignada a: ${otros.join(", ")}`);
      if (!encontrado) advertencias.push(`"${t.name}": ${otros.join(", ")} no existe(n) en el equipo, queda sin asignar`);
    }
    if (t.parent) notas.push(`Era subtarea de: ${nombresTarea.get(t.parent) ?? t.parent}`);
    if (t.tags?.length) notas.push(`Etiquetas: ${t.tags.map((x) => x.name).join(", ")}`);
    const cuerpo = (t.text_content ?? t.description ?? "").trim();
    tareas.push({
      claveExterna: `clickup:${t.id}`,
      titulo: limpiarNombre(t.name || "(sin título)").slice(0, 300),
      descripcion: [cuerpo, notas.length ? `—\n${notas.join("\n")}` : ""].filter(Boolean).join("\n\n") || null,
      cliente,
      area,
      estado,
      prioridad: interpretarPrioridad(t.priority?.priority) ?? "normal",
      venceEl,
      responsableEmail: encontrado?.email ? normalizarEmail(encontrado.email) : null,
      url: t.url,
      comentarios: (t.comentarios ?? [])
        .filter((c) => c.comment_text?.trim())
        .map((c) => ({
          autor: `ClickUp · ${c.user?.username ?? "desconocido"}`,
          cuerpo: c.comment_text.trim(),
          fecha: c.date ? new Date(Number(c.date)) : new Date(),
        })),
    });
  };

  const esInterno = (nombre: string) => normalizarTexto(nombre) === normalizarTexto(opciones.espacioInterno);
  for (const espacio of datos.spaces) {
    for (const carpeta of espacio.folders) {
      const cliente = esInterno(carpeta.name) ? opciones.clienteInterno : limpiarNombre(carpeta.name);
      for (const lista of carpeta.lists) for (const t of lista.tasks) procesar(t, cliente, limpiarNombre(lista.name));
    }
    // Listas sueltas (sin carpeta): son del espacio. El espacio interno va al cliente interno.
    const clienteEspacio = esInterno(espacio.name) ? opciones.clienteInterno : limpiarNombre(espacio.name);
    for (const lista of espacio.lists) for (const t of lista.tasks) procesar(t, clienteEspacio, limpiarNombre(lista.name));
  }

  for (const [estado, n] of estadosRaros) {
    advertencias.push(`Estado de ClickUp desconocido "${estado}" en ${n} tarea(s): se importó como "Por hacer" (o "Hecho" si estaba cerrada)`);
  }
  return {
    tareas,
    advertencias,
    clientes: [...new Set(tareas.map((t) => t.cliente))],
    areas: [...new Set(tareas.map((t) => t.area))],
  };
}

// ------------------------------------------------------------- aplicar

export async function aplicarImportacion(db: Db, plan: Plan, actor: Actor) {
  const resumen = { creadas: 0, existentes: 0, clientesCreados: [] as string[], areasCreadas: [] as string[] };

  const todosClientes = await db.select().from(clientes);
  const clientePorClave = new Map(todosClientes.map((c) => [c.nombreClave, c]));
  for (const nombre of plan.clientes) {
    if (!clientePorClave.has(normalizarTexto(nombre))) {
      const c = await crearCliente(db, { nombre }, actor);
      clientePorClave.set(c.nombreClave, c);
      resumen.clientesCreados.push(nombre);
    }
  }
  const todasAreas = await db.select().from(areas);
  const areaPorClave = new Map(todasAreas.map((a) => [a.nombreClave, a]));
  for (const nombre of plan.areas) {
    if (!areaPorClave.has(normalizarTexto(nombre))) {
      const a = await crearArea(db, nombre, actor);
      areaPorClave.set(a.nombreClave, a);
      resumen.areasCreadas.push(nombre);
    }
  }

  for (const t of plan.tareas) {
    const cliente = clientePorClave.get(normalizarTexto(t.cliente))!;
    const area = areaPorClave.get(normalizarTexto(t.area));
    let responsableId: string | null = null;
    if (t.responsableEmail) {
      const [p] = await db.select().from(colaboradores).where(eq(colaboradores.email, t.responsableEmail));
      if (p?.activo) responsableId = p.id;
    }
    if (cliente.estado === "archivado") {
      // No se pueden crear tareas en un cliente archivado: se saltean (quedan en el reporte).
      continue;
    }
    const { tarea, creada } = await crearTarea(
      db,
      {
        titulo: t.titulo,
        descripcion: t.descripcion,
        clienteId: cliente.id,
        areaId: area?.activa ? area.id : null,
        responsableId,
        estado: t.estado,
        prioridad: t.prioridad,
        venceEl: t.venceEl,
        links: t.url ? [{ titulo: "Ver en ClickUp", url: t.url }] : [],
        claveExterna: t.claveExterna,
        origen: "migracion",
      },
      actor,
    );
    if (!creada) {
      resumen.existentes++;
      continue;
    }
    resumen.creadas++;
    if (t.comentarios.length) {
      await db.insert(comentarios).values(
        t.comentarios.map((c) => ({ tareaId: tarea.id, autorNombre: c.autor, cuerpo: c.cuerpo.slice(0, 10000), creadoEn: c.fecha })),
      );
    }
  }
  return resumen;
}

// ------------------------------------------------------------- descarga desde la API de ClickUp

export async function descargarClickUp(token: string, equipoId?: string): Promise<ExportClickUp> {
  const pedir = async <T>(ruta: string): Promise<T> => {
    for (let intento = 0; ; intento++) {
      const r = await fetch(`https://api.clickup.com/api/v2${ruta}`, { headers: { Authorization: token } });
      if (r.status === 429 && intento < 5) {
        await new Promise((ok) => setTimeout(ok, 2000 * (intento + 1)));
        continue;
      }
      if (!r.ok) throw new Error(`ClickUp respondió ${r.status} en ${ruta}: ${await r.text()}`);
      return (await r.json()) as T;
    }
  };
  const equipo = equipoId ?? (await pedir<{ teams: { id: string }[] }>("/team")).teams[0]?.id;
  if (!equipo) throw new Error("No se encontró ningún workspace de ClickUp para este token");

  const tareasDeLista = async (lista: { id: string; name: string }): Promise<ListaClickUp> => {
    const tareas: TareaClickUp[] = [];
    for (let pagina = 0; ; pagina++) {
      const r = await pedir<{ tasks: TareaClickUp[]; last_page?: boolean }>(
        `/list/${lista.id}/task?include_closed=true&subtasks=true&archived=false&page=${pagina}`,
      );
      tareas.push(...r.tasks);
      if (r.last_page !== false || r.tasks.length === 0) break;
    }
    for (const t of tareas) {
      const c = await pedir<{ comments: NonNullable<TareaClickUp["comentarios"]> }>(`/task/${t.id}/comment`);
      t.comentarios = c.comments;
    }
    return { id: lista.id, name: lista.name, tasks: tareas };
  };

  const { spaces } = await pedir<{ spaces: { id: string; name: string }[] }>(`/team/${equipo}/space?archived=false`);
  const resultado: ExportClickUp = { spaces: [] };
  for (const s of spaces) {
    const { folders } = await pedir<{ folders: { id: string; name: string; lists: { id: string; name: string }[] }[] }>(
      `/space/${s.id}/folder?archived=false`,
    );
    const { lists } = await pedir<{ lists: { id: string; name: string }[] }>(`/space/${s.id}/list?archived=false`);
    // Secuencial a propósito: ClickUp limita a ~100 pedidos por minuto.
    const carpetas: CarpetaClickUp[] = [];
    for (const f of folders) {
      const listas: ListaClickUp[] = [];
      for (const l of f.lists) listas.push(await tareasDeLista(l));
      carpetas.push({ id: f.id, name: f.name, lists: listas });
    }
    const sueltas: ListaClickUp[] = [];
    for (const l of lists) sueltas.push(await tareasDeLista(l));
    resultado.spaces.push({ id: s.id, name: s.name, folders: carpetas, lists: sueltas });
  }
  return resultado;
}
