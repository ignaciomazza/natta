# Base de datos de producción

Esta app usa Prisma con dos conexiones distintas:

- `DATABASE_URL`: conexión de la app en producción. Acá conviene usar pool.
- `DIRECT_URL`: conexión directa para Prisma (`db push`, `seed`, introspección y tareas administrativas).

## Estructura recomendada en DigitalOcean

En el cluster de PostgreSQL creá esto:

### 1. Usuario de aplicación

- Nombre sugerido: `natta_app`
- Uso: solamente la web y las rutas de la app
- No usar `doadmin` en Vercel salvo para mantenimiento puntual

### 2. Base de datos

- Nombre sugerido: `natta`
- Uso: catálogo, pedidos, cobros, clientes, gastos y backoffice

### 3. Pool de conexiones

- Nombre sugerido: `natta-app-pool`
- Base: `natta`
- Usuario: `natta_app`
- Modo: `transaction`
- Tamaño inicial sugerido: `10`

Con un backend server connection limit de `22`, arrancar con `10` deja margen para tareas administrativas y picos chicos sin sobredimensionar.

## Qué variable va en cada lugar

### En Vercel

#### `DATABASE_URL`

Usar la cadena del **pool de conexiones**.

Ejemplo conceptual:

```bash
postgresql://natta_app:TU_PASSWORD@HOST_DEL_POOL:PUERTO/natta?sslmode=require&schema=public
```

#### `DIRECT_URL`

Usar la cadena **directa** del cluster, sin pool.

Ejemplo conceptual:

```bash
postgresql://natta_app:TU_PASSWORD@HOST_DIRECTO:PUERTO/natta?sslmode=require&schema=public
```

Si DigitalOcean te copia una URL sin `schema=public`, agregalo al final.

## Orden recomendado de configuración

### En DigitalOcean

1. Crear el usuario `natta_app`.
2. Crear la base `natta`.
3. Darle a `natta_app` acceso sobre `natta`.
4. Crear el pool `natta-app-pool`.
5. Copiar:
   - URL con pool para `DATABASE_URL`
   - URL directa para `DIRECT_URL`

### En Vercel

Cargar al menos estas variables:

```bash
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_WHATSAPP_NUMBER=
MERCADOPAGO_ENV=production
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY_PRODUCTION=
MERCADOPAGO_ACCESS_TOKEN_PRODUCTION=
MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION=
MERCADOPAGO_TICKET_EXPIRATION_DAYS=18
NEXT_PUBLIC_PRICE_MULTIPLIER=1
```

## Inicialización de la base

Una vez cargadas `DATABASE_URL` y `DIRECT_URL`, ejecutar contra producción:

```bash
npm run prisma:generate
npm run db:push
npm run prisma:seed
```

Eso crea el esquema y deja listos:

- tamaños
- sabores
- precios
- reglas de cupo por día
- usuario admin inicial

## Verificación rápida

Si quedó bien:

1. `https://www.nattavascas.com/api/catalog` debería devolver `200`.
2. `/pedido` debería cargar sabores y precios.
3. El backoffice debería poder listar pedidos sin error de Prisma.

## Acceso de red

Si la app corre en Vercel y no tenés IP fija de salida, no cierres el acceso por IP hasta confirmar una estrategia estable de allowlist.

Para este proyecto:

- primero conviene dejar el acceso abierto con credenciales fuertes
- después evaluar restricción de red si migran a una salida fija o a otra infraestructura
