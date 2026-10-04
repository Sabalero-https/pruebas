import { crearDb, type Db } from "@/lib/db";
import type { Actor } from "@/lib/servicios/comun";
import { configuracionInicial, crearColaborador } from "@/lib/servicios/cuentas";
import { crearCliente } from "@/lib/servicios/catalogo";
import { catalogos } from "@/lib/servicios/consultas";

export async function entorno() {
  const db: Db = await crearDb({ memoria: true });
  const adminFila = await configuracionInicial(db, { nombre: "Ana Admin", email: "Ana@Demo.com ", password: "clave-segura" });
  const admin: Actor = { tipo: "colaborador", id: adminFila.id, nombre: adminFila.nombre, rol: "admin" };
  const { colaborador: brunoFila } = await crearColaborador(db, { nombre: "Bruno Pérez", email: "bruno@demo.com" }, admin);
  const bruno: Actor = { tipo: "colaborador", id: brunoFila.id, nombre: brunoFila.nombre, rol: "miembro" };
  const cliente = await crearCliente(db, { nombre: "Flex Sports" }, admin);
  const cat = await catalogos(db);
  const area = (nombre: string) => cat.areas.find((a) => a.nombre === nombre)!;
  const interno = cat.clientes.find((c) => c.esInterno)!;
  return { db, admin, bruno, adminFila, brunoFila, cliente, interno, area };
}
