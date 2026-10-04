// Genera las tareas recurrentes del día. Útil para un cron del sistema si no se usa el endpoint /api/cron/recurrentes.
import { getDb } from "@/lib/db";
import { generarRecurrentes } from "@/lib/servicios/recurrentes";

const resultado = await generarRecurrentes(await getDb());
console.log(`Tareas recurrentes: ${resultado.creadas} creadas, ${resultado.omitidas} omitidas`);
process.exit(0);
