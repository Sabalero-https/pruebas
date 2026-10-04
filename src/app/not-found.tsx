import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold text-stone-900">No encontramos lo que buscabas</h1>
      <p className="text-sm text-stone-500">Puede que se haya archivado, renombrado o que el link esté incompleto.</p>
      <Link href="/" className="btn-secundario">
        Volver a mis tareas
      </Link>
    </div>
  );
}
