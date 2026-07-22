import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "Luma Saúde | Portal do Paciente",
    description: "Cuidado simples, conectado e humano.",
    openGraph: {
      title: "Luma Saúde",
      description: "Cuidado simples, conectado e humano.",
      type: "website",
      images: [{ url: imageUrl, width: 1734, height: 909, alt: "Portal Luma Saúde" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Luma Saúde",
      description: "Cuidado simples, conectado e humano.",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
