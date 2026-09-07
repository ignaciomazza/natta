# Confirmación de pagos y recuperación

La confirmación principal llega por el webhook firmado de Mercado Pago. Los identificadores numéricos se normalizan antes de persistirlos. Las notificaciones IPN antiguas y las de otro entorno no modifican pagos. Una firma inválida se rechaza; un pago todavía sin vínculo local devuelve error para que Mercado Pago reintente.

El pedido, su pago inicial y su referencia se crean en una transacción. El navegador conserva un identificador de solicitud durante los reintentos de creación. La actualización de pagos y del importe del pedido se serializa por pedido. Los avisos repetidos actualizan una operación existente; dos operaciones aprobadas distintas se contabilizan por separado. Las actualizaciones antiguas no revierten una devolución más reciente. Las cancelaciones explícitas siguen canceladas aunque se registre un pago tardío y quedan señaladas para revisión.

## Respaldo sin una visita al sitio

`.github/workflows/reconcile-payments.yml` consulta cada diez minutos los pagos de Mercado Pago modificados durante los últimos 32 días. Recorre todas las páginas, selecciona las referencias de Natta, verifica discrepancias con una consulta directa del pago y recupera la confirmación y el comprobante pendiente. Un fallo de una página hace fallar la ejecución y la siguiente ejecución vuelve a recorrer el período.

GitHub autentica cada ejecución con un token OIDC de corta duración. El servidor verifica firma, emisor, audiencia, antigüedad, repositorio e ID del repositorio, rama `main`, archivo de workflow y tipo de evento. No hay un secreto de producción guardado en el repositorio. `CRON_SECRET` es una alternativa opcional para un futuro programador externo.

El respaldo se activa cuando el workflow está en `main` y la versión que expone `POST /api/payments/reconcile` está desplegada en `www.nattavascas.com`. Ejecutar manualmente **Recover Mercado Pago confirmations** en GitHub Actions permite comprobar la conexión real. Los errores y pagos que requieren intervención aparecen en la ejecución y en los logs del servidor. Las notificaciones de fallo dependen de la configuración de GitHub de quien mantiene el workflow.

GitHub puede demorar las ejecuciones programadas y desactivarlas tras 60 días sin actividad en un repositorio público. Los diez minutos son la frecuencia solicitada, no un plazo garantizado. Si se necesita un plazo estricto, migrar este respaldo a un programador con esa garantía. El webhook sigue siendo la confirmación principal.

## Pantallas y edición

El panel abre con todos los estados y se actualiza cada 30 segundos mientras está visible, además de actualizarse al volver a la pestaña. Conserva los últimos filtros aplicados y descarta respuestas antiguas. Buscar un nombre, teléfono, comprobante o número de operación consulta todos los estados, fechas y sucursales; un aviso explica ese alcance. Se recorren todas las páginas de resultados.

La pantalla del cliente conserva la fecha guardada al actualizar el estado. Abrir la pantalla de pago carga solamente su configuración: el enlace de Mercado Pago se emite al pulsar **Abrir Mercado Pago**. Por eso se puede volver a editar antes de empezar a pagar. Antes de volver a editar verifica Mercado Pago: si hay un pago recibido o no se puede verificar, mantiene el pedido. También protege un enlace de pago ya emitido o un cobro con tarjeta en curso, porque una búsqueda vacía no garantiza que no se paguen después. En ese caso se puede reintentar el mismo pago; para cambiar productos o fecha se indica contactar a Natta. Esta protección evita cancelar automáticamente un pedido cuyo pago aún puede acreditarse.

## Pruebas

`npm run test:payments` requiere `TEST_DATABASE_URL` apuntando a PostgreSQL local y a una base llamada **natta_payment_test**. Borra y recrea datos ficticios de esa base; rechaza hosts externos y cualquier otro nombre. Todas las llamadas a Mercado Pago y Resend están simuladas. No usar credenciales ni bases reales.

CI inicia PostgreSQL 17 aislado y ejecuta las pruebas de pagos, las comprobaciones de seguridad, lint y build. Los escenarios cubren los avisos numéricos/repetidos/inválidos, pagos sin vínculo, recuperación sin visitas, edición durante fallos, concurrencia en creación y checkout, devoluciones y búsqueda global. No hay cambios de esquema ni migraciones para esta corrección.
