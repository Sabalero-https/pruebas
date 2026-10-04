CREATE TYPE "public"."estado_cliente" AS ENUM('activo', 'pausado', 'archivado');--> statement-breakpoint
CREATE TYPE "public"."estado_tarea" AS ENUM('backlog', 'por_hacer', 'en_curso', 'en_revision', 'esperando_cliente', 'hecho');--> statement-breakpoint
CREATE TYPE "public"."frecuencia" AS ENUM('diaria_habil', 'semanal', 'mensual');--> statement-breakpoint
CREATE TYPE "public"."prioridad" AS ENUM('urgente', 'alta', 'normal', 'baja');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('admin', 'miembro');--> statement-breakpoint
CREATE TABLE "actividad" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tarea_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"campo" text NOT NULL,
	"antes" text,
	"despues" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"nombre_clave" text NOT NULL,
	"slug" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"nombre_clave" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"estado" "estado_cliente" DEFAULT 'activo' NOT NULL,
	"es_interno" boolean DEFAULT false NOT NULL,
	"responsable_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colaboradores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"rol" "rol_usuario" DEFAULT 'miembro' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"invitacion_hash" text,
	"invitacion_expira" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comentarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarea_id" uuid NOT NULL,
	"autor_id" uuid,
	"autor_nombre" text NOT NULL,
	"cuerpo" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reglas_recurrentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descripcion" text,
	"cliente_id" uuid NOT NULL,
	"area_id" uuid,
	"responsable_id" uuid,
	"prioridad" "prioridad" DEFAULT 'normal' NOT NULL,
	"frecuencia" "frecuencia" NOT NULL,
	"dia_semana" integer,
	"dia_mes" integer,
	"dias_para_vencer" integer DEFAULT 0 NOT NULL,
	"proxima_en" date NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"colaborador_id" uuid NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tareas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"descripcion" text,
	"cliente_id" uuid NOT NULL,
	"area_id" uuid,
	"responsable_id" uuid,
	"estado" "estado_tarea" DEFAULT 'por_hacer' NOT NULL,
	"prioridad" "prioridad" DEFAULT 'normal' NOT NULL,
	"vence_el" date,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"orden_kanban" double precision DEFAULT 0 NOT NULL,
	"origen" text DEFAULT 'manual' NOT NULL,
	"clave_externa" text,
	"regla_id" uuid,
	"fecha_programada" date,
	"version" integer DEFAULT 1 NOT NULL,
	"creado_por" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"completada_en" timestamp with time zone,
	"archivada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tokens_api" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"hash" text NOT NULL,
	"prefijo" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "actividad" ADD CONSTRAINT "actividad_tarea_id_tareas_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tareas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_responsable_id_colaboradores_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."colaboradores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_tarea_id_tareas_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tareas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_autor_id_colaboradores_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."colaboradores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_recurrentes" ADD CONSTRAINT "reglas_recurrentes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_recurrentes" ADD CONSTRAINT "reglas_recurrentes_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reglas_recurrentes" ADD CONSTRAINT "reglas_recurrentes_responsable_id_colaboradores_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."colaboradores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_colaborador_id_colaboradores_id_fk" FOREIGN KEY ("colaborador_id") REFERENCES "public"."colaboradores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_responsable_id_colaboradores_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."colaboradores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_regla_id_reglas_recurrentes_id_fk" FOREIGN KEY ("regla_id") REFERENCES "public"."reglas_recurrentes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actividad_tarea_idx" ON "actividad" USING btree ("tarea_id");--> statement-breakpoint
CREATE UNIQUE INDEX "areas_nombre_clave_uq" ON "areas" USING btree ("nombre_clave");--> statement-breakpoint
CREATE UNIQUE INDEX "areas_slug_uq" ON "areas" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_nombre_clave_uq" ON "clientes" USING btree ("nombre_clave");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_slug_uq" ON "clientes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "colaboradores_email_uq" ON "colaboradores" USING btree ("email");--> statement-breakpoint
CREATE INDEX "comentarios_tarea_idx" ON "comentarios" USING btree ("tarea_id");--> statement-breakpoint
CREATE INDEX "sesiones_colaborador_idx" ON "sesiones" USING btree ("colaborador_id");--> statement-breakpoint
CREATE INDEX "tareas_responsable_estado_idx" ON "tareas" USING btree ("responsable_id","estado");--> statement-breakpoint
CREATE INDEX "tareas_cliente_estado_idx" ON "tareas" USING btree ("cliente_id","estado");--> statement-breakpoint
CREATE INDEX "tareas_vence_idx" ON "tareas" USING btree ("vence_el");--> statement-breakpoint
CREATE UNIQUE INDEX "tareas_clave_externa_uq" ON "tareas" USING btree ("clave_externa");--> statement-breakpoint
CREATE UNIQUE INDEX "tareas_regla_fecha_uq" ON "tareas" USING btree ("regla_id","fecha_programada") WHERE "tareas"."regla_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_api_hash_uq" ON "tokens_api" USING btree ("hash");