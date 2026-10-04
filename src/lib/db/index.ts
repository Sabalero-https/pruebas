import path from "node:path";
import fs from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const carpetaMigraciones = path.join(process.cwd(), "drizzle");

/**
 * Crea una conexión. Sin DATABASE_URL usa PGlite (Postgres embebido) para que la app
 * funcione en local sin instalar nada. `memoria: true` se usa en los tests.
 */
export async function crearDb(opciones: { url?: string; memoria?: boolean; carpeta?: string } = {}): Promise<Db> {
  if (opciones.url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: opciones.url, max: 5 });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: carpetaMigraciones });
    return db as unknown as Db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  let cliente;
  if (opciones.memoria) {
    cliente = new PGlite();
  } else {
    const carpeta = opciones.carpeta ?? path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(carpeta, { recursive: true });
    tomarBloqueo(carpeta);
    cliente = new PGlite(carpeta);
  }
  const db = drizzle(cliente, { schema });
  await migrate(db, { migrationsFolder: carpetaMigraciones });
  return db as unknown as Db;
}

/**
 * PGlite guarda todo en una carpeta y NO soporta dos procesos abiertos a la vez (se corrompe).
 * Si la app y un script (demo, importación) intentan abrirla juntos, el segundo falla con un mensaje claro.
 */
function procesoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function tomarBloqueo(carpeta: string) {
  const archivo = path.join(carpeta, "..", "pglite.lock");
  let pid = 0;
  try {
    pid = Number(fs.readFileSync(archivo, "utf8"));
  } catch {}
  // Si quedó un lock de un proceso que ya no existe (ej. se cortó con Ctrl+C), se ignora.
  if (pid && pid !== process.pid && procesoVivo(pid)) {
    throw new Error(
      `La base local (${carpeta}) está abierta por otro proceso (pid ${pid}). ` +
        "Cerrá la app (npm run dev/start) antes de correr scripts, o usá DATABASE_URL con Postgres.",
    );
  }
  fs.writeFileSync(archivo, String(process.pid));
  process.once("exit", () => {
    try {
      if (fs.readFileSync(archivo, "utf8") === String(process.pid)) fs.unlinkSync(archivo);
    } catch {}
  });
}

// En desarrollo Next recarga módulos: guardamos la conexión en globalThis para no abrir una por recarga.
const global = globalThis as unknown as { __sumoDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!global.__sumoDb) {
    global.__sumoDb = crearDb({ url: process.env.DATABASE_URL || undefined }).catch((error) => {
      global.__sumoDb = undefined;
      throw error;
    });
  }
  return global.__sumoDb;
}

export { schema };
