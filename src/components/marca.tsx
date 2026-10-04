import { cx } from "./ui";

/**
 * Wordmark de Sumo Growth dibujado como texto (regla de marca: no usar PNG en piezas generadas):
 * SUMO + GROWTH + recuadro con borde para el sello 成長 ("crecimiento").
 * Variantes aprobadas según el fondo:
 *  - oscuro (#111111): wordmark blanco, acento rojo, sello blanco
 *  - claro (#F2E8D9):  wordmark negro, acento rojo, sello rojo
 *  - rojo (#C62828):   wordmark blanco, acento blanco, sello blanco
 */
export function Wordmark({
  variante,
  tamano = "md",
  producto,
}: {
  variante: "oscuro" | "claro" | "rojo";
  tamano?: "sm" | "md" | "lg";
  producto?: string;
}) {
  const texto = variante === "claro" ? "text-tinta" : "text-white";
  const acento = variante === "rojo" ? "text-white" : "text-marca-600";
  const sello = variante === "claro" ? "border-marca-600 text-marca-600" : "border-white text-white";
  const escala =
    tamano === "lg"
      ? { palabra: "text-3xl", sello: "h-12 w-12 text-[17px] border-2", gap: "gap-3" }
      : tamano === "sm"
        ? { palabra: "text-[13px]", sello: "h-7 w-7 text-[10px] border-[1.5px]", gap: "gap-2" }
        : { palabra: "text-base", sello: "h-8 w-8 text-[12px] border-[1.5px]", gap: "gap-2" };

  return (
    <span className={cx("inline-flex items-center whitespace-nowrap", escala.gap)} aria-label="Sumo Growth">
      <span className={cx("font-marca font-extrabold uppercase leading-none tracking-[0.08em]", escala.palabra)}>
        <span className={texto}>Sumo</span> <span className={acento}>Growth</span>
      </span>
      <span
        aria-hidden
        className={cx("inline-flex shrink-0 items-center justify-center rounded-[3px] font-sello font-bold leading-none [writing-mode:vertical-rl]", escala.sello, sello)}
      >
        成長
      </span>
      {producto && (
        <span className={cx("border-l pl-2 text-xs font-medium uppercase tracking-widest", variante === "claro" ? "border-tinta/20 text-tinta/60" : "border-white/20 text-white/60")}>
          {producto}
        </span>
      )}
    </span>
  );
}

export const LEMA = "Fuerza. Foco. Crecimiento.";
