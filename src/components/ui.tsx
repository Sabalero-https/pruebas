import Link from "next/link";
import type { EstadoTarea, Prioridad } from "@/lib/db/schema";
import { clasificarVencimiento, etiquetaEstado, etiquetaPrioridad, formatearFecha } from "@/lib/dominio";

export function cx(...clases: (string | false | null | undefined)[]) {
  return clases.filter(Boolean).join(" ");
}

export const COLOR_ESTADO: Record<EstadoTarea, string> = {
  backlog: "bg-stone-100 text-stone-600 ring-stone-200",
  por_hacer: "bg-white text-tinta ring-tinta/20",
  en_curso: "bg-sky-50 text-sky-800 ring-sky-200",
  en_revision: "bg-amber-50 text-amber-800 ring-amber-200",
  esperando_cliente: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  hecho: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const PUNTO_ESTADO: Record<EstadoTarea, string> = {
  backlog: "bg-stone-400",
  por_hacer: "bg-tinta",
  en_curso: "bg-sky-600",
  en_revision: "bg-amber-500",
  esperando_cliente: "bg-fuchsia-500",
  hecho: "bg-emerald-500",
};

export const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  urgente: "text-red-700 bg-red-50 ring-red-200",
  alta: "text-orange-700 bg-orange-50 ring-orange-200",
  normal: "text-stone-600 bg-stone-50 ring-stone-200",
  baja: "text-stone-500 bg-white ring-stone-200",
};

export function InsigniaEstado({ estado }: { estado: EstadoTarea }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", COLOR_ESTADO[estado])}>
      <span className={cx("h-1.5 w-1.5 rounded-full", PUNTO_ESTADO[estado])} />
      {etiquetaEstado(estado)}
    </span>
  );
}

export function InsigniaPrioridad({ prioridad, siempre = false }: { prioridad: Prioridad; siempre?: boolean }) {
  if (!siempre && (prioridad === "normal" || prioridad === "baja")) return null;
  return (
    <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset", COLOR_PRIORIDAD[prioridad])}>
      {etiquetaPrioridad(prioridad)}
    </span>
  );
}

export function TextoFecha({ fecha, hoy, cerrada = false }: { fecha: string | null; hoy: string; cerrada?: boolean }) {
  const tipo = clasificarVencimiento(fecha, hoy);
  const color = cerrada
    ? "text-stone-400"
    : tipo === "vencida"
      ? "text-red-600 font-medium"
      : tipo === "hoy"
        ? "text-amber-700 font-medium"
        : tipo === "sin_fecha"
          ? "text-stone-400"
          : "text-stone-600";
  return <span className={cx("text-xs whitespace-nowrap", color)}>{formatearFecha(fecha, hoy)}</span>;
}

export function ChipCliente({ nombre, color, href }: { nombre: string; color: string; href?: string }) {
  const contenido = (
    <>
      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="truncate">{nombre}</span>
    </>
  );
  const clase = "inline-flex max-w-[11rem] items-center gap-1.5 text-xs text-stone-600";
  return href ? (
    <Link href={href} className={cx(clase, "hover:text-stone-900 hover:underline")}>
      {contenido}
    </Link>
  ) : (
    <span className={clase}>{contenido}</span>
  );
}

const COLORES_AVATAR = ["bg-tinta", "bg-marca-600", "bg-amber-600", "bg-teal-700", "bg-stone-500", "bg-rose-900", "bg-emerald-700"];

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({ nombre, tamano = "md" }: { nombre: string | null; tamano?: "sm" | "md" | "lg" }) {
  const dims = tamano === "sm" ? "h-5 w-5 text-[10px]" : tamano === "lg" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  if (!nombre) {
    return (
      <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-stone-300 text-stone-400", dims)}>
        ?
      </span>
    );
  }
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", dims, COLORES_AVATAR[h % COLORES_AVATAR.length])}>
      {iniciales(nombre)}
    </span>
  );
}

export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-tinta">{titulo}</h1>
        {descripcion && <p className="mt-0.5 text-sm text-stone-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center">
      <p className="text-sm font-medium text-stone-700">{titulo}</p>
      {children && <div className="mt-1 text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export function Metrica({
  etiqueta,
  valor,
  href,
  tono = "neutro",
}: {
  etiqueta: string;
  valor: number;
  href?: string;
  tono?: "neutro" | "rojo" | "ambar" | "fucsia" | "gris";
}) {
  const color =
    valor === 0
      ? "text-stone-400"
      : tono === "rojo"
        ? "text-red-600"
        : tono === "ambar"
          ? "text-amber-600"
          : tono === "fucsia"
            ? "text-fuchsia-600"
            : tono === "gris"
              ? "text-stone-600"
              : "text-stone-900";
  const cuerpo = (
    <>
      <div className={cx("text-2xl font-semibold tabular-nums", color)}>{valor}</div>
      <div className="text-xs font-medium text-stone-500">{etiqueta}</div>
    </>
  );
  const clase = "tarjeta block px-4 py-3";
  return href ? (
    <Link href={href} className={cx(clase, "transition hover:border-marca-500 hover:shadow")}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}
