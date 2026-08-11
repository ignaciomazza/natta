# Sucursales y transición a Cobots Gestión

Fecha: 2026-08-10

## Contrato vigente en Natta

Natta distingue dos ubicaciones operativas con códigos estables:

| Código | Nombre público | Dirección | Catálogo inicial |
| --- | --- | --- | --- |
| `DEVOTO` | Sucursal Devoto | Av. Francisco Beiró 5015, timbre 302, Villa Devoto, CABA | Lattas, chicas y grandes |
| `NORDELTA` | Sucursal Nordelta | Boulevard de Todos los Santos 4380, Vila Marina 1, Dique Luján, Tigre, Buenos Aires | Sólo Lattas |

Los pedidos, reglas semanales y excepciones de cupo guardan `branchCode`.
Los registros históricos reciben `DEVOTO` por defecto durante la migración.

La sucursal se elige antes de cargar el catálogo. Esa selección determina:

- combinaciones vendibles;
- calendario y cupos;
- dirección de retiro;
- sucursal visible en pedido, comprobante, email y backoffice.

El servidor vuelve a validar sucursal, catálogo y capacidad al crear el pedido;
no confía únicamente en la selección del navegador.

## Decisión para Cobots Gestión

Una sucursal no debe modelarse como un `StorefrontChannel`. El canal representa
el medio de venta (por ejemplo, la web de Natta); la sucursal representa dónde
se produce, reserva stock, retira o entrega un pedido. Una misma web necesita
ofrecer las dos ubicaciones.

La extensión implementada en Cobots es una entidad reutilizable
`OrganizationLocation` con:

- `organizationId` y `code` único por empresa;
- nombre público;
- dirección estructurada y texto de retiro;
- zona horaria, orden y estado activo;
- relación opcional con inventario, calendarios y canales publicados.

Se agregaron relaciones opcionales y aditivas:

- `StorefrontOrder.fulfillmentLocationId`;
- `Sale.fulfillmentLocationId` cuando la venta nace o se programa en una sede;
- `ProductionSchedule.locationId` para tener un calendario por sucursal;
- ubicación de la reserva derivada de `ProductionSchedule`, sin duplicar el
  dato en `ProductionCapacityReservation`;
- ubicación de inventario/movimientos cuando Natta active stock real por sede.

Natta debe conservar un único canal web. Devoto y Nordelta tendrán calendarios
de producción separados dentro de ese canal.

## Adaptación del conector actual de Natta

El 2026-08-10 se publicó en `cobots-studio` la adaptación que:

1. agregó el enum mapeado `NattaBranchCode` y `branchCode` a
   `prisma/natta-source.prisma`;
2. incluyó `branchCode` en `sourceOrderSnapshot()` y en su hash;
3. creó las ubicaciones determinísticas de Natta;
4. mapeó `DEVOTO` y `NORDELTA` a `fulfillmentLocationId`;
5. resolvió la reserva contra el calendario de esa ubicación, no contra el
   calendario principal único;
6. muestra la ubicación en la gestión de pedidos web.

El conector resuelve `DEVOTO` y `NORDELTA` contra ubicaciones y calendarios
exactos. Si alguno falta o está inactivo, el registro falla de forma aislada y
reintentable; nunca reserva silenciosamente contra Devoto.

## Orden seguro de despliegue

1. Volver a generar el diff contra producción y compararlo con
   `docs/branches-production.sql`.
2. Aplicar la migración de base de Natta. Es aditiva y asigna todo el histórico
   a Devoto.
3. Verificar que existan siete reglas diarias por sucursal y que Nordelta
   conserve las reglas por sabor y únicamente las reglas de tamaño Latta.
4. Desplegar el adaptador de ubicaciones en Cobots Gestión.
5. Desplegar esta versión de la web de Natta.
6. Crear un pedido sintético por sucursal y comprobar catálogo, cupo,
   comprobante, pago y sincronización en Cobots.

No se debe abrir Nordelta en la web productiva entre los pasos 2 y 4.
