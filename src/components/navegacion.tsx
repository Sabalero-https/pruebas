"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cx } from "./ui";

const ITEMS = [
  { href: "/", etiqueta: "Mis tareas", icono: "☑" },
  { href: "/pendientes", etiqueta: "Pendientes", icono: "≡" },
  { href: "/equipo", etiqueta: "Por colaborador", icono: "◎" },
  { href: "/clientes", etiqueta: "Por cliente", icono: "▣" },
  { href: "/pendientes?vista=tablero", etiqueta: "Tablero", icono: "▥" },
  { href: "/recurrentes", etiqueta: "Recurrentes", icono: "↻" },
];

export function Navegacion({ esAdmin }: { esAdmin: boolean }) {
  const ruta = usePathname();
  const vista = useSearchParams().get("vista");
  const items = esAdmin ? [...ITEMS, { href: "/admin", etiqueta: "Administración", icono: "⚙" }] : ITEMS;
  const activo = (href: string) => {
    if (href === "/") return ruta === "/";
    if (href.startsWith("/pendientes")) return ruta === "/pendientes" && (vista === "tablero") === href.includes("tablero");
    return ruta === href || ruta.startsWith(href + "/");
  };
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cx(
            "flex shrink-0 items-center gap-2.5 rounded-md border-l-2 px-2.5 py-1.5 text-sm transition",
            activo(i.href)
              ? "border-marca-600 bg-white/10 font-semibold text-white"
              : "border-transparent text-stone-300 hover:bg-white/5 hover:text-white",
          )}
        >
          <span className="w-4 text-center text-stone-400" aria-hidden>
            {i.icono}
          </span>
          {i.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
