# Eventos semanales

PR10 convierte `events` en el agregado real que organiza cada miércoles. No implementa asistencia, equipos, cena ni liquidaciones: esas capacidades futuras referenciarán el UUID estable creado aquí.

## Modelo y ciclo de vida

Todo evento pertenece a un grupo mediante `group_id` y conserva un UUID estable en `id`. Registra `created_by`, `starts_at`, `location`, `court_price_minor`, `currency_code`, `status`, marcas de tiempo y un `title` opcional que PR10 no solicita en el formulario. El alta siempre produce `DRAFT`; el precio pertenece a esa fila, no al grupo, por lo que distintos miércoles conservan importes históricos distintos.

```text
DRAFT → OPEN → IN_PROGRESS → SETTLEMENT → CLOSED
```

Sólo se permite avanzar un paso. Un trigger de PostgreSQL impide saltos, retrocesos y cualquier mutación funcional después de `CLOSED`. En `DRAFT` y `OPEN` se editan fecha, hora, lugar y precio; en `IN_PROGRESS` y `SETTLEMENT`, sólo el precio; en `CLOSED`, nada.

## Seguridad y concurrencia

Los miembros activos del grupo pueden leer sus eventos mediante RLS. Sólo un ADMIN activo puede crear, editar o avanzar estado mediante `create_event`, `update_event_details` y `transition_event_status`. Las tablas no conceden escritura directa al navegador.

Las implementaciones privilegiadas viven en `private`, usan `SECURITY DEFINER`, `search_path = ''`, relaciones calificadas y grants explícitos. Cada modificación bloquea la fila objetivo, por lo que dos teléfonos no pueden validar simultáneamente el mismo estado anterior y saltarse el ciclo.

## Fechas, dinero y evento actual

El formulario captura fecha y hora local del dispositivo, construye un `Date` local válido y envía su ISO instantáneo a `timestamptz`. La presentación usa `Intl.DateTimeFormat('es-AR')`, respetando la zona horaria del navegador.

El precio se analiza como texto decimal y se convierte con aritmética entera a centavos antes del RPC. PostgreSQL lo conserva como `bigint`; no hay columnas monetarias de punto flotante. Por ejemplo, ARS 50.000 se guarda como `5000000`.

El evento actual se elige de forma determinista: primero `IN_PROGRESS`, después `SETTLEMENT`, luego el no cerrado futuro más cercano y, como último recurso, el no cerrado pasado más reciente. `CLOSED` sólo aparece en historial.

## Experiencia Angular

Las rutas por grupo listan activos e historial y permiten el alta ADMIN. Las rutas `/events/:eventId` y `/events/:eventId/edit` usan UUID, no posición ni fecha. La vista detalle expone únicamente la siguiente transición válida, confirma el cierre definitivo y aloja el gestor real de invitados de PR09. Inicio recupera el último grupo visitado —con fallback al primero disponible— y muestra su evento actual.

Los estados de carga, vacío, error y permisos tienen mensajes en español. Los layouts reducen columnas a 430, 390 y 360 px sin depender de hover. Las operaciones de negocio requieren red y confirmación del servidor; el Service Worker sólo mantiene el shell instalable.

## Relaciones futuras

`event_participants`, `teams`, `dinner_expenses` y `payments` ya referencian el UUID del evento en el modelo de base. PR10 no crea participantes automáticamente ni implementa asistencia, equipos, cena o liquidación; únicamente establece el contexto estable al que esos flujos se conectarán desde PR11 en adelante.
