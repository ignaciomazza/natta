import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    const cobots = "https://www.cobots.studio";
    return [
      { source: "/interno", destination: `${cobots}/app/production`, permanent: false },
      { source: "/interno/login", destination: `${cobots}/login`, permanent: false },
      { source: "/interno/pedidos", destination: `${cobots}/app/production`, permanent: false },
      { source: "/interno/foco-hoy", destination: `${cobots}/app/production`, permanent: false },
      { source: "/interno/cobros", destination: `${cobots}/app/sales`, permanent: false },
      { source: "/interno/cupos", destination: `${cobots}/app/availability`, permanent: false },
      { source: "/interno/precios", destination: `${cobots}/app/products`, permanent: false },
      { source: "/interno/clientes", destination: `${cobots}/app/customers`, permanent: false },
      { source: "/interno/proveedores", destination: `${cobots}/app/suppliers`, permanent: false },
      { source: "/interno/compras", destination: `${cobots}/app/purchases`, permanent: false },
      { source: "/interno/gastos", destination: `${cobots}/app/purchases`, permanent: false },
      { source: "/interno/:path*", destination: `${cobots}/app/production`, permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/images/optimized/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/logo/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/interno/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/comprobante/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/estado-pedido",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/images/Instagram_files/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noimageindex",
          },
        ],
      },
      {
        source: "/images/transparent-images/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noimageindex",
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
