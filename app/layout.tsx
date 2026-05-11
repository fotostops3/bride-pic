import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRIDE PIC — Fotos de ropa con IA",
  description: "Generador de fotos ecommerce para ropa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
