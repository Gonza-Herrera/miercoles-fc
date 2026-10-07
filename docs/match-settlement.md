# Liquidación de cancha

PR21 responde cuánto debe cada persona que efectivamente jugó. Usa exclusivamente el precio de cancha del evento y participantes activos con `actual_football = YES`; confirmaciones, miembros del grupo, equipos, DTs, cena y conteos previstos no tienen autoridad financiera.

## Preparación y elegibilidad

`events.match_attendance_recorded_at/by` distingue asistencia todavía no registrada de una revisión explícita con cero jugadores. PR21 actualiza el RPC de PR13 para completar ambos metadatos. La migración reconoce como registradas las asistencias históricas que ya contienen algún `actual_football` distinto de `UNSET`.

La liquidación no está disponible sin revisión explícita. Cero jugadores produce `NO_ACTUAL_PLAYERS`, nunca división, `NaN`, infinito ni una obligación ficticia de cero. Miembros e invitados son elegibles exactamente bajo la misma regla: pertenecer al evento, no estar cancelados y tener `actual_football = YES`. Cada obligación referencia el `EventParticipant`, por lo que un invitado no necesita Profile o GroupMember.

## Dinero y distribución exacta

El precio proviene de `events.court_price_minor`; nunca es global ni enviado por el navegador al finalizar. Todos los importes son `bigint` en centavos y están limitados al rango entero seguro que comparte TypeScript.

Para `total` y `n` jugadores:

```text
base = floor(total / n)
resto = total % n
```

Cada jugador recibe `base`; los primeros `resto` participantes reciben además un centavo. El orden canónico es `event_participants.created_at, id`, nunca el nombre ni un orden accidental. Así, ARS 50.000 entre 9 genera cinco obligaciones de `$5.555,56` y cuatro de `$5.555,55`: el total es exactamente `$50.000,00`, no `$50.000,04`. La UI puede resumir `≈ $5.555,56`, pero la lista presenta la obligación exacta.

El calculador puro TypeScript replica la política para vista previa y pruebas. Valida asistencia, importe seguro, jugadores, duplicados, determinismo, no mutación y la invariancia de suma. PostgreSQL vuelve a calcular autoritativamente al finalizar; no confía en precio, denominador, IDs ni montos del cliente.

## Preview, snapshot y finalización

`get_match_settlement(event_id)` entrega disponibilidad, precio, cantidad real, permiso, preview exacta y eventual snapshot final. Miembros activos del grupo pueden leerlo. `finalize_match_settlement(event_id)` requiere ADMIN y estado `SETTLEMENT`, bloquea el evento, vuelve a obtener jugadores reales y crea en una sola transacción:

- un `match_settlements` único por evento con precio, moneda, conteo, total y autor;
- un `match_settlement_items` por jugador real, con identidad de participante, nombre/tipo históricos, orden y monto.

Restricciones únicas impiden liquidaciones, participantes u órdenes duplicados. El bloqueo del evento más `unique(event_id)` serializa dos teléfonos. Repetir la finalización devuelve el snapshot existente: no crea duplicados.

Antes de finalizar, corregir precio o asistencia recalcula la preview. Después, triggers rechazan cambios de precio, `actual_football` o cancelación de un jugador real. No existe reapertura en PR21 y no hay recalculo silencioso de deuda histórica.

## Ciclo de vida y seguridad

- `DRAFT`, `OPEN`, `IN_PROGRESS`: lectura/preview cuando es calculable, sin finalización.
- `SETTLEMENT`: ADMIN puede finalizar explícitamente.
- `CLOSED`: sólo lectura histórica.

Las tablas tienen RLS de miembro activo, pero las escrituras directas están revocadas. Las implementaciones privilegiadas viven en `private`, usan `SECURITY DEFINER`, `search_path = ''`, nombres calificados, `auth.uid()` y autorización ADMIN. Un MEMBER, DT o encargado de compras no obtiene permiso financiero.

## Frontera con PR23

Un item significa “esta persona debe este importe”, no “pagó”. PR21 no inserta en `payments`, no asigna `PENDING/PAID`, no registra método, fecha o transacción y no toca Dinner Settlement. PR23 podrá asociar seguimiento de pago con estas obligaciones estables.
