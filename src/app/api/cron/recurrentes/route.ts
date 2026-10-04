import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { generarRecurrentes } from "@/lib/servicios/recurrentes";

// Para un cron externo (Vercel Cron manda "Authorization: Bearer $CRON_SECRET").
async function manejar(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "CRON_SECRET no está configurado" }, { status: 503 });
  const recibido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(await generarRecurrentes(await getDb()));
}

export const GET = manejar;
export const POST = manejar;
