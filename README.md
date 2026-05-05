# Natta Vascas

Web comercial + pedido asistido para Natta Vascas, construida con Next.js App Router, TypeScript, Tailwind CSS, Prisma y PostgreSQL.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- PostgreSQL local por Docker Compose

## Desarrollo

```bash
npm install
cp .env.example .env
npm run dev
```

La web queda disponible en `http://localhost:3000`.

## Base de datos local

```bash
docker compose up -d
npm run prisma:generate
npm run db:push
```

El primer corte no persiste pedidos. Prisma queda preparado para catalogo, precios, reglas de disponibilidad y capacidad futura.

## WhatsApp

Configurar el numero real en `.env`:

```bash
NEXT_PUBLIC_WHATSAPP_NUMBER="54911XXXXXXXX"
```

El flujo de pedido asistido genera un mensaje con tamaño, sabor, cantidad, fecha, modalidad, total estimado y regla de pago.

## Assets

Los PNG de `public/images` son placeholders generados para validar composición visual. Reemplazarlos por fotos reales de Natta cuando Cami comparta el material.

```bash
npm run assets:placeholder
```

## Brief

El contexto de marca, menu, reglas operativas y roadmap esta documentado en `docs/natta-brief.md`.
