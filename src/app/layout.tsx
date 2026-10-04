import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sumo Tareas", template: "%s · Sumo Tareas" },
  description: "Gestor de tareas interno de Sumo Growth",
  robots: { index: false, follow: false },
};

// Todo es dinámico: cada pantalla depende del usuario logueado y de datos que cambian todo el tiempo.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
