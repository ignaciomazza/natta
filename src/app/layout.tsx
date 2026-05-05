import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Natta Vascas | Tartas vascas de queso",
  description:
    "Tartas vascas de queso hechas por encargo en Villa Devoto. Menu corto, textura cremosa y pedidos con anticipacion.",
  metadataBase: new URL("https://nattavascas.com"),
  openGraph: {
    title: "Natta Vascas",
    description:
      "Tartas vascas de queso, lattas y pedidos por encargo en Villa Devoto.",
    images: [
      "/images/Instagram_files/633114726_18560669452017460_185298347140133489_n.jpg",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" className="h-full scroll-smooth">
      <body className="min-h-full bg-[var(--cream)] text-[var(--chocolate)] antialiased">
        {children}
      </body>
    </html>
  );
}
