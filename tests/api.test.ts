import { describe, expect, it } from "vitest";
import { interpretarCuerpoTarea } from "@/lib/api";
import { crearColaborador } from "@/lib/servicios/cuentas";
import { crearCliente } from "@/lib/servicios/catalogo";
import { entorno } from "./helpers";

describe("API: interpretación del cuerpo", () => {
  it("resuelve nombres sin importar mayúsculas/acentos y normaliza estado, prioridad y fecha", async () => {
    const { db, cliente, brunoFila, area } = await entorno();
    const { datos } = await interpretarCuerpoTarea(
      db,
      {
        titulo: "Grilla",
        cliente: "FLEX sports",
        area: "planificacion",
        responsable: "bruno@DEMO.com",
        estado: "Ready for review",
        prioridad: "high",
        vence_el: "2026-10-20T15:00:00-03:00",
      },
      false,
    );
    expect(datos).toMatchObject({
      clienteId: cliente.id,
      areaId: area("Planificación").id,
      responsableId: brunoFila.id,
      estado: "en_revision",
      prioridad: "alta",
      venceEl: "2026-10-20",
    });
  });

  it("rechaza campos desconocidos, falta de cliente y cambio de clave externa", async () => {
    const { db } = await entorno();
    await expect(interpretarCuerpoTarea(db, { titulo: "x", cliente: "Flex Sports", responsible: "x" }, false)).rejects.toThrow(
      /Campos desconocidos: responsible/,
    );
    await expect(interpretarCuerpoTarea(db, { titulo: "x" }, false)).rejects.toThrow(/cliente/);
    await expect(interpretarCuerpoTarea(db, { clave_externa: "otra" }, true)).rejects.toThrow(/no se puede cambiar/);
    await expect(interpretarCuerpoTarea(db, { cliente: null }, true)).rejects.toThrow(/cliente/);
    await expect(interpretarCuerpoTarea(db, { titulo: 5 }, true)).rejects.toThrow(/texto/);
  });

  it("avisa cuando un nombre es ambiguo en lugar de elegir uno al azar", async () => {
    const { db, admin } = await entorno();
    await crearColaborador(db, { nombre: "Bruno Gómez", email: "bruno.g@demo.com" }, admin);
    await expect(interpretarCuerpoTarea(db, { responsable: "bruno" }, true)).rejects.toMatchObject({ codigo: "ambiguo" });
    // Con el nombre completo sí se resuelve
    const { datos } = await interpretarCuerpoTarea(db, { responsable: "Bruno Gómez" }, true);
    expect(datos.responsableId).toBeTruthy();
    // Dos clientes casi iguales no pueden convivir, así que el nombre de un cliente nunca es ambiguo.
    await expect(crearCliente(db, { nombre: "Flex-Sports" }, admin)).rejects.toThrow(/Ya existe/);
  });

  it("null en área/responsable/fecha significa quitar el valor", async () => {
    const { db } = await entorno();
    const { datos } = await interpretarCuerpoTarea(db, { area: null, responsable: null, vence_el: null }, true);
    expect(datos).toEqual({ areaId: null, responsableId: null, venceEl: null });
  });
});
