# Liquidación de cena

PR22 transforma la realidad de cena de PR20 en obligaciones financieras exactas. Responde cuánto debe cada persona que realmente cenó; no registra quién pagó.

## Fuentes autoritativas

El numerador es exclusivamente `sum(dinner_expenses.amount_minor)` del evento. El denominador contiene exclusivamente `event_participants` activos con `actual_dinner = YES`. Las confirmaciones de PR11, compras previstas, encargado de compra, precio de cancha, asistencia de fútbol, equipos y Match Settlement no participan en ninguna de las dos consultas.

Un invitado con asistencia real `YES` se incluye mediante su identidad `EventParticipant`; no necesita `Profile` ni `GroupMember`. Una persona que jugó pero no cenó queda excluida, mientras que una persona que no jugó pero cenó queda incluida.

La cena debe tener `dinner_attendance_recorded_at`: asistencia sin registrar no equivale a cero comensales. Una revisión registrada con cero comensales devuelve `NO_ACTUAL_DINERS`. Si existen comensales pero la suma de gastos es cero, devuelve `NO_DINNER_EXPENSES` y no crea obligaciones sin valor.

## Dinero y reparto exacto

Los importes se almacenan como enteros `bigint` en unidades menores y se limitan al entero seguro de JavaScript. ARS `$100.000` son `10_000_000` centavos. No se persisten números de coma flotante ni textos localizados.

El cálculo divide el total entero por la cantidad de comensales, toma el piso como importe base y distribuye un centavo adicional entre las primeras posiciones del orden estable `event_participants.created_at, id`. La función TypeScript de cena reutiliza `allocateAmountExactly`, el mismo primitivo matemático usado por Match Settlement; cada dominio conserva sus propias reglas de elegibilidad.

Para `$100.000 / 11`, la vista conceptual muestra `≈ $9.090,91`, pero las obligaciones son diez importes de `$9.090,91` y uno de `$9.090,90`. La suma permanece exactamente en `$100.000,00`. Si el total contiene menos unidades mínimas que comensales, se rechaza como dato financiero inválido porque PR22 no crea obligaciones de valor cero.

## Preview, finalización y snapshot

`get_dinner_settlement(event_id)` devuelve asistencia registrada, total real, cantidad real, estado de disponibilidad, preview exacto y snapshot final cuando existe. Antes de finalizar, cualquier corrección válida de PR20 se refleja al volver a cargar.

`finalize_dinner_settlement(event_id)` recibe únicamente el evento. PostgreSQL deriva `auth.uid()`, verifica ADMIN activo, bloquea el evento, exige estado `SETTLEMENT`, lee comensales y gastos actuales, calcula el reparto y crea atómicamente:

- una fila única en `dinner_settlements`;
- una fila en `dinner_settlement_items` por cada comensal real.

El snapshot conserva total de gastos, moneda, cantidad, asignaciones, nombres históricos, invitado, autor y fecha. Una restricción única por evento, el bloqueo `FOR UPDATE` y el retorno del snapshot ya existente hacen que la operación sea idempotente ante doble toque o dos ADMINs concurrentes.

## Correcciones y ciclo de vida

- `DRAFT`, `OPEN` e `IN_PROGRESS`: no se finaliza.
- `SETTLEMENT`: preview y finalización explícita.
- `CLOSED`: lectura histórica.

Después de finalizar, triggers rechazan altas, modificaciones y bajas de gastos, cambios en `actual_dinner`, cancelaciones que alteren comensales y una nueva grabación de asistencia. No existe recálculo silencioso ni reset en PR22. Estas reglas no bloquean cambios de fútbol; éstos siguen gobernados únicamente por Match Settlement.

Match y Dinner son independientes: cualquiera puede estar pendiente o finalizado sin condicionar al otro. No se suma un “total general” en PR22.

## Seguridad y frontera con PR23

Las tablas públicas tienen RLS. Un miembro activo del grupo puede leer filas de sus eventos; `anon` y usuarios ajenos no pueden. Las escrituras directas de navegador están revocadas. Las funciones privadas `SECURITY DEFINER` usan `search_path = ''`, califican relaciones, verifican identidad y permisos, y sólo las envolturas enfocadas se conceden a `authenticated`.

Finalizar crea cero filas en `payments`, no usa `payment_status` y no marca a nadie `PAID`. PR23 consumirá de manera independiente los items de Match y Dinner para registrar pagos.
