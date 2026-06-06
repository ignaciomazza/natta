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

## Mercado Pago

El flujo de `/pedido` usa un checkout embebido con:

- Tarjetas de crédito y débito
- Cuenta Mercado Pago / wallet
- Rapipago y Pago Fácil

Variables requeridas en `.env`:

```bash
NEXT_PUBLIC_APP_URL="https://tu-dominio-o-tunnel.ngrok-free.app"
MERCADOPAGO_ENV="test"
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY_TEST="APP_USR-..."
MERCADOPAGO_ACCESS_TOKEN_TEST="TEST-..."
MERCADOPAGO_WEBHOOK_SECRET_TEST="..."
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY_PRODUCTION="APP_USR-..."
MERCADOPAGO_ACCESS_TOKEN_PRODUCTION="APP_USR-..."
MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION="..."
MERCADOPAGO_TICKET_EXPIRATION_DAYS="18"
NEXT_PUBLIC_PRICE_MULTIPLIER="1"
```

Notas:

- `MERCADOPAGO_ENV` define qué credenciales usa la app en ese entorno (`test` o `production`).
- `NEXT_PUBLIC_APP_URL` no debería ser `localhost` si querés probar el retorno desde wallet/QR.
- `MERCADOPAGO_TICKET_EXPIRATION_DAYS` controla el vencimiento de Rapipago/Pago Fácil.
- `NEXT_PUBLIC_PRICE_MULTIPLIER` permite bajar temporalmente todos los importes sin tocar la base. Ejemplo: `0.1` deja una Latta de `$ 13.000` en `$ 1.300`.
- La guía operativa para crear la app y cargar credenciales quedó en `docs/mercadopago-checkout.md`.

## Base de datos local

```bash
docker compose up -d
npm run prisma:generate
npm run db:push
npm run prisma:seed
```

Para bootstrap local completo (DB user + `.env` con credenciales generadas):

```bash
npm run bootstrap:local-db
```

Luego:

```bash
npm run prisma:generate
npm run db:push
npm run prisma:seed
```

Esto deja catálogo, cupos y usuario admin inicial listos para operar.

## WhatsApp

Configurar el numero real en `.env`:

```bash
NEXT_PUBLIC_WHATSAPP_NUMBER="54911XXXXXXXX"
```

El flujo de pedido asistido genera un mensaje con tamaño, sabor, cantidad, fecha, modalidad, total estimado y regla de pago.

## Backoffice

- Login interno: `/interno/login`
- Módulos: pedidos, cupos, clientes, compras, gastos y cobros
- Comprobante público por código: `/comprobante/{codigo}`

## Assets

Los PNG de `public/images` son placeholders generados para validar composición visual. Reemplazarlos por fotos reales de Natta cuando Cami comparta el material.

```bash
npm run assets:placeholder
```

## Brief

El contexto de marca, menu, reglas operativas y roadmap esta documentado en `docs/natta-brief.md`.
