# Asistencia planificada

PR11 responde qué planea hacer cada persona este miércoles. Fútbol y cena son decisiones independientes y no representan asistencia real ni generan deuda.

PR19 reutiliza `dinner_response = YES` únicamente para mostrar el conteo planificado. Editar menú, compras previstas o encargado no modifica respuestas; los invitados activos que confirmaron cena cuentan igual que los miembros persistentes.

## Estados y creación diferida

`football_response` y `dinner_response` usan `attendance_response`: `UNKNOWN`, `YES` o `NO`. `UNKNOWN` significa que la persona todavía no respondió; nunca se interpreta como “No”. Los miembros activos aparecen en la lectura aunque todavía no exista un `event_participants`, y su estado proyectado es `UNKNOWN`.

La primera respuesta crea el participante mediante `INSERT ... ON CONFLICT (event_id, group_member_id) DO UPDATE`. La restricción única existente impide dos participantes persistentes para la misma persona y evento. Cada RPC actualiza únicamente su columna, por lo que una respuesta de fútbol no pisa cena y viceversa. Ambos RPC bloquean primero la fila del evento, serializando primeras respuestas concurrentes y cambios de ciclo de vida.

## Identidad y autorización

El navegador envía sólo `event_id` y `YES`/`NO`. PostgreSQL resuelve:

```text
auth.uid() → profiles.id → group_members.profile_id → event_participants.group_member_id
```

El cliente nunca elige el miembro que modifica. Sólo una membresía vinculada, activa y perteneciente al grupo del evento puede confirmar. Las escrituras directas a `event_participants` continúan revocadas; `set_my_football_confirmation` y `set_my_dinner_confirmation` son las únicas fronteras de auto-confirmación.

Las implementaciones `SECURITY DEFINER` viven en `private`, fijan `search_path = ''`, califican relaciones y tienen grants explícitos sólo para `authenticated`. La lectura `get_event_attendance` valida acceso con la misma frontera de membresía activa usada por RLS.

## Ciclo del evento

La planificación sólo se modifica en `OPEN`. `DRAFT` aún no acepta respuestas; `IN_PROGRESS`, `SETTLEMENT` y `CLOSED` muestran el historial como solo lectura. El bloqueo de fila evita que una confirmación compita con una transición y se guarde después del cierre de la planificación.

## Miembros, históricos e invitados

El modelo de lectura combina:

- miembros activos, con `UNKNOWN` aunque no tengan participante;
- miembros desactivados que sí dejaron una respuesta histórica;
- invitados no cancelados creados por el flujo ADMIN de PR09.

Los invitados no necesitan Auth ni `group_members`. Sus respuestas siguen bajo las reglas de PR09 y no usan las RPC de auto-confirmación.

## Angular

`AttendanceManager` se reutiliza con modo `football`, `dinner` o `both`. `/match` muestra la experiencia de fútbol, `/dinner` la de cena y `/events/:id` ambas. Los botones tienen áreas táctiles amplias, `aria-pressed`, foco visible y estados deshabilitados. La lista distingue `Sin responder`, `Sí` y `No`, identifica invitados y muestra conteos básicos de respuestas `YES`.

PR12 reutiliza `get_event_attendance` en Home para derivar conteos independientes. Su lectura de resumen omite solicitudes de avatar porque no presenta identidades. No se implementan asistencia real, equipos, liquidación, pagos, Realtime ni cola offline. El estimado visual de cancha no modifica `actual_football`, `actual_dinner` ni ninguna fila financiera.

# Asistencia
