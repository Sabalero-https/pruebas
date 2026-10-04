"use client";

import { useState } from "react";
import { accionGuardarRegla } from "@/app/acciones";
import type { ReglaRecurrente } from "@/lib/db/schema";
import { DIAS_SEMANA, PRIORIDADES } from "@/lib/dominio";
import { Formulario } from "./formularios";
import type { CatalogoUI } from "./tipos";

export function FormRegla({ catalogo, regla, alGuardar }: { catalogo: CatalogoUI; regla?: ReglaRecurrente; alGuardar?: () => void }) {
  const [frecuencia, setFrecuencia] = useState(regla?.frecuencia ?? "semanal");
  return (
    <Formulario accion={accionGuardarRegla} resetear={!regla} alGuardar={alGuardar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {regla && <input type="hidden" name="id" value={regla.id} />}
      <div className="sm:col-span-2">
        <label className="etiqueta">Título</label>
        <input name="titulo" required maxLength={300} defaultValue={regla?.titulo} className="campo" placeholder="Reporte mensual {mes}" />
        <p className="mt-1 text-[11px] text-slate-400">Podés usar {"{fecha}"}, {"{mes}"} o {"{anio}"} para que cada tarea tenga su fecha en el título.</p>
      </div>
      <div>
        <label className="etiqueta">Cliente</label>
        <select name="clienteId" required defaultValue={regla?.clienteId ?? ""} className="campo">
          <option value="" disabled>
            Elegí…
          </option>
          {catalogo.clientes
            .filter((c) => c.estado !== "archivado")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="etiqueta">Área</label>
        <select name="areaId" defaultValue={regla?.areaId ?? ""} className="campo">
          <option value="">Sin área</option>
          {catalogo.areas
            .filter((a) => a.activa)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="etiqueta">Responsable</label>
        <select name="responsableId" defaultValue={regla?.responsableId ?? ""} className="campo">
          <option value="">Sin asignar</option>
          {catalogo.colaboradores
            .filter((c) => c.activo)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="etiqueta">Frecuencia</label>
        <select name="frecuencia" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as typeof frecuencia)} className="campo">
          <option value="diaria_habil">Días hábiles (lun a vie)</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
        </select>
      </div>
      {frecuencia === "semanal" && (
        <div>
          <label className="etiqueta">Día de la semana</label>
          <select name="diaSemana" defaultValue={regla?.diaSemana ?? 1} className="campo">
            {DIAS_SEMANA.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}
      {frecuencia === "mensual" && (
        <div>
          <label className="etiqueta">Día del mes</label>
          <input name="diaMes" type="number" min={1} max={31} required defaultValue={regla?.diaMes ?? 1} className="campo" />
        </div>
      )}
      <div>
        <label className="etiqueta">Vence a los … días</label>
        <input name="diasParaVencer" type="number" min={0} max={60} defaultValue={regla?.diasParaVencer ?? 0} className="campo" />
      </div>
      <div>
        <label className="etiqueta">Prioridad</label>
        <select name="prioridad" defaultValue={regla?.prioridad ?? "normal"} className="campo">
          {PRIORIDADES.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <label className="etiqueta">Descripción (opcional)</label>
        <textarea name="descripcion" rows={2} defaultValue={regla?.descripcion ?? ""} className="campo" />
      </div>
    </Formulario>
  );
}
