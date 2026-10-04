// Reglas de negocio puras (sin base de datos): estados, prioridades, fechas y recurrencias.
import type { EstadoTarea, Frecuencia, Prioridad } from "./db/schema";

export class ErrorValidacion extends Error {
  constructor(
    mensaje: string,
    public codigo = "validacion",
    public detalles?: unknown,
  ) {
    super(mensaje);
    this.name = "ErrorValidacion";
  }
}

// ---------------------------------------------------------------- textos

/**
 * Clave para comparar nombres: minúsculas, sin acentos y sin signos.
 * "Flex Sports", "flex-sports" y "FLEX   SPORTS" son lo mismo; "Planificacion" = "Planificación".
 */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugificar(valor: string): string {
  return (
    normalizarTexto(valor)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sin-nombre"
  );
}

/** Limpia espacios de más en nombres visibles ("  Flex   Sports " → "Flex Sports"). */
export function limpiarNombre(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

export function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

export const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------- estados

export const ESTADOS: { valor: EstadoTarea; etiqueta: string; abierto: boolean }[] = [
  { valor: "backlog", etiqueta: "Backlog", abierto: true },
  { valor: "por_hacer", etiqueta: "Por hacer", abierto: true },
  { valor: "en_curso", etiqueta: "En curso", abierto: true },
  { valor: "en_revision", etiqueta: "En revisión", abierto: true },
  { valor: "esperando_cliente", etiqueta: "Esperando cliente", abierto: true },
  { valor: "hecho", etiqueta: "Hecho", abierto: false },
];

export const ESTADOS_ABIERTOS = ESTADOS.filter((e) => e.abierto).map((e) => e.valor);

export function etiquetaEstado(estado: EstadoTarea): string {
  return ESTADOS.find((e) => e.valor === estado)?.etiqueta ?? estado;
}

// Estados que se usaron en ClickUp y otras herramientas → estado estándar.
const ALIAS_ESTADO: Record<string, EstadoTarea> = {
  backlog: "backlog",
  idea: "backlog",
  ideas: "backlog",
  "por hacer": "por_hacer",
  "to do": "por_hacer",
  todo: "por_hacer",
  pendiente: "por_hacer",
  pendientes: "por_hacer",
  open: "por_hacer",
  abierta: "por_hacer",
  abierto: "por_hacer",
  "en curso": "en_curso",
  "en progreso": "en_curso",
  "in progress": "en_curso",
  doing: "en_curso",
  haciendo: "en_curso",
  "en revision": "en_revision",
  revision: "en_revision",
  review: "en_revision",
  "in review": "en_revision",
  "ready for review": "en_revision",
  "para revisar": "en_revision",
  "esperando cliente": "esperando_cliente",
  esperando: "esperando_cliente",
  waiting: "esperando_cliente",
  "waiting on client": "esperando_cliente",
  bloqueado: "esperando_cliente",
  bloqueada: "esperando_cliente",
  blocked: "esperando_cliente",
  "on hold": "esperando_cliente",
  hecho: "hecho",
  hecha: "hecho",
  done: "hecho",
  complete: "hecho",
  completed: "hecho",
  completa: "hecho",
  completada: "hecho",
  closed: "hecho",
  cerrada: "hecho",
  approved: "hecho",
  aprobado: "hecho",
  aprobada: "hecho",
  terminado: "hecho",
  terminada: "hecho",
  finalizado: "hecho",
  finalizada: "hecho",
};

/** Devuelve el estado estándar o null si no se reconoce. */
export function interpretarEstado(valor: string): EstadoTarea | null {
  return ALIAS_ESTADO[normalizarTexto(valor)] ?? null;
}

export function exigirEstado(valor: string): EstadoTarea {
  const estado = interpretarEstado(valor);
  if (!estado) {
    throw new ErrorValidacion(`Estado desconocido: "${valor}"`, "estado_invalido", {
      validos: ESTADOS.map((e) => e.valor),
    });
  }
  return estado;
}

// ---------------------------------------------------------------- prioridades

export const PRIORIDADES: { valor: Prioridad; etiqueta: string; peso: number }[] = [
  { valor: "urgente", etiqueta: "Urgente", peso: 0 },
  { valor: "alta", etiqueta: "Alta", peso: 1 },
  { valor: "normal", etiqueta: "Normal", peso: 2 },
  { valor: "baja", etiqueta: "Baja", peso: 3 },
];

export function etiquetaPrioridad(p: Prioridad): string {
  return PRIORIDADES.find((x) => x.valor === p)?.etiqueta ?? p;
}

const ALIAS_PRIORIDAD: Record<string, Prioridad> = {
  urgente: "urgente",
  urgent: "urgente",
  "1": "urgente",
  alta: "alta",
  high: "alta",
  "2": "alta",
  normal: "normal",
  media: "normal",
  medium: "normal",
  "3": "normal",
  baja: "baja",
  low: "baja",
  "4": "baja",
};

export function interpretarPrioridad(valor: string | number | null | undefined): Prioridad | null {
  if (valor === null || valor === undefined || valor === "") return null;
  return ALIAS_PRIORIDAD[normalizarTexto(String(valor))] ?? null;
}

export function exigirPrioridad(valor: string | number): Prioridad {
  const p = interpretarPrioridad(valor);
  if (!p) {
    throw new ErrorValidacion(`Prioridad desconocida: "${valor}"`, "prioridad_invalida", {
      validas: PRIORIDADES.map((x) => x.valor),
    });
  }
  return p;
}

// ---------------------------------------------------------------- fechas
// Las fechas de vencimiento son días calendario ("YYYY-MM-DD"), sin hora.
// "Hoy" se calcula en la zona horaria de la agencia, no en la del servidor (que suele ser UTC):
// a las 22 h en Buenos Aires, en UTC ya es mañana y una tarea de hoy figuraría como vencida.

export const ZONA_HORARIA = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires";

const REGEX_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function fechaEnZona(instante: Date, zona = ZONA_HORARIA): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

export function hoy(zona = ZONA_HORARIA, ahora = new Date()): string {
  return fechaEnZona(ahora, zona);
}

export function esFechaValida(valor: string): boolean {
  const m = REGEX_FECHA.exec(valor);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d;
}

function aDate(fecha: string): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

function deDate(f: Date): string {
  return f.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const f = aDate(fecha);
  f.setUTCDate(f.getUTCDate() + dias);
  return deDate(f);
}

/** 1 = lunes ... 7 = domingo */
export function diaSemanaIso(fecha: string): number {
  const d = aDate(fecha).getUTCDay();
  return d === 0 ? 7 : d;
}

export function finDeSemana(fecha: string): string {
  return sumarDias(fecha, 7 - diaSemanaIso(fecha));
}

export function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Acepta "YYYY-MM-DD", fecha-hora ISO, o epoch en milisegundos (formato de ClickUp).
 * Vacío → null. Cualquier otra cosa → error.
 */
export function interpretarFecha(valor: unknown, zona = ZONA_HORARIA): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new ErrorValidacion("Fecha inválida", "fecha_invalida");
    return fechaEnZona(new Date(valor), zona);
  }
  if (typeof valor !== "string") throw new ErrorValidacion("Fecha inválida", "fecha_invalida");
  const texto = valor.trim();
  if (texto === "") return null;
  if (REGEX_FECHA.test(texto)) {
    if (!esFechaValida(texto)) throw new ErrorValidacion(`La fecha ${texto} no existe`, "fecha_invalida");
    return texto;
  }
  if (/^\d{10,13}$/.test(texto)) {
    const n = Number(texto);
    return fechaEnZona(new Date(texto.length === 10 ? n * 1000 : n), zona);
  }
  const f = new Date(texto);
  if (Number.isNaN(f.getTime())) throw new ErrorValidacion(`Fecha inválida: "${texto}"`, "fecha_invalida");
  return fechaEnZona(f, zona);
}

export type Vencimiento = "vencida" | "hoy" | "semana" | "proxima" | "sin_fecha";

export const GRUPOS_VENCIMIENTO: { valor: Vencimiento; etiqueta: string }[] = [
  { valor: "vencida", etiqueta: "Vencidas" },
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "semana", etiqueta: "Esta semana" },
  { valor: "proxima", etiqueta: "Próximas" },
  { valor: "sin_fecha", etiqueta: "Sin fecha" },
];

export function clasificarVencimiento(venceEl: string | null, fechaHoy: string): Vencimiento {
  if (!venceEl) return "sin_fecha";
  if (venceEl < fechaHoy) return "vencida";
  if (venceEl === fechaHoy) return "hoy";
  if (venceEl <= finDeSemana(fechaHoy)) return "semana";
  return "proxima";
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

/** "Hoy", "Mañana", "Ayer", "vie 9 oct" o "9 oct 2027" si es de otro año. */
export function formatearFecha(fecha: string | null, fechaHoy: string): string {
  if (!fecha) return "Sin fecha";
  if (fecha === fechaHoy) return "Hoy";
  if (fecha === sumarDias(fechaHoy, 1)) return "Mañana";
  if (fecha === sumarDias(fechaHoy, -1)) return "Ayer";
  const [a, m, d] = fecha.split("-").map(Number);
  const base = `${d} ${MESES[m - 1]}`;
  if (String(a) !== fechaHoy.slice(0, 4)) return `${base} ${a}`;
  return `${DIAS[diaSemanaIso(fecha) - 1]} ${base}`;
}

// ---------------------------------------------------------------- recurrencias

export type ReglaFrecuencia = {
  frecuencia: Frecuencia;
  diaSemana?: number | null;
  diaMes?: number | null;
};

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function describirFrecuencia(r: ReglaFrecuencia): string {
  switch (r.frecuencia) {
    case "diaria_habil":
      return "Todos los días hábiles (lun a vie)";
    case "semanal":
      return `Todas las semanas, el ${DIAS_SEMANA[(r.diaSemana ?? 1) - 1].toLowerCase()}`;
    case "mensual":
      return r.diaMes && r.diaMes >= 29
        ? `Todos los meses, el día ${r.diaMes} (o el último día si el mes es más corto)`
        : `Todos los meses, el día ${r.diaMes}`;
  }
}

export function validarFrecuencia(r: ReglaFrecuencia): void {
  if (r.frecuencia === "semanal" && !(r.diaSemana && r.diaSemana >= 1 && r.diaSemana <= 7)) {
    throw new ErrorValidacion("Elegí el día de la semana (1 a 7)", "frecuencia_invalida");
  }
  if (r.frecuencia === "mensual" && !(r.diaMes && r.diaMes >= 1 && r.diaMes <= 31)) {
    throw new ErrorValidacion("Elegí el día del mes (1 a 31)", "frecuencia_invalida");
  }
}

export function esOcurrencia(r: ReglaFrecuencia, fecha: string): boolean {
  const dia = diaSemanaIso(fecha);
  switch (r.frecuencia) {
    case "diaria_habil":
      return dia <= 5;
    case "semanal":
      return dia === r.diaSemana;
    case "mensual": {
      const [a, m, d] = fecha.split("-").map(Number);
      const objetivo = Math.min(r.diaMes ?? 1, ultimoDiaDelMes(a, m));
      return d === objetivo;
    }
  }
}

/** Primera ocurrencia en `desde` o después. */
export function proximaOcurrencia(r: ReglaFrecuencia, desde: string): string {
  let f = desde;
  for (let i = 0; i < 400; i++) {
    if (esOcurrencia(r, f)) return f;
    f = sumarDias(f, 1);
  }
  throw new ErrorValidacion("La regla no tiene ocurrencias", "frecuencia_invalida");
}

/** Última ocurrencia en `hasta` o antes. */
export function ultimaOcurrencia(r: ReglaFrecuencia, hasta: string): string {
  let f = hasta;
  for (let i = 0; i < 400; i++) {
    if (esOcurrencia(r, f)) return f;
    f = sumarDias(f, -1);
  }
  throw new ErrorValidacion("La regla no tiene ocurrencias", "frecuencia_invalida");
}
