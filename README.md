# Natta Vascas

Web pública de Natta, construida con Next.js, React, TypeScript y Tailwind CSS.

Cobots gestiona el catálogo, los cupos, los pedidos, los comprobantes y los pagos. Las credenciales de Mercado Pago pertenecen al canal de Natta y se guardan cifradas en la base de Cobots. Este repositorio no tiene base de datos ni panel interno. Las rutas antiguas de `/interno` redirigen a Cobots.

## Desarrollo

```bash
npm install
cp .env.example .env
npm run dev
```

Configurar `COBOTS_API_URL` y `COBOTS_STOREFRONT_API_KEY` para el canal de Natta. La clave queda solo en el servidor. `NEXT_PUBLIC_WHATSAPP_NUMBER` es opcional para los enlaces de consulta.

## Recorrido del pedido

- `/pedido` consulta el catálogo y los cupos de Cobots y crea allí los pedidos.
- Mercado Pago Checkout Pro se prepara con las credenciales del canal guardadas en Cobots.
- `/api/payments/webhook` reenvía la notificación firmada a Cobots sin modificarla.
- `/comprobante/{codigo}` y `/estado-pedido` consultan los pedidos en Cobots, incluidos los históricos migrados.

## Verificación

```bash
npm run lint
npm run build
```

El contexto de marca y el material comercial están en `docs`.
