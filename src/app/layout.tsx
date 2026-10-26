import type { Metadata, Viewport } from "next";
import { getEnv } from "@/server/env";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const name = getEnv().APP_NAME;
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Corte e organize os lances das partidas em minutos: envie o vídeo, marque os horários e baixe os cortes prontos.",
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: "#0b1424" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
