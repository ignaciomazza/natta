# Comprobantes compartidos con Cobots

La conexión OAuth de Resend se administra por empresa en Cobots. Su API privada llama a `/api/integrations/cobots/orders/receipt-email` con la clave existente `COBOTS_OPERATIONS_TOKEN`. GET devuelve comprobante, último envío e historial; POST valida UUID, destinatario, versión del pedido y credencial de corta duración. No se persiste el token enviado por Cobots.

Natta conserva el diseño del comprobante. `OrderReceiptDelivery` unifica el registro de sus envíos automáticos, reenvíos del panel y reenvíos de Cobots. Congela el mensaje antes de llamar a Resend, evita carreras entre orígenes y devuelve el resultado guardado para un UUID ya enviado. Un resultado incierto se reintenta con la misma clave y contenido. Después de 23 horas se exige verificar Resend y conciliar el registro antes de habilitar otro envío. No se borra una incertidumbre anterior por un rechazo posterior del proveedor.

Antes de desplegar, aplicar sólo `prisma/changes/20260910_order_receipt_delivery.sql`. Es una tabla nueva con sus índices; no modifica pedidos ni cobros. Nunca usar `db push` en producción. Los registros conservan el historial aun si una operación antigua elimina un pedido; la API sólo los presenta cuando el pedido existe.

Los automáticos continúan usando `RESEND_API_KEY` y `NATTA_RECEIPT_EMAIL_FROM`. La conexión de Cobots afecta sus reenvíos, no esos automáticos. El correo incluye cobros manuales y de Mercado Pago, con importe pagado y saldo real. No exige pago total si la seña requerida está cubierta.

Pruebas locales: `tests/receipt-email.integration.test.ts` requiere `RECEIPT_EMAIL_TEST_URL` de localhost y base terminada en `_test`; usa Resend simulado. `npm run test:payments` conserva la regresión completa de pagos. No ejecutar pruebas con destinatarios reales sin autorización.
