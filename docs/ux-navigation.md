# Navegación y estructura UX

PR28 define el contrato de navegación sin cambiar las reglas de negocio. El contexto explícito viaja como `eventId` en query params para las cuatro secciones y como parámetro de ruta en vistas enfocadas. La URL es identidad, no autorización: cada página vuelve a cargar Evento y Grupo mediante los servicios protegidos por RLS/RPC.

## Matriz de las 14 pantallas

| #   | Pantalla               | Destino funcional                         | Sección                                         | Volver / acción principal                   | Estado o capacidad                    | Cobertura                                       |
| --- | ---------------------- | ----------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| 1   | Inicio                 | `/?eventId=`                              | Inicio                                          | Evento/Grupo; abrir Partido o Cena          | miembro autorizado                    | Existente                                       |
| 2   | Confirmar asistencia   | `/events/:id` (ambas) o `/match?eventId=` | Partido                                         | Inicio; confirmar sólo lo propio            | `OPEN` y miembro                      | Existente                                       |
| 3   | Confirmados            | `/events/:id` y resumen actual            | Partido                                         | Detalle; consultar                          | acceso al Evento                      | Equivalente existente; vista enfocada posterior |
| 4   | Armar equipos          | `/events/:id/teams`                       | Partido                                         | Detalle; guardar modo/equipos               | ADMIN, no `DRAFT/CLOSED`              | Existente                                       |
| 5–6 | Formación              | `/events/:id/lineup`                      | Partido                                         | Origen seguro; editar/intercambiar si puede | lectura miembro; edición ADMIN válida | Existente, una vista con tabs                   |
| 7   | Marcar presentes       | `/events/:id/match-attendance`            | Partido                                         | Detalle; guardar presentes                  | ADMIN y estado permitido              | Existente                                       |
| 8   | Resumen partido        | `/payments?eventId=`                      | Partido (objetivo); Pagos en equivalente actual | Detalle; liquidar cancha                    | lectura miembro; finaliza ADMIN       | Equivalente existente; vista enfocada posterior |
| 9   | Pagos cancha           | `/payments?eventId=`                      | Pagos                                           | Historial/detalle; cambiar estado           | consulta miembro; gestión ADMIN       | Existente combinado                             |
| 10  | Cena: menú/plan/gastos | `/dinner?eventId=`                        | Cena                                            | Inicio/historial; guardar                   | planificación/gastos según backend    | Existente                                       |
| 11  | Comensales reales      | `/dinner?eventId=`                        | Cena                                            | Cena; guardar asistencia real               | ADMIN y estado permitido              | Existente dentro de Cena                        |
| 12  | Resumen cena           | `/payments?eventId=`                      | Cena (objetivo); Pagos en equivalente actual    | Cena; liquidar                              | lectura miembro; finaliza ADMIN       | Equivalente existente; vista enfocada posterior |
| 13  | Pagos cena             | `/payments?eventId=`                      | Pagos                                           | Historial/detalle; cambiar estado           | consulta miembro; gestión ADMIN       | Existente combinado                             |
| 14  | Resumen evento         | `/events/:id/summary`                     | Pagos                                           | Detalle; cerrar/revisar                     | lectura miembro; cierre ADMIN         | Existente                                       |

`MANAGERS` se presenta como modo con DT; no existe un modo manual. Confirmaciones y asistencia real, planificación y realidad de Cena, y liquidaciones de cancha/Cena permanecen separadas.

## Mapa y compatibilidad

- `/`, `/match`, `/dinner`, `/payments` continúan siendo compatibles sin parámetros y resuelven el miércoles actual del Grupo seleccionado.
- Con `?eventId=<uuid>` cargan exactamente ese Evento. No sustituyen un ID inválido o no autorizado por el Evento actual.
- `/events/:eventId/*` sigue siendo el destino canónico de tareas enfocadas.
- `/groups/:groupId/history/:eventId` conserva el origen mediante `returnTo` al abrir formación o pagos.
- `returnTo` acepta exclusivamente rutas internas que comienzan en `/`; rechaza esquemas, URLs protocol-relative y destinos externos.

## Contexto y sección activa

Un parámetro `:eventId` prevalece sobre `?eventId`; cualquiera de ellos prevalece sobre la inferencia del miércoles actual. Al cargar un Evento explícito se carga su Grupo autorizado y se reemplaza el contexto anterior. Las respuestas tardías se descartan mediante un contador de solicitud y las suscripciones Realtime cambian de Evento antes de continuar.

La sección activa procede de `data.navigationSection`, no de comparar strings en componentes:

- presencia, armado, draft y formación: `MATCH`;
- Cena y sus subflujos: `DINNER`;
- liquidaciones, pagos y resumen total: `PAYMENTS`;
- detalle general, grupos e historial: ninguna sección forzada.

Los cuatro enlaces inferiores heredan `eventId` y el retorno histórico seguro. `aria-current="page"` comunica la selección sin depender del color.

## Volver y encabezados

El shell conserva marca/cuenta y muestra un aviso cuando existe Evento explícito. Desde un recorrido histórico ofrece “Volver al historial”; en los demás casos, “Ir al miércoles actual”. Las vistas enfocadas mantienen sus encabezados y destinos deterministas. El historial pasa un retorno explícito a formación/pagos; un enlace directo usa como fallback el detalle del mismo Evento. El botón nativo continúa funcionando porque no se reemplaza el historial del navegador.

## Capacidades

| Contexto                              | MEMBER                 | ADMIN                                 | DT contextual               |
| ------------------------------------- | ---------------------- | ------------------------------------- | --------------------------- |
| Confirmaciones `OPEN`                 | modifica las propias   | modifica las propias                  | igual que su membresía      |
| Presencia, invitados y gastos reales  | consulta según backend | administra cuando el ciclo lo permite | sin privilegio adicional    |
| Equipos aleatorios / configuración DT | consulta               | administra cuando está permitido      | sin privilegio por sí solo  |
| Pick de draft                         | consulta               | sólo si además es DT y es su turno    | selecciona sólo en su turno |
| Liquidaciones                         | consulta               | finaliza cuando el backend habilita   | consulta                    |
| Pagos incluso con Evento `CLOSED`     | consulta               | gestiona pendientes                   | consulta                    |
| Datos deportivos con `CLOSED`         | consulta histórica     | sólo consulta                         | sólo consulta               |

La UI consume `canEdit`, `canFinalize`, `canManage` y `canCurrentUserPick` del modelo/backend. No crea una autorización paralela basada únicamente en el rol.

## Recorridos

- Partido: confirmar → consultar detalle/confirmados → presentes → equipos o DT/draft → formación → liquidación → pagos.
- Cena: confirmar → planificación → comensales/gastos reales → liquidación → pagos.
- Historial: detalle histórico → formación/pagos → navegación entre secciones conservando Evento → retorno al mismo detalle.

No son asistentes obligatorios. Navegar nunca cambia el estado, liquida ni cierra el Evento. Un guardado sólo puede habilitar el siguiente destino después de confirmación del backend; las pantallas conservan sus estados de carga y prevención de doble envío.

## Trabajo posterior

Las vistas enfocadas de Confirmados, Resumen partido, Resumen Cena y pagos separados son responsabilidad de PRs visuales posteriores. Hasta entonces se usan los equivalentes funcionales reales indicados en la matriz; no existen rutas vacías ni enlaces rotos.
