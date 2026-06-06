# Mercado Pago para Natta

## 1. Crear la aplicación

En Mercado Pago Developers:

1. `Crear aplicación`
2. Nombre sugerido: `Natta Web Checkout`
3. Categoría: `Checkouts`
4. Solución: `Checkout API`

Con esa app después vas a usar:

- `Public key` en el frontend
- `Access token` en el backend
- `Webhook secret` para validar notificaciones

## 2. Qué medio cubre cada cosa

- `Tarjetas`: se procesan dentro del checkout embebido.
- `Rapipago / Pago Fácil`: se crean como ticket y el cliente recibe la boleta.
- `Dinero en cuenta`: entra por `Cuenta Mercado Pago`.
- `QR`: en este flujo web queda cubierto por el ingreso/redirección a la cuenta de Mercado Pago. No es el QR presencial de caja/local.

## 3. Configuración que necesita este proyecto

Copiar en `.env`:

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

`MERCADOPAGO_ENV` define cuál par de credenciales usa la app en ese entorno:

- `test`: usa las credenciales de prueba.
- `production`: usa las credenciales productivas.

Si querés hacer pruebas reales con importes bajos en producción, podés usar:

- `NEXT_PUBLIC_PRICE_MULTIPLIER="0.1"` para cobrar un 10 % del valor actual.
- Cuando termines, lo volvés a `1` y recuperás los importes normales sin tocar el catálogo.

## 4. Notificaciones

En la app de Mercado Pago configurá:

- Webhook URL: `https://tu-dominio/api/payments/webhook`
- Eventos: al menos `payment`

El secreto del webhook va en:

```bash
MERCADOPAGO_WEBHOOK_SECRET_TEST="..."
MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION="..."
```

Ese valor es la clave secreta que Mercado Pago genera en la pantalla de `Webhooks` para tu aplicación. Se usa para validar la firma `x-signature` y confirmar que la notificación realmente fue enviada por Mercado Pago.

## 5. Cómo quedó integrado en Natta

- La web crea primero el pedido en Natta.
- Después abre un checkout embebido con Mercado Pago.
- Si el pago es con tarjeta o ticket, el backend crea el pago vía API.
- Si el pago es con cuenta Mercado Pago, Mercado Pago redirige al usuario y vuelve con `back_urls`.
- El webhook sincroniza el cobro y actualiza el pedido en el sistema de gestión.

## 6. Punto importante sobre los 18 días

Tomé `18 días` como vencimiento para `Rapipago / Pago Fácil`.

- Tarjetas y cuenta Mercado Pago no usan ese vencimiento.
- Si querés otro plazo, cambiá `MERCADOPAGO_TICKET_EXPIRATION_DAYS`.

## 7. Pruebas

- Para wallet/QR no uses `localhost` en `NEXT_PUBLIC_APP_URL`.
- Usá un dominio real o un tunnel como `ngrok`.
- Primero probá con credenciales `TEST`.
- Cuando funcione, activá `MERCADOPAGO_ENV="production"` en el deploy real.
