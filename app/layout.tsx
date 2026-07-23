import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "Luma Health | Patient Portal",
    description: "Simple, connected, human care.",
    openGraph: {
      title: "Luma Health",
      description: "Simple, connected, human care.",
      type: "website",
      images: [{ url: imageUrl, width: 1734, height: 909, alt: "Luma Health patient portal" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Luma Health",
      description: "Simple, connected, human care.",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
