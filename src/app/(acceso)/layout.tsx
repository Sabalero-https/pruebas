import { LEMA, Wordmark } from "@/components/marca";

export default function LayoutAcceso({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-papel px-4 py-10">
      {/* Gran sol rojo de fondo (motivo de la dirección de arte de la marca) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-marca-600 sm:-right-24 sm:-top-24"
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-tinta" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Wordmark variante="claro" tamano="lg" />
          <p className="font-titulo text-xs font-semibold uppercase tracking-[0.3em] text-tinta/70">{LEMA}</p>
        </div>
        <div className="rounded-xl border border-tinta/10 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(17,17,17,0.35)]">{children}</div>
        <p className="mt-6 text-center text-xs text-tinta/50">Gestor de tareas interno</p>
      </div>
    </div>
  );
}
