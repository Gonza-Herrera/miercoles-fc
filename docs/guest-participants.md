# Invitados de evento

PR09 incorpora invitados temporales sin convertirlos en cuentas ni miembros persistentes.

```text
GroupMember ─────┐
                 │
                 ▼
          EventParticipant
                 ▲
                 │
Guest ───────────┘
```

`EventParticipant` es la identidad común de una persona dentro de un evento. Un participante registrado referencia un `group_member_id`; un invitado conserva `guest_display_name` y deja `group_member_id` en `NULL`. El `CHECK event_participants_identity` exige exactamente una de esas fuentes. El UUID de la fila, no el nombre, es la identidad estable.

Un invitado pertenece a un solo evento. No crea filas en `auth.users`, `profiles`, `group_members` ni `group_invitations`; tampoco recibe roles. Dos invitados del mismo evento pueden compartir nombre y una nueva fecha puede crear otro participante llamado igual.

## Participación y asistencia

Al crear o editar un invitado, `Juega` y `Cena` se guardan de forma independiente en `football_response` y `dinner_response` como `YES` o `NO`. Al menos una debe ser `YES`. Estos datos expresan intención confirmada, no asistencia real.

`actual_football` y `actual_dinner` continúan en `UNSET` hasta que el futuro flujo de asistencia registre lo sucedido. Los cálculos futuros de cancha y cena deberán usar asistencia real, no confirmación.

```text
EventParticipant
      │
      ├── TeamMember
      ├── football attendance
      ├── dinner attendance
      └── Payment
```

Como `team_members` y `payments` ya referencian `(event_participant_id, event_id)`, un invitado podrá integrar equipos, tener cobros de cancha o cena y participar de liquidaciones sin una cuenta especial. No se implementan esos flujos en PR09.

## Creación, edición y cancelación

Las operaciones públicas son:

- `add_guest_participant(event, name, plays, dines)`;
- `update_guest_participant(participant, name, plays, dines)`;
- `cancel_guest_participant(participant)`.

El nombre se recorta, es obligatorio y admite hasta 100 caracteres. `created_by` conserva el Profile que agregó el invitado. Los eventos `CLOSED` rechazan mutaciones; PR10 podrá ampliar esta regla cuando sea dueño de la máquina de estados completa.

Quitar un invitado asigna `cancelled_at` y conserva el mismo UUID. No elimina equipos, pagos ni historia que puedan referenciarlo. La cancelación es idempotente; la reactivación queda fuera de PR09 porque todavía no existe un flujo de Eventos que justifique esa interacción.

## Autorización y RLS

Las tres mutaciones derivan al usuario de `auth.uid()` y verifican en PostgreSQL que sea un ADMIN activo del mismo grupo que el evento. Un MEMBER, un usuario de otro grupo y una sesión anónima no pueden administrarlos. Angular oculta las acciones por experiencia de uso, pero no es la frontera de seguridad.

Las implementaciones privilegiadas viven en `private`, usan `SECURITY DEFINER`, `search_path = ''`, nombres de relaciones calificados y grants mínimos. Los wrappers públicos son `SECURITY INVOKER` y sólo `authenticated` recibe `EXECUTE`. No se conceden escrituras directas sobre `event_participants`; sus lecturas mantienen la política existente de miembros activos del grupo.

Los RPC bloquean la fila del evento durante cada mutación. Así, la autorización y el estado se comprueban en la misma transacción y el diseño queda preparado para múltiples teléfonos ADMIN. Las restricciones de identidad, actividad, nombre, autor y tiempo funcionan aunque el cliente esté desactualizado.

## Integración Angular

`features/events/participants` contiene modelos, proyección de presentación, acceso a datos y componentes reutilizables:

- el formulario accesible de nombre, Juega y Cena;
- una fila que presenta miembros e invitados de manera uniforme, con badge “Invitado” y Avatar por iniciales;
- un gestor de invitados con edición, confirmación de cancelación, estados de carga y mensajes en español.

PR10 inserta el gestor en la vista real del evento y le suministra el `eventId` estable y el permiso ADMIN del grupo. Al cerrar el evento, la interfaz oculta las acciones y PostgreSQL conserva la prohibición definitiva. Las mutaciones requieren confirmación del backend y no se encolan offline. Tampoco se agregan suscripciones Realtime; cada participante sigue siendo una fila compatible con Realtime futuro.
