# Validación de la corrección de pagos

Fecha: 7 de septiembre de 2026. Estado: comprobado localmente; pendiente de publicar y validar los servicios reales.

## Qué demuestra la corrección

Se ejecutó el receptor de avisos anterior, extraído del commit `4206335`, contra una base PostgreSQL de prueba. Un aviso firmado con identificadores numéricos produjo el error `Expected String, provided Int`, una respuesta 500 y un pedido que seguía pendiente. El receptor corregido, con el mismo aviso y el mismo pedido ficticio, devolvió 200 y, al procesar el aviso, confirmó el pedido, conservó la fecha del sábado y generó un solo envío de comprobante simulado. Esto reproduce el defecto concreto encontrado en los logs; no demuestra por sí solo la causa de los cuatro pedidos históricos no identificados.

## Pruebas en el navegador

Se usó Chrome contra una copia local, con clientes ficticios y servicios de pago/correo simulados.

| Recorrido realizado | Resultado observado |
| --- | --- |
| Abrir un pedido para el sábado y actualizar el estado | Conserva el día 12 y el mismo código. |
| Volver a editar con un enlace de pago ya emitido | Conserva el pedido y explica que debe revisarse antes de cambiarlo. |
| Volver desde la pantalla de pago sin haber comenzado a pagar | Permite editar y mantiene el sábado seleccionado. |
| Elegir voluntariamente jueves 10, continuar por entrega y contacto, guardar y actualizar el pago | La pantalla final muestra jueves 10 y conserva el nuevo código al actualizar. |
| Abrir el panel interno | Incluye pendientes, muestra la hora de actualización y realiza consultas periódicas. |
| Buscar una operación de un pedido cancelado con el filtro Confirmados activo | Encuentra el pedido, explica el alcance global de la búsqueda y señala el pago recibido. |

En la primera revisión, abrir la pantalla de pago ya emitía un enlace y bloqueaba la edición demasiado pronto. Se corrigió: el enlace se genera al pulsar **Abrir Mercado Pago**. También se serializó el inicio de un pago con tarjeta frente a la cancelación del pedido.

## Pruebas automáticas

La suite contiene 28 escenarios con una base PostgreSQL aislada. Ejecuta las rutas de la aplicación y comprueba los registros resultantes, incluyendo solicitudes simultáneas, pagos repetidos, importes insuficientes, devoluciones, búsquedas globales, pagos con tarjeta en curso y recuperación de varias páginas aunque falle un pago. Mercado Pago y Resend se simulan; no se efectuaron cobros ni envíos reales. La comparación con el receptor anterior es una comprobación adicional opcional mediante `BASELINE_WEBHOOK_PATH`.

También se ejecutaron las comprobaciones de seguridad existentes, lint, TypeScript y la compilación de producción. Los nueve escenarios agregados verifican pérdida de la tarea posterior a la respuesta, correo detenido o fallido, reservas vencidas tras una interrupción, recuperación por lotes ante fallos del proveedor, fallo del guardado inicial, validación y renovación de firmas, y reparto de reintentos para evitar que los mismos errores bloqueen avisos posteriores.

## Prueba por HTTP del servidor Next.js

Se levantó una copia local con PostgreSQL aislado. Un aviso firmado ficticio obtuvo **200 en 6 ms**, mientras el correo simulado permanecía detenido durante **25 segundos**. La base mostraba el pedido confirmado por $53.000 y el correo aún pendiente. Después de terminar la demora, el correo figuraba enviado y el evento `PROCESSED`. Los logs confirmaron que el simulador de correo había iniciado y terminado: la medición no depende solamente de configurar una demora. Este tiempo corresponde a la copia local; no es una garantía de latencia en Vercel.

## Revisión adicional del código

Se reprodujeron y corrigieron dos defectos adicionales: una reserva de tarjeta abandonada por una interrupción impedía todos los reintentos; y un intento distinto podía reemplazar el historial de una operación devuelta, permitiendo que un aviso antiguo volviera a contabilizarla. Antes de corregirlos, las nuevas pruebas observaron dos respuestas 409 al intentar retomar el pago y un importe contabilizado de $106.000 donde correspondían $53.000, respectivamente. Después, un solo reintento completa el cobro simulado con la misma clave de idempotencia y el importe devuelto no vuelve a contarse.

También se corrigió la acumulación de hasta 50 consultas y correos secuenciales dentro de una función de 60 segundos. La revisión procesa como máximo tres pagos concurrentes y devuelve el desplazamiento del siguiente sin procesar. Las pruebas verifican que continúa desde ahí aunque fallen los tres primeros pagos y que un correo fallido se informa y luego se recupera sin revertir la confirmación.

Se ejecutó la compilación de producción local con una base aislada. Por HTTP, tres consultas simuladas de **11 segundos** seguidas cada una por un correo simulado de **9 segundos** completaron el lote en **20.040 ms**, con respuesta 200, tres recuperaciones y cero errores. Los logs mostraron el inicio concurrente de las tres consultas y de los tres correos. La base conservó los tres pedidos confirmados por $53.000 y la fecha del sábado 12. Una página posterior también recuperó el cuarto pedido. En el navegador aislado se observó el paso de la pantalla de pago a **Pago recibido**, con el mismo comprobante y sábado 12 de septiembre; no se registraron errores del navegador. Estos tiempos corresponden a simuladores y al servidor local.

Las **cuatro pruebas del workflow** ejecutan su código real con HTTP y reloj simulados: recorren 101 solicitudes con páginas parciales, renuevan la identidad durante ejecuciones largas, continúan hacia los pagos ante una cola de avisos lenta o inaccesible y reportan fallos individuales después de visitar las páginas restantes. No certifican la firma OIDC ni la conexión real entre GitHub y Vercel, que siguen pendientes. Se incluyeron en CI.

Verificación final: 28 escenarios de pagos, cuatro del workflow, comprobaciones de seguridad, lint, TypeScript y build aprobados. No se modificaron las credenciales productivas ni se publicó esta versión.

## Contacto con los servicios reales de Mercado Pago

Se utilizó exclusivamente la cuenta de prueba para el checkout y se confirmó por API que está marcada como usuario de prueba argentino. El token respondió 200 a la consulta de medios de pago. Esto acredita acceso de lectura, no permiso para crear todos los tipos de pago.

Se creó un comprador ficticio mediante el endpoint oficial `/users/test`. Mercado Pago exigió autenticar esa creación con la cuenta principal; no se usó su token para crear cobros. Las credenciales ficticias quedaron en la carpeta temporal de verificación, fuera del repositorio.

| Comprobación externa | Resultado |
| --- | --- |
| Chrome: cargar el formulario de tarjeta de Natta | Cargaron los campos seguros reales de Mercado Pago; se completaron con los datos de una tarjeta de prueba oficial. |
| Enviar la tarjeta de prueba al servidor | La solicitud llegó a la creación del pago; Mercado Pago devolvió `Unauthorized use of live credentials`. No se obtuvo un pago aprobado. |
| Crear una preferencia para el pedido ficticio | Mercado Pago devolvió la preferencia y sus enlaces; la ruta local respondió 200. |
| Abrir el checkout alojado en navegador aislado | Mercado Pago mostró un error de acceso tanto en el enlace sandbox como en el enlace `init_point`. No se alcanzó el pago. |
| Recibir un aviso emitido realmente por Mercado Pago por esa compra | Pendiente: no se completó la compra. El aviso usado en la medición HTTP fue simulado. |

La [referencia oficial de creación de pagos](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/create-payment/post) relaciona el mensaje de autorización con el alcance `payment` del token. Hay que verificar el par Public Key/Access Token y sus permisos para la integración con `/v1/payments`; no se cambiaron las credenciales productivas. No se presume una causa del error de acceso del navegador a partir del mensaje genérico.

El receptor HTTPS temporal solo exponía la ruta del aviso y el regreso del checkout. Se cerraron el túnel, el receptor, los navegadores de prueba y la copia local. No hubo cobros ni correos reales. La cuenta ficticia y la preferencia de prueba creadas en Mercado Pago permanecen como datos de prueba.

### Revisión adicional de las credenciales

El servicio MCP oficial aceptó las credenciales existentes para listar las aplicaciones. El token productivo corresponde a **Natta Web Checkout** y el token guardado como prueba a **TestApp-9c506865**, una aplicación automática de prueba. Que sean aplicaciones distintas puede ser parte del mecanismo de pruebas de Mercado Pago; no demuestra por sí solo un error ni certifica el permiso de crear pagos mediante `/v1/payments`.

La descripción vigente de `get_credentials` en el servicio oficial distingue credenciales de prueba `TEST-` para Payments API/Bricks y `APP_USR-` para otros productos, entre ellos Checkout Pro y Orders, con excepciones para aplicaciones creadas por su automatización. No se debe modificar un prefijo manualmente ni diagnosticar la integración solamente por ese prefijo. Sigue pendiente verificar el par de prueba correspondiente a la aplicación y al flujo de tarjeta de Natta.

Con autorización expresa del usuario, se solicitó `get_credentials` para **Natta Web Checkout**, conservando únicamente claves de prueba si la consulta las devolvía. El servicio respondió HTTP 200, pero el resultado de la herramienta fue `isError: true`: `OAuth ownership validation failed`. La descripción indicó que el token disponible no pertenece a una aplicación OAuth y que esa herramienta solo admite aplicaciones OAuth. No devolvió credenciales: no se guardaron claves nuevas ni se cambiaron las existentes. Que `application_list` funcione con el token no habilita la extracción de credenciales. Este bloqueo corresponde al acceso a las claves y no demuestra una falla del cobro productivo.

La [guía oficial de compras de prueba de Bricks](https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/integration-test/test-payment-flow) distingue los dos recorridos: para tarjeta pide las credenciales **de prueba de la cuenta real**; para redirigir al checkout pide las credenciales **productivas de una cuenta vendedora ficticia**, junto con una compradora ficticia. No debe usarse un único par indistintamente en ambos recorridos de prueba. Esto explica por qué crear una preferencia correctamente no certifica que ese token sirva para simular el pago con tarjeta.

Para continuar la prueba de tarjeta, el titular debe facilitar el par **Public Key y Access Token de prueba** correspondiente a Natta Web Checkout y a Payments API/Bricks. La sección **Pruebas → Credenciales de prueba → Compartir credenciales** permite compartir acceso con la cuenta de Mercado Pago del desarrollador, según la [guía oficial de credenciales](https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/credentials). No hace falta renovar las claves productivas. Si el panel de esa aplicación no ofrece el par de prueba para tarjeta, se debe verificar primero el producto configurado en ella, sin sustituirlo por claves de otro flujo.

## Qué falta para darlo por verificado en producción

- Medir la respuesta y comprobar la recuperación del receptor en Vercel una vez desplegado; el cambio y la medición HTTP descrita abajo son locales.
- Probar el recorrido completo con el entorno de pruebas de Mercado Pago: apertura del checkout, tarjeta, aviso entrante y regreso del cliente.
- Verificar en Vercel las credenciales, firma y recepción real del aviso para la versión desplegada.
- Ejecutar el respaldo desde GitHub y comprobar su autenticación real con Vercel; todavía no se ejecutó en GitHub.
- Comprobar la recepción efectiva del correo en un destinatario de prueba autorizado.
- Tras publicar, revisar un pedido controlado y los logs de esa operación. Tener preparada la versión anterior para volver atrás si aparece una regresión; revertir código no revierte pagos ni correos ya procesados.

No se hizo una revisión manual de todas las áreas administrativas ajenas al recorrido de pedidos y pagos. La validación reduce riesgos y demuestra correcciones específicas; no garantiza ausencia de cualquier defecto.

## Contraste con la documentación oficial

Consulta realizada el 7 de septiembre de 2026. Natta usa preferencias de Checkout Pro y pagos mediante `/v1/payments`; las instrucciones para la nueva Orders API no deben aplicarse indistintamente.

- [Notificaciones de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/payment-notifications): validar la firma, responder 200/201 dentro de 22 segundos y consultar el recurso de pago para actualizar el sistema. La separación entre recepción guardada y procesamiento posterior ya está implementada y comprobada localmente, con recuperación por la tarea programada pendiente de desplegar.
- [IPN](https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications/ipn): Mercado Pago anuncia su discontinuación y aclara que no admite la misma validación con clave secreta que Webhooks. Esto respalda distinguir ambos formatos.
- [Compras de prueba de Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases): usar un comprador de prueba, sesión de incógnito y tarjetas de prueba; comprobar también la recepción de notificaciones. Esos recorridos con el servicio real siguen pendientes.
- [Credenciales](https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/credentials): las credenciales de aplicación permiten operar por API sin compartir la contraseña de los dueños. Localmente existen variables para claves públicas, tokens y secretos de prueba/producción; verificar su presencia no certifica su validez ni la configuración del panel. Las credenciales de comprador de prueba son datos distintos.
