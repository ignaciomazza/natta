# Operaciones desde Cobots

Cobots puede registrar saldos recibidos en efectivo o transferencia, entregar pedidos pagados y cancelar pedidos pendientes o confirmados.

La API es `POST /api/integrations/cobots/orders/operations`. Requiere `Authorization: Bearer` con `COBOTS_OPERATIONS_TOKEN`, una clave privada exclusiva de al menos 32 caracteres. En Cobots se configura la misma clave como `NATTA_OPERATIONS_TOKEN` y `NATTA_OPERATIONS_URL=https://www.nattavascas.com`.

Antes de publicar, aplicar únicamente `prisma/changes/20260910_cobots_order_operations.sql`. El esquema normal de Prisma también incluye la tabla para bases locales nuevas. El 10/09/2026 se aplicó el SQL aditivo a la base productiva verificada `natta`, como `natta_app`; la tabla quedó vacía. No usar `db push` para esta actualización productiva.

Cada solicitud contiene un UUID, pedido, revisión esperada, usuario de Cobots, fecha original y acción. El contrato está en `src/lib/integrations/cobots-contract.ts`. Natta guarda el resultado y la operación en una sola transacción bajo el mismo bloqueo utilizado para pagos. Un reintento devuelve el resultado guardado; no agrega otro cobro. Reutilizar el UUID para otra acción se rechaza.

La entrega exige saldo cero. La cancelación conserva los pagos aprobados, elimina el saldo a cobrar y libera capacidad al cambiar el estado del pedido. No reembolsa dinero: en Cobots queda un crédito a favor del cliente que requiere gestionar y conciliar su devolución por separado. No se envían emails desde este endpoint.

El panel interno de Natta comparte los bloqueos de cobro y estado, rechaza importes mayores al saldo y evita reabrir pedidos cerrados. Los pedidos con operaciones de Cobots conservan su historial y no se pueden eliminar físicamente.

La validación entre ambos proyectos está en `../cobots-studio/tests/natta-order-operations.integration.test.ts`. Exige bases locales terminadas en `_test` y un servidor local de Natta. También se ejecutaron las 28 pruebas existentes de pagos, lint y build de Natta. No se realizaron pagos reales ni envíos de email.

Para desactivar nuevas solicitudes, retirar `COBOTS_OPERATIONS_TOKEN` y desplegar de nuevo. Conservar la tabla y las operaciones para su recuperación. Coordinar la pausa con Cobots para que no sigan generándose solicitudes pendientes.
