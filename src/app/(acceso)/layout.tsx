export default function LayoutAcceso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-marca-500 text-lg font-bold text-white">S</span>
          <span className="text-lg font-semibold text-white">Sumo Tareas</span>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-xl">{children}</div>
      </div>
    </div>
  );
}
