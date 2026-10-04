import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tareas · Sumo Growth", template: "%s · Sumo Growth" },
  description: "Gestor de tareas interno de Sumo Growth. Fuerza. Foco. Crecimiento.",
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
