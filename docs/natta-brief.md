# Natta Vascas - brief de producto

## Contexto

Natta Vascas es el emprendimiento de Cami y Martin en Villa Devoto. Hacen tartas vascas de queso por encargo, con una identidad visual sobria, cercana y muy reconocible. La marca crecio rapido: su comunidad empezo a llamar "nattas" a las tartas y ellos tomaron ese lenguaje para nombrar productos y sabores.

La historia de origen nace cuando Martin prueba una tarta vasca en Joaquin Vasco y queda con la idea de poder hacer una igual o mejor. A partir de esa obsesion, Cami y Martin construyen Natta: producto corto, cuidada textura cremosa, branding simple y una relacion muy directa con sus clientes.

## Objetivo del primer corte

Crear una web comercial premium que ordene la primera parte de la demanda. El foco no es reemplazar todo WhatsApp todavia, sino llegar con una experiencia mejor:

- contar la historia y reforzar confianza;
- presentar menu, tamaños, precios y reglas sin depender de historias destacadas;
- guiar al cliente para que envie un mensaje completo;
- preparar la arquitectura para reservas, cupos, pagos y gestion interna.

## Direccion de marca y UX

- Tono visual: editorial calido + ecommerce sobrio.
- Sensacion buscada: crema, caramelo, confianza, cercania y oficio.
- Interfaz: minimalista, con mucho aire, tipografia elegante para marca/titulares y sans clara para compra.
- Ritmo: fotos grandes, copy corto, secciones con un solo objetivo.
- Evitar: exceso de cards, UI generica SaaS, colores saturados, demasiadas promociones o texto explicativo.

## Catalogo inicial

### Tamaños

| Tamaño | Detalle | Rendimiento |
| --- | --- | --- |
| Latta | 300 g cuchareable | Individual |
| Chica | 15 cm | 4 a 6 porciones |
| Grande | 24 cm | 8 a 12 porciones |

### Sabores y precios

| Sabor | Descripcion | Latta | Chica | Grande |
| --- | --- | ---: | ---: | ---: |
| Natta | Clasica de queso | $13.000 | $23.000 | $40.000 |
| Limu | Queso sabor lima | $13.000 | $23.000 | $40.000 |
| Choco | Queso sabor 60% cacao | $13.000 | $23.000 | $40.000 |
| Tella | Queso con avellanas | $13.000 | $26.000 | $45.000 |
| Blanca | Queso sabor chocolate blanco | $13.000 | $23.000 | $40.000 |
| Tachio | Queso con pistachos | $13.000 | $29.000 | $50.000 |
| Duo | Chocolate blanco y Oreos | $13.000 | $29.000 | $50.000 |
| Argenta | Queso sabor dulce de leche | $13.000 | $23.000 | $40.000 |
| Mocha | Cafe con base de chocolate | $13.000 | $26.000 | $45.000 |
| Brulee | Creme brulee con crocante de caramelo | $13.000 | $23.000 | $40.000 |

Nota: Tella puede pedir topping de Nutella sin cargo.

## Reglas operativas

- Pedidos con anticipacion.
- Recomendacion publica: 48/72 h.
- Si hay disponibilidad, algunos pedidos pueden resolverse en 24 h.
- Domingos cerrado.
- No hay local a la calle.
- Retiro por Villa Devoto, a aproximadamente 200 m de Devoto Shopping.
- Los productos no se personalizan por fuera del menu.

## Pagos y entrega

- Retiro: seña del 50% sin excepcion para reservar.
- Envio: pago total del producto por anticipado.
- Envio coordinado por Uber o Cabify dentro del horario de Natta.
- El envio se coordina en el dia; puede contratarlo Natta o el cliente, segun el caso.
- El costo/logistica del envio queda fuera del checkout inicial y se conversa por WhatsApp.

## MVP implementado

- Web publica en Next.js.
- Catalogo visible con precios.
- Pedido asistido sin persistencia.
- Generacion de mensaje de WhatsApp con producto, cantidad, fecha, modalidad, total estimado y regla de pago.
- Prisma preparado para catalogo, precios, reglas de disponibilidad y overrides de capacidad.
- PostgreSQL local preparado por Docker Compose.

## Roadmap

1. Reemplazar assets provisorios por fotos reales de Natta.
2. Agregar numero real de WhatsApp en `NEXT_PUBLIC_WHATSAPP_NUMBER`.
3. Persistir pedidos como borradores y reservas.
4. Implementar cupos por dia y bloqueo de domingos/fechas cerradas desde base de datos.
5. Agregar backoffice para Cami y Martin: pedidos, estados, capacidad diaria y notas internas.
6. Integrar pagos: seña 50% para retiro y pago total para envio.
7. Automatizar mensajes de confirmacion y recordatorios.
