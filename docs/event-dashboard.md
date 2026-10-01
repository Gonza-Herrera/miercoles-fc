# Dashboard del miércoles

PR12 convierte Home en la vista principal del grupo y responde “¿cómo viene este miércoles?” con datos actuales del evento y de la asistencia planificada.

## Fuente del evento y modelo de lectura

Home conserva la selección determinista de PR10 mediante `EventService.current()`: prioriza `IN_PROGRESS`, luego `SETTLEMENT`, el evento futuro no cerrado más próximo y finalmente el pasado no cerrado más reciente. El resultado también actualiza `EventContextService`; no existe una segunda definición de evento actual.

El dashboard combina:

- el `WeeklyEvent` protegido por las políticas RLS existentes;
- una lectura de `get_event_attendance` de PR11;
- conteos y estimado derivados con funciones puras en Angular.

No hay una RPC, vista ni migración nueva. La lectura de asistencia ya valida que el usuario sea miembro activo del grupo y entrega miembros e invitados en una sola consulta. Home usa una variante que omite la generación de URLs firmadas de avatar porque el resumen no muestra identidades, evitando solicitudes Storage innecesarias.

## Conteos

Fútbol cuenta exclusivamente `football_response = YES`. Cena cuenta exclusivamente `dinner_response = YES`. `NO` y `UNKNOWN` no suman. Los invitados no cancelados participan en los conteos igual que un miembro persistente, y fútbol/cena permanecen independientes.

## Cancha y estimado

El precio proviene de `events.court_price_minor`; nunca de una configuración global del grupo. El estimado se deriva sólo para presentación:

```text
precio de cancha en unidades menores / confirmados YES de fútbol
```

La división convierte enteros seguros a `BigInt` y redondea al centavo más cercano, con mitades hacia arriba. Por ejemplo, ARS 50.000 / 12 se muestra como ARS 4.166,67. Si no hay confirmados, no existe estimado y la UI muestra “Esperando confirmaciones”; jamás muestra cero, `Infinity` o `NaN`.

El valor se etiqueta visiblemente como “Estimado por jugador” y aclara que puede cambiar. No se persiste en eventos, participantes ni pagos, y no crea deuda ni liquidación. En `SETTLEMENT` y `CLOSED` se oculta como importe utilizable y se remite a la futura asistencia real.

## Ciclo de vida

- `DRAFT`: muestra metadatos y cancha, pero comunica que las confirmaciones aún no abrieron.
- `OPEN`: muestra conteos, estimado y navegación de planificación.
- `IN_PROGRESS`: conserva conteos y estimado como información previa, nunca como asistencia real.
- `SETTLEMENT`: conserva conteos históricos y precio, pero no presenta el estimado como valor final.
- `CLOSED`: se representa de forma histórica si llega a renderizarse; la selección normal de PR10 busca otro evento relevante.

## Cena y navegación

El esquema actual no contiene un menú legítimo. La tarjeta muestra “Menú: Por definir” y no inventa “Asado”; PR19 será responsable de edición y planificación de cena. “Ver partido” y “Ver cena” navegan con Angular Router a `/match` y `/dinner`, donde se reutiliza PR11.

## Actualización, errores y PWA

Cada entrada o recarga de Home consulta nuevamente la verdad del backend, por lo que al volver desde Partido o Cena se actualizan los conteos. PR12 no añade Realtime ni usa `localStorage` como autoridad. Si falla asistencia, se conserva la metadata real del evento y se ocultan los números; si falla el evento, se ofrece reintentar sin exponer errores técnicos. El Service Worker continúa almacenando sólo el shell, no datos financieros o de asistencia como verdad offline.

## Seguridad

RLS y `get_event_attendance` siguen restringiendo evento, precio y confirmaciones a miembros activos del grupo. Usuarios ajenos y miembros desactivados no obtienen el modelo de lectura. PR12 no cambia grants, políticas, funciones ni índices, y no introduce claves privilegiadas en el navegador.

PR26 podrá invalidar/refrescar este mismo modelo mediante Realtime sin modificar la semántica de los conteos ni del estimado.
