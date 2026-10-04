import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { clientes, reglasRecurrentes, tareas } from "@/lib/db/schema";
import {
  aceptarInvitacion,
  autenticarTokenApi,
  buscarInvitacion,
  cambiarRol,
  configuracionInicial,
  crearColaborador,
  crearSesion,
  crearTokenApi,
  desactivarColaborador,
  editarColaborador,
  generarInvitacion,
  iniciarSesion,
  revocarTokenApi,
  validarSesion,
} from "@/lib/servicios/cuentas";
import { cambiarEstadoCliente, crearArea, crearCliente, editarArea, eliminarArea, editarCliente } from "@/lib/servicios/catalogo";
import { crearTarea } from "@/lib/servicios/tareas";
import { crearRegla } from "@/lib/servicios/recurrentes";
import { entorno } from "./helpers";

describe("configuración inicial y login", () => {
  it("crea admin, cliente interno y áreas; no se puede repetir", async () => {
    const { db, adminFila } = await entorno();
    expect(adminFila.email).toBe("ana@demo.com");
    await expect(
      configuracionInicial(db, { nombre: "Otro", email: "otro@demo.com", password: "12345678" }),
    ).rejects.toThrow(/ya está configurada/);
  });

  it("login sin distinguir mayúsculas en el email y con bloqueo por intentos", async () => {
    const { db } = await entorno();
    const { colaborador } = await iniciarSesion(db, " ANA@demo.com", "clave-segura");
    expect(colaborador.nombre).toBe("Ana Admin");
    for (let i = 0; i < 5; i++) await expect(iniciarSesion(db, "ana@demo.com", "mal")).rejects.toThrow(/incorrectos/);
    await expect(iniciarSesion(db, "ana@demo.com", "clave-segura")).rejects.toThrow(/Demasiados intentos/);
  });

  it("invitación: link de un solo uso, contraseña mínima y cierra sesiones viejas", async () => {
    const { db, admin, brunoFila } = await entorno();
    const token = await generarInvitacion(db, brunoFila.id, admin);
    expect(await buscarInvitacion(db, token)).not.toBeNull();
    await expect(aceptarInvitacion(db, token, "corta")).rejects.toThrow(/8 caracteres/);
    const { token: sesion } = await aceptarInvitacion(db, token, "bruno-1234");
    expect(await validarSesion(db, sesion)).not.toBeNull();
    await expect(aceptarInvitacion(db, token, "otra-clave")).rejects.toThrow(/no es válido/);
    // Reset de contraseña: la sesión anterior deja de valer
    const reset = await generarInvitacion(db, brunoFila.id, admin);
    await aceptarInvitacion(db, reset, "nueva-clave");
    expect(await validarSesion(db, sesion)).toBeNull();
  });
});

describe("colaboradores", () => {
  it("emails únicos sin importar mayúsculas", async () => {
    const { db, admin } = await entorno();
    await expect(crearColaborador(db, { nombre: "Bruno 2", email: "BRUNO@demo.com" }, admin)).rejects.toThrow(/Ya existe/);
    await expect(crearColaborador(db, { nombre: "X", email: "no-es-mail" }, admin)).rejects.toThrow(/Email inválido/);
    const { colaborador } = await crearColaborador(db, { nombre: "Carla", email: "carla@demo.com" }, admin);
    await expect(editarColaborador(db, colaborador.id, { email: "bruno@demo.com" }, admin)).rejects.toThrow(/Bruno/);
  });

  it("un miembro no puede hacer tareas de admin", async () => {
    const { db, bruno } = await entorno();
    await expect(crearColaborador(db, { nombre: "X", email: "x@demo.com" }, bruno)).rejects.toThrow(/admin/);
    await expect(crearCliente(db, { nombre: "X" }, bruno)).rejects.toThrow(/admin/);
  });

  it("siempre queda al menos un admin activo y nadie se desactiva a sí mismo", async () => {
    const { db, admin, adminFila } = await entorno();
    await expect(cambiarRol(db, adminFila.id, "miembro", admin)).rejects.toThrow(/al menos un admin/);
    await expect(desactivarColaborador(db, adminFila.id, null, admin)).rejects.toThrow(/vos mismo/);
  });

  it("desactivar reasigna tareas abiertas, recurrentes y cuentas; corta la sesión", async () => {
    const { db, admin, adminFila, bruno, brunoFila, cliente } = await entorno();
    await editarCliente(db, cliente.id, { responsableId: brunoFila.id }, admin);
    const abierta = await crearTarea(db, { titulo: "abierta", clienteId: cliente.id, responsableId: brunoFila.id }, bruno);
    const hecha = await crearTarea(
      db,
      { titulo: "hecha", clienteId: cliente.id, responsableId: brunoFila.id, estado: "hecho" },
      bruno,
    );
    const regla = await crearRegla(
      db,
      { titulo: "Forecast", clienteId: cliente.id, responsableId: brunoFila.id, frecuencia: "diaria_habil" },
      admin,
    );
    const { token } = await crearSesion(db, brunoFila.id);

    const { reasignadas } = await desactivarColaborador(db, brunoFila.id, adminFila.id, admin);
    expect(reasignadas).toBe(1);
    const [t1] = await db.select().from(tareas).where(eq(tareas.id, abierta.tarea.id));
    const [t2] = await db.select().from(tareas).where(eq(tareas.id, hecha.tarea.id));
    expect(t1.responsableId).toBe(adminFila.id);
    expect(t2.responsableId).toBe(brunoFila.id); // el historial de lo terminado no se toca
    const [r] = await db.select().from(reglasRecurrentes).where(eq(reglasRecurrentes.id, regla.id));
    expect(r.responsableId).toBe(adminFila.id);
    const [c] = await db.select().from(clientes).where(eq(clientes.id, cliente.id));
    expect(c.responsableId).toBe(adminFila.id);
    expect(await validarSesion(db, token)).toBeNull();
    await expect(iniciarSesion(db, "bruno@demo.com", "x")).rejects.toThrow();
  });
});

describe("clientes y áreas", () => {
  it("no duplica clientes con distinto formato y el slug no cambia al renombrar", async () => {
    const { db, admin, cliente } = await entorno();
    await expect(crearCliente(db, { nombre: "  flex   SPORTS " }, admin)).rejects.toThrow(/Ya existe/);
    await expect(crearCliente(db, { nombre: "Flex-Sports" }, admin)).rejects.toThrow(/Ya existe/);
    const renombrado = await editarCliente(db, cliente.id, { nombre: "Flex Sports Argentina" }, admin);
    expect(renombrado.slug).toBe("flex-sports");
    const otro = await crearCliente(db, { nombre: "Flex Sports" }, admin);
    expect(otro.slug).toBe("flex-sports-2");
  });

  it("no se archiva un cliente con tareas abiertas; al archivar se apagan sus recurrentes", async () => {
    const { db, admin, bruno, cliente, interno } = await entorno();
    const { tarea } = await crearTarea(db, { titulo: "abierta", clienteId: cliente.id }, bruno);
    const regla = await crearRegla(db, { titulo: "R", clienteId: cliente.id, frecuencia: "diaria_habil" }, admin);
    await expect(cambiarEstadoCliente(db, cliente.id, "archivado", admin)).rejects.toThrow(/1 tarea/);
    await db.update(tareas).set({ estado: "hecho" }).where(eq(tareas.id, tarea.id));
    await cambiarEstadoCliente(db, cliente.id, "archivado", admin);
    const [r] = await db.select().from(reglasRecurrentes).where(eq(reglasRecurrentes.id, regla.id));
    expect(r.activa).toBe(false);
    await expect(cambiarEstadoCliente(db, interno.id, "archivado", admin)).rejects.toThrow(/interno/);
  });

  it("un área en uso no se borra, se desactiva", async () => {
    const { db, admin, bruno, cliente, area } = await entorno();
    await crearTarea(db, { titulo: "x", clienteId: cliente.id, areaId: area("Pauta").id }, bruno);
    await expect(eliminarArea(db, area("Pauta").id, admin)).rejects.toThrow(/Desactivala/);
    await expect(crearArea(db, "PAUTA", admin)).rejects.toThrow(/Ya existe/);
    const nueva = await crearArea(db, "SEO", admin);
    await eliminarArea(db, nueva.id, admin);
    await expect(editarArea(db, area("Finanzas").id, { nombre: "pauta" }, admin)).rejects.toThrow(/Ya existe/);
  });
});

describe("tokens de API", () => {
  it("solo funciona el token exacto y activo", async () => {
    const { db, admin } = await entorno();
    const { token, fila } = await crearTokenApi(db, "Agente 1", admin);
    expect(await autenticarTokenApi(db, `Bearer ${token}`)).toMatchObject({ tipo: "api", nombre: "Agente 1" });
    expect(await autenticarTokenApi(db, `Bearer ${token}x`)).toBeNull();
    expect(await autenticarTokenApi(db, token)).toBeNull();
    expect(await autenticarTokenApi(db, null)).toBeNull();
    await revocarTokenApi(db, fila.id, admin);
    expect(await autenticarTokenApi(db, `Bearer ${token}`)).toBeNull();
  });
});
