import {
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const rolUsuario = pgEnum("rol_usuario", ["admin", "miembro"]);
export const estadoTarea = pgEnum("estado_tarea", [
  "backlog",
  "por_hacer",
  "en_curso",
  "en_revision",
  "esperando_cliente",
  "hecho",
]);
export const prioridad = pgEnum("prioridad", ["urgente", "alta", "normal", "baja"]);
export const estadoCliente = pgEnum("estado_cliente", ["activo", "pausado", "archivado"]);
export const frecuencia = pgEnum("frecuencia", ["diaria_habil", "semanal", "mensual"]);

export const colaboradores = pgTable(
  "colaboradores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    // Siempre en minúsculas y sin espacios: evita duplicados "Juan@x.com" vs "juan@x.com".
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    rol: rolUsuario("rol").notNull().default("miembro"),
    activo: boolean("activo").notNull().default(true),
    invitacionHash: text("invitacion_hash"),
    invitacionExpira: timestamp("invitacion_expira", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("colaboradores_email_uq").on(t.email)],
);

export const sesiones = pgTable(
  "sesiones",
  {
    // sha256 del token de la cookie: si se filtra la base, las sesiones no sirven.
    id: text("id").primaryKey(),
    colaboradorId: uuid("colaborador_id")
      .notNull()
      .references(() => colaboradores.id, { onDelete: "cascade" }),
    expiraEn: timestamp("expira_en", { withTimezone: true }).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sesiones_colaborador_idx").on(t.colaboradorId)],
);

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    // Nombre normalizado (minúsculas, sin acentos ni espacios dobles) para evitar duplicados.
    nombreClave: text("nombre_clave").notNull(),
    slug: text("slug").notNull(),
    color: text("color").notNull().default("#6366f1"),
    estado: estadoCliente("estado").notNull().default("activo"),
    esInterno: boolean("es_interno").notNull().default(false),
    responsableId: uuid("responsable_id").references(() => colaboradores.id, { onDelete: "set null" }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("clientes_nombre_clave_uq").on(t.nombreClave),
    uniqueIndex("clientes_slug_uq").on(t.slug),
  ],
);

export const areas = pgTable(
  "areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    nombreClave: text("nombre_clave").notNull(),
    slug: text("slug").notNull(),
    orden: integer("orden").notNull().default(0),
    activa: boolean("activa").notNull().default(true),
  },
  (t) => [
    uniqueIndex("areas_nombre_clave_uq").on(t.nombreClave),
    uniqueIndex("areas_slug_uq").on(t.slug),
  ],
);

export type Link = { titulo: string; url: string };

export const reglasRecurrentes = pgTable("reglas_recurrentes", {
  id: uuid("id").primaryKey().defaultRandom(),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion"),
  clienteId: uuid("cliente_id")
    .notNull()
    .references(() => clientes.id),
  areaId: uuid("area_id").references(() => areas.id, { onDelete: "set null" }),
  responsableId: uuid("responsable_id").references(() => colaboradores.id, { onDelete: "set null" }),
  prioridad: prioridad("prioridad").notNull().default("normal"),
  frecuencia: frecuencia("frecuencia").notNull(),
  // 1 = lunes ... 7 = domingo (solo semanal)
  diaSemana: integer("dia_semana"),
  // 1..31 (solo mensual). Si el mes no tiene ese día, se usa el último día del mes.
  diaMes: integer("dia_mes"),
  diasParaVencer: integer("dias_para_vencer").notNull().default(0),
  proximaEn: date("proxima_en", { mode: "string" }).notNull(),
  activa: boolean("activa").notNull().default(true),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const tareas = pgTable(
  "tareas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titulo: text("titulo").notNull(),
    descripcion: text("descripcion"),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    areaId: uuid("area_id").references(() => areas.id, { onDelete: "set null" }),
    responsableId: uuid("responsable_id").references(() => colaboradores.id, { onDelete: "set null" }),
    estado: estadoTarea("estado").notNull().default("por_hacer"),
    prioridad: prioridad("prioridad").notNull().default("normal"),
    venceEl: date("vence_el", { mode: "string" }),
    links: jsonb("links").$type<Link[]>().notNull().default([]),
    ordenKanban: doublePrecision("orden_kanban").notNull().default(0),
    origen: text("origen").notNull().default("manual"),
    // Clave única que manda un agente/importador para que reintentos no dupliquen tareas.
    claveExterna: text("clave_externa"),
    reglaId: uuid("regla_id").references(() => reglasRecurrentes.id, { onDelete: "set null" }),
    fechaProgramada: date("fecha_programada", { mode: "string" }),
    // Se incrementa en cada cambio: permite detectar ediciones simultáneas.
    version: integer("version").notNull().default(1),
    creadoPor: text("creado_por").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
    completadaEn: timestamp("completada_en", { withTimezone: true }),
    archivadaEn: timestamp("archivada_en", { withTimezone: true }),
  },
  (t) => [
    index("tareas_responsable_estado_idx").on(t.responsableId, t.estado),
    index("tareas_cliente_estado_idx").on(t.clienteId, t.estado),
    index("tareas_vence_idx").on(t.venceEl),
    uniqueIndex("tareas_clave_externa_uq").on(t.claveExterna),
    // Una regla recurrente genera como máximo una tarea por fecha, aunque el cron corra dos veces.
    uniqueIndex("tareas_regla_fecha_uq")
      .on(t.reglaId, t.fechaProgramada)
      .where(sql`${t.reglaId} is not null`),
  ],
);

export const comentarios = pgTable(
  "comentarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tareaId: uuid("tarea_id")
      .notNull()
      .references(() => tareas.id, { onDelete: "cascade" }),
    autorId: uuid("autor_id").references(() => colaboradores.id, { onDelete: "set null" }),
    // Nombre visible del autor (colaborador o agente). Se guarda para que no se pierda si se borra el usuario.
    autorNombre: text("autor_nombre").notNull(),
    cuerpo: text("cuerpo").notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comentarios_tarea_idx").on(t.tareaId)],
);

export const actividad = pgTable(
  "actividad",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tareaId: uuid("tarea_id")
      .notNull()
      .references(() => tareas.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    campo: text("campo").notNull(),
    antes: text("antes"),
    despues: text("despues"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("actividad_tarea_idx").on(t.tareaId)],
);

export const tokensApi = pgTable(
  "tokens_api",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    hash: text("hash").notNull(),
    prefijo: text("prefijo").notNull(),
    activo: boolean("activo").notNull().default(true),
    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    ultimoUso: timestamp("ultimo_uso", { withTimezone: true }),
  },
  (t) => [uniqueIndex("tokens_api_hash_uq").on(t.hash)],
);

export type Colaborador = typeof colaboradores.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type Tarea = typeof tareas.$inferSelect;
export type Comentario = typeof comentarios.$inferSelect;
export type Actividad = typeof actividad.$inferSelect;
export type ReglaRecurrente = typeof reglasRecurrentes.$inferSelect;
export type TokenApi = typeof tokensApi.$inferSelect;
export type EstadoTarea = (typeof estadoTarea.enumValues)[number];
export type Prioridad = (typeof prioridad.enumValues)[number];
export type EstadoCliente = (typeof estadoCliente.enumValues)[number];
export type Frecuencia = (typeof frecuencia.enumValues)[number];
export type Rol = (typeof rolUsuario.enumValues)[number];
