# Asistencia y gastos reales de cena

PR20 registra la realidad posterior a la cena: quién comió efectivamente y cuánto se gastó. No modifica las confirmaciones de PR11 ni la planificación de PR19 y no calcula deudas, pagos o importes individuales de PR22.

## Asistencia real

`event_participants.actual_dinner` reutiliza el enum canónico `UNSET | YES | NO`. El evento añade `dinner_attendance_recorded_at` y `dinner_attendance_recorded_by`; ambos son nulos o están completos. Así, “sin registrar” es distinto de una revisión guardada con cero comensales.

`get_dinner_reality(event_id)` proyecta todos los miembros activos del grupo, aunque todavía no tengan `event_participants`, y los invitados activos del evento. Los confirmados `YES` aparecen primero, pero `dinner_response` es sólo contexto: cualquier `YES`, `NO` o `UNKNOWN` puede terminar en asistencia real `YES` o `NO`. Los invitados usan su identidad `EventParticipant`; no existe una identidad especial de cena.

Al abrir una asistencia todavía no registrada, la UI sugiere localmente las confirmaciones `YES`. Nada se persiste hasta que el ADMIN pulsa “Guardar asistencia”. `record_dinner_attendance` recibe la revisión completa, bloquea el evento y valida que cada candidato activo aparezca exactamente una vez. Una identidad duplicada, omitida, ajena a otro evento/grupo o cancelada rechaza toda la transacción. Los miembros sin participante se crean mediante el `upsert` existente; sólo cambia `actual_dinner`. Confirmación, fútbol, planificación y gastos permanecen intactos.

El conteo se deriva siempre de participantes activos con `actual_dinner = YES`; no hay columna de conteo. `dinner_attendance_recorded_at` actúa además como versión optimista: dos ADMINs no pueden sobrescribir silenciosamente revisiones incompatibles.

## Gastos reales

PR20 reutiliza `dinner_expenses`. Cada fila tiene evento, concepto normalizado (1–120 caracteres), `amount_minor > 0`, autor y timestamps. El importe tiene además el límite del entero seguro de JavaScript. Para ARS, `$50.000` se persiste exactamente como `5_000_000` centavos en PostgreSQL `bigint`; nunca se guarda texto formateado ni se usa coma flotante para sumar.

Las compras previstas y los gastos son filas independientes. Un gasto no necesita compra prevista y una compra prevista no se convierte automáticamente. `paid_by_group_member_id` queda nulo: el encargado de compra de PR19 no se interpreta como pagador.

Las RPC `create_dinner_expense`, `update_dinner_expense` y `delete_dinner_expense` implementan CRUD deliberadamente enfocado. Actualizar y borrar requieren `event_id`, `expense_id` y `expected_updated_at`; la función bloquea primero el evento y después el gasto, rechaza cruces de evento y detecta datos obsoletos. El borrado físico es válido mientras el evento sea mutable; `CLOSED` conserva la historia inmutable. La UI exige confirmación antes de borrar.

El total se deriva de `sum(dinner_expenses.amount_minor)` en PostgreSQL y se vuelve a calcular sobre los enteros cargados en Angular. Cero gastos muestra total `$0`, pero no significa una liquidación individual de cero.

## Autorización y ciclo de vida

Los miembros activos pueden leer la realidad de eventos de su grupo. Sólo un ADMIN activo puede mutarla mediante RPCs; ser encargado de compra no concede permisos. Las escrituras directas a `events`, `event_participants` y `dinner_expenses` continúan revocadas y RLS protege las lecturas.

- `DRAFT` y `OPEN`: realidad visible, todavía no editable.
- `IN_PROGRESS`: ADMIN puede guardar/corregir asistencia y CRUD de gastos.
- `SETTLEMENT`: se permiten correcciones de las fuentes que necesitará la futura liquidación.
- `CLOSED`: historia de solo lectura.

Las funciones privadas son `SECURITY DEFINER`, fijan `search_path = ''`, califican relaciones y verifican `auth.uid()` y ADMIN. No hay Realtime ni cola offline: cada mutación sólo se confirma tras la respuesta del backend.

## Frontera financiera y PR22

PR20 entrega a PR22 dos fuentes autoritativas: comensales con `actual_dinner = YES` y suma de gastos reales. Se detiene ahí. Crear asistencia o gastos produce cero filas en `payments`, cero deudas individuales y cero Dinner Settlements. La pantalla no muestra `$X c/u`, estado de pago ni quién debe cuánto.
