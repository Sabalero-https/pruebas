import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { actividad, tareas } from "@/lib/db/schema";
import { actualizarTarea, archivarTarea, comentar, crearTarea, restaurarTarea } from "@/lib/servicios/tareas";
import { listarTareas, resumenGeneral, resumenPorCliente, resumenPorColaborador } from "@/lib/servicios/consultas";
import { cambiarEstadoCliente } from "@/lib/servicios/catalogo";
import { editarArea } from "@/lib/servicios/catalogo";
import { desactivarColaborador } from "@/lib/servicios/cuentas";
import { entorno } from "./helpers";

describe("crear tareas", () => {
  it("limpia el título, aplica valores por defecto y registra la creación", async () => {
    const { db, bruno, cliente } = await entorno();
    const { tarea, creada } = await crearTarea(db, { titulo: "  Optimizar campañas  ", clienteId: cliente.id }, bruno);
    expect(creada).toBe(true);
    expect(tarea.titulo).toBe("Optimizar campañas");
    expect(tarea.estado).toBe("por_hacer");
    expect(tarea.prioridad).toBe("normal");
    expect(tarea.responsableId).toBeNull();
    const hist = await db.select().from(actividad).where(eq(actividad.tareaId, tarea.id));
    expect(hist.map((h) => h.campo)).toEqual(["creada"]);
  });

  it("exige título y cliente", async () => {
    const { db, bruno, cliente } = await entorno();
    await expect(crearTarea(db, { titulo: "   ", clienteId: cliente.id }, bruno)).rejects.toThrow(/título es obligatorio/);
    await expect(crearTarea(db, { titulo: "x", clienteId: "" }, bruno)).rejects.toThrow(/cliente/);
  });

  it("no permite asignar a alguien desactivado ni crear en un cliente archivado", async () => {
    const { db, admin, bruno, brunoFila, cliente, interno } = await entorno();
    await desactivarColaborador(db, brunoFila.id, null, admin);
    await expect(
      crearTarea(db, { titulo: "x", clienteId: interno.id, responsableId: brunoFila.id }, admin),
    ).rejects.toThrow(/desactivado/);
    await cambiarEstadoCliente(db, cliente.id, "archivado", admin);
    await expect(crearTarea(db, { titulo: "x", clienteId: cliente.id }, bruno)).rejects.toThrow(/archivado/);
  });

  it("no permite usar un área desactivada", async () => {
    const { db, admin, cliente, area } = await entorno();
    await editarArea(db, area("Finanzas").id, { activa: false }, admin);
    await expect(crearTarea(db, { titulo: "x", clienteId: cliente.id, areaId: area("Finanzas").id }, admin)).rejects.toThrow(
      /desactivada/,
    );
  });

  it("la clave externa evita duplicados cuando un agente reintenta", async () => {
    const { db, cliente } = await entorno();
    const agente = { tipo: "api" as const, id: "x", nombre: "Agente 2" };
    const datos = { titulo: "Grilla de contenidos: Noviembre", clienteId: cliente.id, claveExterna: "grilla-2026-11" };
    const [a, b] = await Promise.all([crearTarea(db, datos, agente), crearTarea(db, datos, agente)]);
    expect(a.tarea.id).toBe(b.tarea.id);
    expect([a.creada, b.creada].filter(Boolean)).toHaveLength(1);
    expect(a.tarea.origen).toBe("api");
    expect(a.tarea.creadoPor).toBe("API · Agente 2");
  });

  it("valida y deduplica links", async () => {
    const { db, bruno, cliente } = await entorno();
    const { tarea } = await crearTarea(
      db,
      {
        titulo: "x",
        clienteId: cliente.id,
        links: [
          { titulo: "", url: "https://drive.google.com/abc" },
          { titulo: "Repetido", url: "https://drive.google.com/abc" },
        ],
      },
      bruno,
    );
    expect(tarea.links).toEqual([{ titulo: "drive.google.com", url: "https://drive.google.com/abc" }]);
    await expect(
      crearTarea(db, { titulo: "x", clienteId: cliente.id, links: [{ titulo: "x", url: "javascript:alert(1)" }] }, bruno),
    ).rejects.toThrow(/http/);
  });
});

describe("actualizar tareas", () => {
  it("completada_en acompaña al estado: se marca al terminar y se limpia al reabrir", async () => {
    const { db, bruno, cliente } = await entorno();
    const { tarea } = await crearTarea(db, { titulo: "x", clienteId: cliente.id }, bruno);
    const hecha = await actualizarTarea(db, tarea.id, { estado: "hecho" }, bruno);
    expect(hecha.completadaEn).toBeInstanceOf(Date);
    const reabierta = await actualizarTarea(db, tarea.id, { estado: "en_curso" }, bruno);
    expect(reabierta.completadaEn).toBeNull();
    expect(reabierta.version).toBe(3);
  });

  it("guarda historial legible solo de lo que cambió", async () => {
    const { db, bruno, brunoFila, cliente } = await entorno();
    const { tarea } = await crearTarea(db, { titulo: "x", clienteId: cliente.id }, bruno);
    await actualizarTarea(db, tarea.id, { titulo: "x", responsableId: brunoFila.id, estado: "en_revision" }, bruno);
    const hist = await db.select().from(actividad).where(eq(actividad.tareaId, tarea.id));
    const cambios = hist.filter((h) => h.campo !== "creada").map((h) => [h.campo, h.antes, h.despues]);
    expect(cambios).toEqual(
      expect.arrayContaining([
        ["responsable", null, "Bruno Pérez"],
        ["estado", "Por hacer", "En revisión"],
      ]),
    );
    expect(cambios).toHaveLength(2);
  });

  it("sin cambios no incrementa la versión", async () => {
    const { db, bruno, cliente } = await entorno();
    const { tarea } = await crearTarea(db, { titulo: "x", clienteId: cliente.id }, bruno);
    const misma = await actualizarTarea(db, tarea.id, { titulo: "x", prioridad: "normal" }, bruno);
    expect(misma.version).toBe(1);
  });

  it("detecta ediciones simultáneas del texto", async () => {
    const { db, admin, bruno, cliente } = await entorno();
    const { tarea } = await crearTarea(db, { titulo: "x", clienteId: cliente.id }, bruno);
    // Ana y Bruno abren la tarea en la versión 1. Ana guarda primero.
    await actualizarTarea(db, tarea.id, { descripcion: "versión de Ana" }, admin, { versionEsperada: 1 });
    await expect(
      actualizarTarea(db, tarea.id, { descripcion: "versión de Bruno" }, bruno, { versionEsperada: 1 }),
    ).rejects.toThrow(/Otra persona/);
    // Un cambio puntual (estado) sí se aplica sobre la versión nueva.
    const t = await actualizarTarea(db, tarea.id, { estado: "en_curso" }, bruno);
    expect(t.descripcion).toBe("versión de Ana");
    expect(t.estado).toBe("en_curso");
  });

  it("cambios puntuales simultáneos se aplican todos, uno detrás de otro", async () => {
    const { db, admin, bruno, brunoFila, cliente } = await entorno();
    const { tarea } = await crearTarea(db, { titulo: "x", clienteId: cliente.id }, bruno);
    const resultados = await Promise.allSettled([
      actualizarTarea(db, tarea.id, { estado: "en_curso" }, bruno),
      actualizarTarea(db, tarea.id, { prioridad: "urgente" }, admin),
      actualizarTarea(db, tarea.id, { responsableId: brunoFila.id }, admin),
      actualizarTarea(db, tarea.id, { venceEl: "2026-10-09" }, bruno),
    ]);
    expect(resultados.every((r) => r.status === "fulfilled")).toBe(true);
    const [final] = await db.select().from(tareas).where(eq(tareas.id, tarea.id));
    expect(final).toMatchObject({ estado: "en_curso", prioridad: "urgente", responsableId: brunoFila.id, venceEl: "2026-10-09", version: 5 });
  });

  it("no deja editar tareas archivadas ni restaurarlas en un cliente archivado", async () => {
    const { db, admin, bruno, cliente } = await entorno();
    const { tarea } = await crearTarea(db, { titulo: "x", clienteId: cliente.id }, bruno);
    await archivarTarea(db, tarea.id, bruno);
    await expect(actualizarTarea(db, tarea.id, { estado: "hecho" }, bruno)).rejects.toThrow(/archivada/);
    await cambiarEstadoCliente(db, cliente.id, "archivado", admin);
    await expect(restaurarTarea(db, tarea.id, bruno)).rejects.toThrow(/archivado/);
  });

  it("comentarios: no vacíos y quedan con el autor", async () => {
    const { db, bruno, cliente } = await entorno();
    const { tarea } = await crearTarea(db, { titulo: "x", clienteId: cliente.id }, bruno);
    await expect(comentar(db, tarea.id, "   ", bruno)).rejects.toThrow(/obligatorio/);
    const c = await comentar(db, tarea.id, "Listo el borrador", bruno);
    expect(c.autorNombre).toBe("Bruno Pérez");
  });
});

describe("paneles", () => {
  it("filtra por vencimiento, responsable y sin asignar; excluye hechas y archivadas", async () => {
    const { db, bruno, brunoFila, cliente, interno } = await entorno();
    const hoy = "2026-10-07";
    const crear = (titulo: string, extra: object = {}) =>
      crearTarea(db, { titulo, clienteId: cliente.id, ...extra }, bruno).then((r) => r.tarea);
    await crear("vencida", { venceEl: "2026-10-01", responsableId: brunoFila.id });
    await crear("hoy", { venceEl: hoy });
    await crear("semana", { venceEl: "2026-10-10", estado: "en_revision" });
    await crear("sin fecha", { estado: "esperando_cliente" });
    const hecha = await crear("hecha", { venceEl: "2026-10-01" });
    await actualizarTarea(db, hecha.id, { estado: "hecho" }, bruno);
    const archivada = await crear("archivada");
    await archivarTarea(db, archivada.id, bruno);
    await crearTarea(db, { titulo: "interna", clienteId: interno.id, responsableId: brunoFila.id }, bruno);

    const titulos = async (f: Parameters<typeof listarTareas>[1]) =>
      (await listarTareas(db, { hoy, ...f })).map((t) => t.titulo).sort();

    expect(await titulos({ clienteIds: [cliente.id] })).toEqual(["hoy", "semana", "sin fecha", "vencida"]);
    expect(await titulos({ vencimiento: "vencida" })).toEqual(["vencida"]);
    expect(await titulos({ vencimiento: "semana" })).toEqual(["hoy", "semana"]);
    expect(await titulos({ responsables: ["sin"] })).toEqual(["hoy", "semana", "sin fecha"]);
    expect(await titulos({ responsables: [brunoFila.id] })).toEqual(["interna", "vencida"]);
    expect(await titulos({ busqueda: "SIN f" })).toEqual(["sin fecha"]);
    expect(await titulos({ busqueda: "100%" })).toEqual([]);
    expect(await titulos({ soloArchivadas: true })).toEqual(["archivada"]);

    const resumen = await resumenGeneral(db, hoy);
    expect(resumen).toMatchObject({ abiertas: 5, vencidas: 1, hoy: 1, sinAsignar: 3, enRevision: 1, esperandoCliente: 1 });
    const porCliente = await resumenPorCliente(db, hoy);
    expect(porCliente.find((c) => c.clienteId === cliente.id)).toMatchObject({ abiertas: 4, proximaEntrega: hoy });
    const porPersona = await resumenPorColaborador(db, hoy);
    expect(porPersona.find((p) => p.responsableId === brunoFila.id)).toMatchObject({ abiertas: 2, vencidas: 1 });
  });

  it("el orden por vencimiento deja las tareas sin fecha al final", async () => {
    const { db, bruno, cliente } = await entorno();
    await crearTarea(db, { titulo: "sin fecha", clienteId: cliente.id }, bruno);
    await crearTarea(db, { titulo: "tarde", clienteId: cliente.id, venceEl: "2026-12-01" }, bruno);
    await crearTarea(db, { titulo: "pronto", clienteId: cliente.id, venceEl: "2026-10-01", prioridad: "baja" }, bruno);
    const filas = await listarTareas(db, {});
    expect(filas.map((f) => f.titulo)).toEqual(["pronto", "tarde", "sin fecha"]);
    const tabla = await db.select().from(tareas);
    expect(tabla).toHaveLength(3);
  });
});
