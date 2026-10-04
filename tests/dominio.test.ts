import { describe, expect, it } from "vitest";
import {
  clasificarVencimiento,
  exigirEstado,
  fechaEnZona,
  formatearFecha,
  interpretarEstado,
  interpretarFecha,
  interpretarPrioridad,
  normalizarTexto,
  proximaOcurrencia,
  slugificar,
  ultimaOcurrencia,
} from "@/lib/dominio";

describe("estados heredados de ClickUp", () => {
  it.each([
    ["backlog", "backlog"],
    ["to do", "por_hacer"],
    ["Pendiente", "por_hacer"],
    ["ready for review", "en_revision"],
    ["approved", "hecho"],
    ["complete", "hecho"],
    ["DONE", "hecho"],
    ["en_curso", "en_curso"],
    ["En revisión", "en_revision"],
    ["esperando_cliente", "esperando_cliente"],
    ["blocked", "esperando_cliente"],
  ])("%s → %s", (entrada, esperado) => {
    expect(interpretarEstado(entrada)).toBe(esperado);
  });

  it("rechaza estados desconocidos", () => {
    expect(interpretarEstado("cualquiera")).toBeNull();
    expect(() => exigirEstado("cualquiera")).toThrow(/Estado desconocido/);
  });

  it("prioridades por nombre, inglés o número de ClickUp", () => {
    expect(interpretarPrioridad("urgent")).toBe("urgente");
    expect(interpretarPrioridad(2)).toBe("alta");
    expect(interpretarPrioridad("Normal")).toBe("normal");
    expect(interpretarPrioridad(null)).toBeNull();
    expect(interpretarPrioridad("xx")).toBeNull();
  });
});

describe("textos", () => {
  it("normaliza acentos, mayúsculas y espacios", () => {
    expect(normalizarTexto("  Planificación   Mensual ")).toBe("planificacion mensual");
    expect(normalizarTexto("Flex-Sports")).toBe(normalizarTexto("flex sports"));
    expect(normalizarTexto("Desarrollo/conexiones")).toBe(normalizarTexto("Desarrollo / Conexiones"));
    expect(slugificar("Email/Automatizaciones")).toBe("email-automatizaciones");
    expect(slugificar("???")).toBe("sin-nombre");
  });
});

describe("fechas y zona horaria", () => {
  it("'hoy' usa la hora de Buenos Aires y no la del servidor", () => {
    // 4/10 a las 23:30 en Buenos Aires = 5/10 02:30 UTC
    const instante = new Date("2026-10-05T02:30:00Z");
    expect(fechaEnZona(instante, "America/Argentina/Buenos_Aires")).toBe("2026-10-04");
    expect(fechaEnZona(instante, "UTC")).toBe("2026-10-05");
  });

  it("interpreta formatos de fecha", () => {
    expect(interpretarFecha("2026-10-09")).toBe("2026-10-09");
    expect(interpretarFecha("")).toBeNull();
    expect(interpretarFecha(null)).toBeNull();
    // epoch ms de ClickUp (medianoche de Argentina = 03:00 UTC)
    expect(interpretarFecha(Date.UTC(2026, 9, 9, 3), "America/Argentina/Buenos_Aires")).toBe("2026-10-09");
    expect(interpretarFecha(String(Date.UTC(2026, 9, 9, 3)), "America/Argentina/Buenos_Aires")).toBe("2026-10-09");
    expect(interpretarFecha("2026-10-09T01:00:00Z", "America/Argentina/Buenos_Aires")).toBe("2026-10-08");
  });

  it("rechaza fechas inexistentes", () => {
    expect(() => interpretarFecha("2026-02-30")).toThrow(/no existe/);
    expect(() => interpretarFecha("mañana")).toThrow(/inválida/);
  });

  it("clasifica vencimientos (semana de lunes a domingo)", () => {
    const hoy = "2026-10-07"; // miércoles
    expect(clasificarVencimiento(null, hoy)).toBe("sin_fecha");
    expect(clasificarVencimiento("2026-10-06", hoy)).toBe("vencida");
    expect(clasificarVencimiento("2026-10-07", hoy)).toBe("hoy");
    expect(clasificarVencimiento("2026-10-11", hoy)).toBe("semana");
    expect(clasificarVencimiento("2026-10-12", hoy)).toBe("proxima");
  });

  it("formatea fechas relativas", () => {
    expect(formatearFecha("2026-10-07", "2026-10-07")).toBe("Hoy");
    expect(formatearFecha("2026-10-08", "2026-10-07")).toBe("Mañana");
    expect(formatearFecha("2026-10-09", "2026-10-07")).toBe("vie 9 oct");
    expect(formatearFecha("2027-01-09", "2026-10-07")).toBe("9 ene 2027");
  });
});

describe("recurrencias", () => {
  it("días hábiles saltean el fin de semana", () => {
    const r = { frecuencia: "diaria_habil" as const };
    expect(proximaOcurrencia(r, "2026-10-10")).toBe("2026-10-12"); // sábado → lunes
    expect(ultimaOcurrencia(r, "2026-10-11")).toBe("2026-10-09"); // domingo → viernes
  });

  it("mensual el 31 cae el último día en meses cortos", () => {
    const r = { frecuencia: "mensual" as const, diaMes: 31 };
    expect(proximaOcurrencia(r, "2027-02-01")).toBe("2027-02-28");
    expect(proximaOcurrencia(r, "2028-02-01")).toBe("2028-02-29");
    expect(proximaOcurrencia(r, "2026-04-01")).toBe("2026-04-30");
  });

  it("semanal", () => {
    const r = { frecuencia: "semanal" as const, diaSemana: 1 };
    expect(proximaOcurrencia(r, "2026-10-07")).toBe("2026-10-12");
    expect(ultimaOcurrencia(r, "2026-10-07")).toBe("2026-10-05");
  });
});
