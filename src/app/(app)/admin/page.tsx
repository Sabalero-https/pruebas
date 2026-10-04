import type { Metadata } from "next";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { tareas, tokensApi } from "@/lib/db/schema";
import { requerirAdmin } from "@/lib/sesion";
import { catalogos } from "@/lib/servicios/consultas";
import { COLORES_CLIENTE } from "@/lib/servicios/catalogo";
import {
  accionActivarArea,
  accionCrearColaborador,
  accionCrearToken,
  accionDesactivarColaborador,
  accionEditarColaborador,
  accionEliminarArea,
  accionEstadoCliente,
  accionGenerarLink,
  accionGuardarArea,
  accionGuardarCliente,
  accionReactivarColaborador,
  accionRevocarToken,
} from "@/app/acciones";
import { BotonAccion, BotonLink, Formulario } from "@/components/formularios";
import { Avatar, EncabezadoPagina, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Administración" };

const SECCIONES = [
  { clave: "equipo", etiqueta: "Equipo" },
  { clave: "clientes", etiqueta: "Clientes" },
  { clave: "areas", etiqueta: "Áreas" },
  { clave: "api", etiqueta: "API y agentes" },
] as const;

export default async function Admin({ searchParams }: { searchParams: Promise<{ seccion?: string }> }) {
  const { usuario } = await requerirAdmin();
  const { seccion: s } = await searchParams;
  const seccion = SECCIONES.some((x) => x.clave === s) ? s! : "equipo";
  const db = await getDb();
  const cat = await catalogos(db);

  return (
    <>
      <EncabezadoPagina titulo="Administración" />
      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        {SECCIONES.map((x) => (
          <Link
            key={x.clave}
            href={`/admin?seccion=${x.clave}`}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              seccion === x.clave ? "border-marca-600 font-medium text-marca-700" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {x.etiqueta}
          </Link>
        ))}
      </nav>
      {seccion === "equipo" && <SeccionEquipo cat={cat} usuarioId={usuario.id} />}
      {seccion === "clientes" && <SeccionClientes cat={cat} />}
      {seccion === "areas" && <SeccionAreas cat={cat} />}
      {seccion === "api" && <SeccionApi />}
    </>
  );
}

type Cat = Awaited<ReturnType<typeof catalogos>>;

async function SeccionEquipo({ cat, usuarioId }: { cat: Cat; usuarioId: string }) {
  const db = await getDb();
  const abiertas = await db
    .select({ id: tareas.responsableId, n: sql<number>`count(*)::int` })
    .from(tareas)
    .where(sql`${tareas.estado} <> 'hecho' and ${tareas.archivadaEn} is null`)
    .groupBy(tareas.responsableId);
  const cuenta = new Map(abiertas.map((a) => [a.id, a.n]));
  const activos = cat.colaboradores.filter((c) => c.activo);

  return (
    <div className="space-y-6">
      <section className="tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold">Invitar colaborador</h2>
        <Formulario accion={accionCrearColaborador} boton="Crear e invitar" className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="etiqueta">Nombre</label>
            <input name="nombre" required className="campo" />
          </div>
          <div>
            <label className="etiqueta">Email</label>
            <input name="email" type="email" required className="campo" />
          </div>
          <div>
            <label className="etiqueta">Rol</label>
            <select name="rol" className="campo" defaultValue="miembro">
              <option value="miembro">Miembro</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </Formulario>
        <p className="mt-2 text-xs text-slate-500">
          Se genera un link (válido 7 días) para que la persona elija su contraseña. Mandáselo por WhatsApp o mail.
        </p>
      </section>

      <ul className="tarjeta divide-y divide-slate-100">
        {cat.colaboradores.map((c) => (
          <li key={c.id} className={cx("p-4", !c.activo && "bg-slate-50")}>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar nombre={c.nombre} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  {c.nombre}
                  {c.id === usuarioId && <span className="text-xs font-normal text-slate-400">(vos)</span>}
                  <span className={cx("rounded px-1.5 text-[11px] font-normal", c.rol === "admin" ? "bg-marca-100 text-marca-700" : "bg-slate-100 text-slate-600")}>
                    {c.rol === "admin" ? "Admin" : "Miembro"}
                  </span>
                  {!c.activo ? (
                    <span className="rounded bg-slate-200 px-1.5 text-[11px] font-normal text-slate-600">Inactivo</span>
                  ) : c.pendiente ? (
                    <span className="rounded bg-amber-100 px-1.5 text-[11px] font-normal text-amber-800">Invitación pendiente</span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-500">
                  {c.email} · {cuenta.get(c.id) ?? 0} tareas abiertas
                </div>
              </div>
              {c.activo ? (
                <BotonLink accion={accionGenerarLink.bind(null, c.id)}>{c.pendiente ? "Nuevo link de invitación" : "Link para cambiar contraseña"}</BotonLink>
              ) : (
                <BotonAccion accion={accionReactivarColaborador.bind(null, c.id)} className="btn-secundario text-xs" exito="Reactivado">
                  Reactivar
                </BotonAccion>
              )}
            </div>
            {c.activo && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-marca-700">Editar / desactivar</summary>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <Formulario accion={accionEditarColaborador} resetear={false} className="grid gap-2 sm:grid-cols-3">
                    <input type="hidden" name="id" value={c.id} />
                    <div>
                      <label className="etiqueta">Nombre</label>
                      <input name="nombre" defaultValue={c.nombre} required className="campo" />
                    </div>
                    <div>
                      <label className="etiqueta">Email</label>
                      <input name="email" type="email" defaultValue={c.email} required className="campo" />
                    </div>
                    <div>
                      <label className="etiqueta">Rol</label>
                      <select name="rol" defaultValue={c.rol} className="campo">
                        <option value="miembro">Miembro</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </Formulario>
                  {c.id !== usuarioId && (
                    <Formulario accion={accionDesactivarColaborador} boton="Desactivar" className="flex flex-wrap items-end gap-2 rounded-md border border-red-100 bg-red-50/50 p-3">
                      <input type="hidden" name="id" value={c.id} />
                      <div className="min-w-48 flex-1">
                        <label className="etiqueta">Pasar sus {cuenta.get(c.id) ?? 0} tareas abiertas, recurrentes y cuentas a</label>
                        <select name="reasignarA" className="campo" defaultValue="">
                          <option value="">Dejarlas sin asignar</option>
                          {activos
                            .filter((a) => a.id !== c.id)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nombre}
                              </option>
                            ))}
                        </select>
                      </div>
                    </Formulario>
                  )}
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeccionClientes({ cat }: { cat: Cat }) {
  const activos = cat.colaboradores.filter((c) => c.activo);
  const camposCliente = (c?: Cat["clientes"][number]) => (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="sm:col-span-2">
        <label className="etiqueta">Nombre</label>
        <input name="nombre" required defaultValue={c?.nombre} className="campo" />
      </div>
      <div>
        <label className="etiqueta">Color</label>
        <select name="color" defaultValue={c?.color ?? ""} className="campo">
          {!c && <option value="">Automático</option>}
          {[...new Set([...(c ? [c.color] : []), ...COLORES_CLIENTE])].map((color) => (
            <option key={color} value={color} style={{ color }}>
              ■ {color}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiqueta">Responsable de cuenta</label>
        <select name="responsableId" defaultValue={c?.responsableId ?? ""} className="campo">
          <option value="">Sin asignar</option>
          {activos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <section className="tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold">Nuevo cliente</h2>
        <Formulario accion={accionGuardarCliente} boton="Crear cliente" className="grid gap-3 sm:grid-cols-5">
          {camposCliente()}
        </Formulario>
      </section>
      <ul className="tarjeta divide-y divide-slate-100">
        {cat.clientes.map((c) => (
          <li key={c.id} className={cx("p-4", c.estado === "archivado" && "bg-slate-50")}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="h-3 w-3 rounded" style={{ backgroundColor: c.color }} />
              <Link href={`/clientes/${c.slug}`} className="flex-1 text-sm font-medium text-slate-800 hover:underline">
                {c.nombre}
                {c.esInterno && <span className="ml-2 text-xs font-normal text-slate-400">interno</span>}
              </Link>
              <span className="text-xs text-slate-500">{c.estado === "activo" ? "Activo" : c.estado === "pausado" ? "Pausado" : "Archivado"}</span>
              {c.estado !== "activo" && (
                <BotonAccion accion={accionEstadoCliente.bind(null, c.id, "activo")} className="btn-fantasma text-xs" exito="Cliente activo">
                  Activar
                </BotonAccion>
              )}
              {c.estado === "activo" && !c.esInterno && (
                <BotonAccion accion={accionEstadoCliente.bind(null, c.id, "pausado")} className="btn-fantasma text-xs" exito="Cliente pausado">
                  Pausar
                </BotonAccion>
              )}
              {c.estado !== "archivado" && !c.esInterno && (
                <BotonAccion
                  accion={accionEstadoCliente.bind(null, c.id, "archivado")}
                  confirmar={`¿Archivar ${c.nombre}? Se apagan sus tareas recurrentes.`}
                  className="btn-fantasma text-xs text-red-600"
                  exito="Cliente archivado"
                >
                  Archivar
                </BotonAccion>
              )}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-marca-700">Editar</summary>
              <Formulario accion={accionGuardarCliente} resetear={false} className="mt-3 grid gap-3 sm:grid-cols-5">
                {camposCliente(c)}
              </Formulario>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeccionAreas({ cat }: { cat: Cat }) {
  return (
    <div className="space-y-6">
      <section className="tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold">Nueva área</h2>
        <Formulario accion={accionGuardarArea} boton="Crear área" className="flex flex-wrap gap-3">
          <input name="nombre" required placeholder="Ej: SEO" className="campo max-w-xs" />
        </Formulario>
      </section>
      <ul className="tarjeta divide-y divide-slate-100">
        {cat.areas.map((a) => (
          <li key={a.id} className={cx("flex flex-wrap items-end gap-3 p-3", !a.activa && "bg-slate-50")}>
            <Formulario accion={accionGuardarArea} resetear={false} className="flex flex-1 flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={a.id} />
              <div className="min-w-48 flex-1">
                <label className="etiqueta">Nombre {a.activa ? "" : "(desactivada)"}</label>
                <input name="nombre" defaultValue={a.nombre} required className="campo" />
              </div>
              <div className="w-20">
                <label className="etiqueta">Orden</label>
                <input name="orden" type="number" defaultValue={a.orden} className="campo" />
              </div>
            </Formulario>
            <BotonAccion accion={accionActivarArea.bind(null, a.id, !a.activa)} className="btn-fantasma text-xs">
              {a.activa ? "Desactivar" : "Activar"}
            </BotonAccion>
            <BotonAccion accion={accionEliminarArea.bind(null, a.id)} confirmar={`¿Eliminar el área ${a.nombre}?`} className="btn-fantasma text-xs text-red-600" exito="Área eliminada">
              Eliminar
            </BotonAccion>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function SeccionApi() {
  const db = await getDb();
  const tokens = await db.select().from(tokensApi).orderBy(desc(tokensApi.creadoEn));
  const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires" });
  return (
    <div className="space-y-6">
      <section className="tarjeta p-4">
        <h2 className="mb-1 text-sm font-semibold">Nuevo token</h2>
        <p className="mb-3 text-xs text-slate-500">Creá un token por agente o integración, así se puede revocar uno sin afectar a los demás.</p>
        <Formulario accion={accionCrearToken} boton="Crear token" className="flex flex-wrap gap-3">
          <input name="nombre" required placeholder="Ej: Agente 2 — Grilla de contenidos" className="campo max-w-sm" />
        </Formulario>
      </section>
      <ul className="tarjeta divide-y divide-slate-100">
        {tokens.length === 0 && <li className="p-4 text-sm text-slate-500">Todavía no hay tokens.</li>}
        {tokens.map((t) => (
          <li key={t.id} className={cx("flex flex-wrap items-center gap-3 p-3 text-sm", !t.activo && "opacity-50")}>
            <span className="flex-1 font-medium text-slate-800">{t.nombre}</span>
            <code className="text-xs text-slate-500">{t.prefijo}…</code>
            <span className="text-xs text-slate-500">{t.ultimoUso ? `Último uso: ${fecha.format(t.ultimoUso)}` : "Sin usar"}</span>
            {t.activo ? (
              <BotonAccion accion={accionRevocarToken.bind(null, t.id)} confirmar={`¿Revocar "${t.nombre}"? El agente deja de poder usar la API.`} className="btn-fantasma text-xs text-red-600" exito="Token revocado">
                Revocar
              </BotonAccion>
            ) : (
              <span className="text-xs text-slate-500">Revocado</span>
            )}
          </li>
        ))}
      </ul>
      <section className="tarjeta p-4 text-sm text-slate-700">
        <h2 className="mb-2 text-sm font-semibold">Cómo lo usa un agente</h2>
        <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{`curl -X POST $APP_URL/api/v1/tareas \\
  -H "Authorization: Bearer sg_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "titulo": "Grilla de contenidos — Noviembre 2026",
    "cliente": "Flex Sports",
    "area": "Planificación",
    "estado": "en revisión",
    "vence_el": "2026-10-28",
    "clave_externa": "agente2:grilla:2026-11"
  }'`}</pre>
        <p className="mt-2 text-xs text-slate-500">
          Cliente, área y responsable aceptan id, slug, nombre o email. Con <code>clave_externa</code> un reintento devuelve la misma tarea en vez de duplicarla.
          La referencia completa está en <code>docs/api.md</code>.
        </p>
      </section>
    </div>
  );
}
