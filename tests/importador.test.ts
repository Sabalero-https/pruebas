import { describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { comentarios, tareas } from "@/lib/db/schema";
import { aplicarImportacion, planificarImportacion, type ExportClickUp } from "@/lib/importador-clickup";
import { catalogos } from "@/lib/servicios/consultas";
import { entorno } from "./helpers";

// Estructura igual a la del ClickUp actual de la agencia (carpeta por cliente, listas por área,
// espacio "Sumo Growth" con listas sueltas) y los estados mezclados que tiene hoy.
const tarea = (id: string, name: string, extra: object = {}) => ({ id, name, url: `https://app.clickup.com/t/${id}`, ...extra });
const EXPORT: ExportClickUp = {
  spaces: [
    {
      id: "s1",
      name: "Clientes",
      folders: [
        {
          id: "f1",
          name: "Flex Sports",
          lists: [
            {
              id: "l1",
              name: "Pauta",
              tasks: [
                tarea("t1", "Optimización Semanal de Campañas", {
                  status: { status: "pendiente" },
                  priority: { priority: "normal" },
                  due_date: String(Date.UTC(2026, 9, 9, 3)),
                  assignees: [{ id: 1, username: "Bruno", email: "BRUNO@demo.com" }],
                }),
                tarea("t2", "Revisión de creativos", { status: { status: "ready for review" }, parent: "t1" }),
              ],
            },
            {
              id: "l2",
              name: "Planificacion",
              tasks: [
                tarea("t3", "Calendario Comercial", {
                  status: { status: "approved" },
                  assignees: [{ id: 9, username: "Externo", email: "otro@x.com" }],
                  tags: [{ name: "agente" }],
                  comentarios: [{ comment_text: "Aprobado por el cliente", user: { username: "Bruno" }, date: String(Date.UTC(2026, 8, 1)) }],
                }),
              ],
            },
            { id: "l3", name: "Desarrollo/conexiones", tasks: [tarea("t4", "Algo raro", { status: { status: "QA interno" }, priority: { priority: "urgent" } })] },
          ],
        },
      ],
      lists: [],
    },
    {
      id: "s2",
      name: "Sumo Growth",
      folders: [],
      lists: [{ id: "l4", name: "Finanzas", tasks: [tarea("t5", "  Facturación   mensual ", { status: { status: "complete" } })] }],
    },
  ],
};

describe("importación desde ClickUp", () => {
  it("planifica: clientes, áreas, estados, responsables y advertencias", async () => {
    const plan = planificarImportacion(EXPORT, {
      espacioInterno: "Sumo Growth",
      clienteInterno: "Sumo Growth (interno)",
      emailsConocidos: ["bruno@demo.com"],
      zona: "America/Argentina/Buenos_Aires",
    });
    expect(plan.clientes.sort()).toEqual(["Flex Sports", "Sumo Growth (interno)"]);
    const porId = Object.fromEntries(plan.tareas.map((t) => [t.claveExterna, t]));
    expect(porId["clickup:t1"]).toMatchObject({ estado: "por_hacer", venceEl: "2026-10-09", responsableEmail: "bruno@demo.com", area: "Pauta" });
    expect(porId["clickup:t2"].estado).toBe("en_revision");
    expect(porId["clickup:t2"].descripcion).toContain("Era subtarea de: Optimización Semanal de Campañas");
    expect(porId["clickup:t3"]).toMatchObject({ estado: "hecho", responsableEmail: null });
    expect(porId["clickup:t3"].descripcion).toContain("Externo");
    expect(porId["clickup:t4"]).toMatchObject({ estado: "por_hacer", prioridad: "urgente" });
    expect(porId["clickup:t5"]).toMatchObject({ cliente: "Sumo Growth (interno)", titulo: "Facturación mensual", estado: "hecho" });
    expect(plan.advertencias.join("\n")).toMatch(/QA interno/);
    expect(plan.advertencias.join("\n")).toMatch(/Externo/);
  });

  it("aplica sin duplicar áreas existentes (Planificacion = Planificación) y es repetible", async () => {
    const { db, interno } = await entorno();
    const plan = planificarImportacion(EXPORT, {
      espacioInterno: "Sumo Growth",
      clienteInterno: interno.nombre,
      emailsConocidos: ["bruno@demo.com"],
    });
    const actor = { tipo: "sistema" as const, nombre: "Importación ClickUp" };
    const r1 = await aplicarImportacion(db, plan, actor);
    expect(r1).toMatchObject({ creadas: 5, existentes: 0, clientesCreados: [], areasCreadas: [] });
    const r2 = await aplicarImportacion(db, plan, actor);
    expect(r2).toMatchObject({ creadas: 0, existentes: 5 });

    const cat = await catalogos(db);
    expect(cat.areas).toHaveLength(9);
    const [t1] = await db.select().from(tareas).where(eq(tareas.claveExterna, "clickup:t1"));
    const bruno = cat.colaboradores.find((c) => c.email === "bruno@demo.com")!;
    expect(t1).toMatchObject({ responsableId: bruno.id, origen: "migracion" });
    expect(t1.links).toEqual([{ titulo: "Ver en ClickUp", url: "https://app.clickup.com/t/t1" }]);
    const [t3] = await db.select().from(tareas).where(eq(tareas.claveExterna, "clickup:t3"));
    expect(t3.completadaEn).not.toBeNull();
    const cs = await db.select().from(comentarios).where(eq(comentarios.tareaId, t3.id)).orderBy(asc(comentarios.creadoEn));
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ autorNombre: "ClickUp · Bruno", cuerpo: "Aprobado por el cliente" });
    expect(cs[0].creadoEn.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
