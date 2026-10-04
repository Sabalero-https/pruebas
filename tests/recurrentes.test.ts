import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reglasRecurrentes, tareas } from "@/lib/db/schema";
import { armarTitulo, cambiarActivaRegla, crearRegla, generarRecurrentes } from "@/lib/servicios/recurrentes";
import { cambiarEstadoCliente, editarArea } from "@/lib/servicios/catalogo";
import { desactivarColaborador } from "@/lib/servicios/cuentas";
import { entorno } from "./helpers";

describe("tareas recurrentes", () => {
  it("genera una sola vez por fecha aunque se ejecute varias veces en paralelo", async () => {
    const { db, admin, adminFila, cliente } = await entorno();
    const regla = await crearRegla(
      db,
      { titulo: "Daily Forecast {fecha}", clienteId: cliente.id, responsableId: adminFila.id, frecuencia: "diaria_habil", diasParaVencer: 0 },
      admin,
      "2026-10-05",
    );
    expect(regla.proximaEn).toBe("2026-10-05");
    await Promise.all([generarRecurrentes(db, "2026-10-05"), generarRecurrentes(db, "2026-10-05"), generarRecurrentes(db, "2026-10-05")]);
    const generadas = await db.select().from(tareas).where(eq(tareas.reglaId, regla.id));
    expect(generadas).toHaveLength(1);
    expect(generadas[0]).toMatchObject({ titulo: "Daily Forecast 05/10/2026", venceEl: "2026-10-05", origen: "recurrente" });
    const [r] = await db.select().from(reglasRecurrentes).where(eq(reglasRecurrentes.id, regla.id));
    expect(r.proximaEn).toBe("2026-10-06");
  });

  it("si estuvo apagado varios días, genera solo la más reciente", async () => {
    const { db, admin, cliente } = await entorno();
    const regla = await crearRegla(db, { titulo: "Daily", clienteId: cliente.id, frecuencia: "diaria_habil" }, admin, "2026-10-05");
    const { creadas } = await generarRecurrentes(db, "2026-10-09");
    expect(creadas).toBe(1);
    const generadas = await db.select().from(tareas).where(eq(tareas.reglaId, regla.id));
    expect(generadas.map((t) => t.fechaProgramada)).toEqual(["2026-10-09"]);
    const [r] = await db.select().from(reglasRecurrentes).where(eq(reglasRecurrentes.id, regla.id));
    expect(r.proximaEn).toBe("2026-10-12"); // viernes → lunes
  });

  it("cliente pausado: avanza sin crear; cliente archivado: apaga la regla", async () => {
    const { db, admin, cliente } = await entorno();
    const regla = await crearRegla(db, { titulo: "Semanal", clienteId: cliente.id, frecuencia: "semanal", diaSemana: 1 }, admin, "2026-10-05");
    await cambiarEstadoCliente(db, cliente.id, "pausado", admin);
    expect(await generarRecurrentes(db, "2026-10-05")).toEqual({ creadas: 0, omitidas: 1 });
    await cambiarEstadoCliente(db, cliente.id, "activo", admin);
    expect(await generarRecurrentes(db, "2026-10-12")).toEqual({ creadas: 1, omitidas: 0 });
    await cambiarEstadoCliente(db, cliente.id, "archivado", admin).catch(() => null); // tiene una abierta
    await db.update(tareas).set({ estado: "hecho" });
    await cambiarEstadoCliente(db, cliente.id, "archivado", admin);
    const [r] = await db.select().from(reglasRecurrentes).where(eq(reglasRecurrentes.id, regla.id));
    expect(r.activa).toBe(false);
    await expect(cambiarActivaRegla(db, regla.id, true, admin)).rejects.toThrow(/archivado/);
  });

  it("si el responsable se desactiva o el área se apaga, la tarea igual se crea (sin asignar / sin área)", async () => {
    const { db, admin, brunoFila, cliente, area } = await entorno();
    await crearRegla(
      db,
      { titulo: "Reporte {mes}", clienteId: cliente.id, responsableId: brunoFila.id, areaId: area("Entregables/Reportes").id, frecuencia: "mensual", diaMes: 31, diasParaVencer: 3 },
      admin,
      "2026-10-01",
    );
    // Desactivación directa en la base (simula un dato inconsistente previo, sin reasignación)
    await desactivarColaborador(db, brunoFila.id, null, admin);
    await editarArea(db, area("Entregables/Reportes").id, { activa: false }, admin);
    await generarRecurrentes(db, "2026-10-31");
    const [t] = await db.select().from(tareas);
    expect(t).toMatchObject({ titulo: "Reporte octubre 2026", responsableId: null, areaId: null, venceEl: "2026-11-03" });
  });

  it("al reactivar no genera las semanas en que estuvo pausada", async () => {
    const { db, admin, cliente } = await entorno();
    const regla = await crearRegla(db, { titulo: "S", clienteId: cliente.id, frecuencia: "semanal", diaSemana: 1 }, admin, "2026-09-01");
    await cambiarActivaRegla(db, regla.id, false, admin);
    const reactivada = await cambiarActivaRegla(db, regla.id, true, admin, "2026-10-07");
    expect(reactivada.proximaEn).toBe("2026-10-12");
  });

  it("valida la frecuencia", async () => {
    const { db, admin, cliente } = await entorno();
    await expect(crearRegla(db, { titulo: "x", clienteId: cliente.id, frecuencia: "semanal" }, admin)).rejects.toThrow(/día de la semana/);
    await expect(crearRegla(db, { titulo: "x", clienteId: cliente.id, frecuencia: "mensual", diaMes: 32 }, admin)).rejects.toThrow(/día del mes/);
  });

  it("arma títulos con fecha y mes", () => {
    expect(armarTitulo("Reporte {mes}", "2026-12-31")).toBe("Reporte diciembre 2026");
    expect(armarTitulo("Sin variables", "2026-12-31")).toBe("Sin variables");
  });
});
