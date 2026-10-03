# Planificación de cena

PR19 responde qué se planea comer, qué se prevé comprar y quién organiza la compra para un evento. No representa asistencia real ni información financiera.

## Separación de dominio

- `event_participants.dinner_response` (PR11) expresa quién confirmó que planea cenar. El conteo incluye miembros e invitados activos con `YES`.
- `dinner_plans` y `dinner_planned_purchases` (PR19) guardan organización previa.
- `actual_dinner` y `dinner_expenses` pertenecen a PR20.
- pagos, deuda y liquidación pertenecen a PR22 y flujos posteriores.

Guardar un plan no crea ni modifica `dinner_expenses`, `payments`, asistencia real o deuda. Una compra prevista puede no realizarse y un gasto real futuro puede no haber sido previsto.

## Modelo

Cada evento tiene como máximo un `dinner_plan`. El menú es texto opcional de hasta 500 caracteres; la UI muestra “Menú por definir” cuando está vacío. Las compras previstas son filas con UUID estable, nombre normalizado de hasta 120 caracteres y orden explícito. No tienen cantidad, precio, pagador ni estado financiero.

El encargado referencia un `group_member` persistente del grupo del evento. Puede ser ADMIN o MEMBER y no necesita Profile vinculado. Un invitado nunca puede ser encargado. Un miembro desactivado permanece visible en planes históricos, pero no puede elegirse en un guardado nuevo. Ser encargado no concede permisos de edición.

## Lectura y guardado

`get_dinner_planning(event_id)` entrega evento, ciclo de vida, conteo confirmado derivado, permiso de edición y plan. `save_dinner_plan(...)` bloquea el evento y guarda menú, encargado y lista completa en una transacción. `updated_at` permite detectar ediciones concurrentes sin dejar estados parciales.

El servidor recorta texto, rechaza elementos vacíos, limita el plan a 30 compras y valida que el encargado sea un miembro activo del mismo grupo. El cliente mantiene un borrador local para que Cancelar no altere el estado persistido.

## Autorización y ciclo de vida

Miembros activos pueden leer planes de eventos de su grupo. Sólo un ADMIN activo puede guardar mediante el RPC específico. Las tablas tienen RLS, los roles de navegador sólo reciben `SELECT` y las escrituras directas permanecen revocadas.

- `DRAFT`, `OPEN`, `IN_PROGRESS`: ADMIN puede crear o editar.
- `SETTLEMENT`, `CLOSED`: lectura histórica.

La pantalla `/dinner` conserva la confirmación independiente de PR11 y añade la planificación mobile-first. Home combina el conteo de PR11 con el menú de PR19 sin mezclar sus fuentes. No hay Realtime ni cola offline de mutaciones; un guardado sólo se considera exitoso después de la confirmación del backend.

## Frontera futura

PR20 podrá usar compras previstas como sugerencias, pero deberá registrar asistencia y gastos reales por separado. Nunca debe convertirlas automáticamente. PR22 calculará liquidaciones exclusivamente desde asistencia y gastos reales.
