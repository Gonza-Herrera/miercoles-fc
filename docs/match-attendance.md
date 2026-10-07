# Match Attendance (Asistencia Real al Partido)

PR13 implementa la frontera de verdad entre la confirmación planificada de juego (`football_response = 'YES'`) y los presentes que efectivamente jugaron (`actual_football = 'YES'`), correspondiente a la **Pantalla 7: Marcar presentes ("¿Quiénes jugaron?")** del boceto original de Miércoles FC.

## Propósito y Filosofía de Dominio

En un grupo de fútbol de amigos, confirmar asistencia previa no garantiza asistencia real:

- Alguien confirma y avisa a último momento que no puede ir o se lesiona.
- Un amigo o invitado se suma directamente en la cancha sin aviso en la app.

La liquidación de cancha (PR21) y el control de pagos (PR23) deben basarse estrictamente en los jugadores que efectivamente estuvieron en la cancha. `actual_football` es la única fuente de verdad contable y deportiva.

PR21 añade metadatos de revisión al evento para distinguir “sin registrar” de un cero explícito. `record_match_attendance` los completa sin modificar confirmaciones. Una vez finalizada la liquidación de cancha, PostgreSQL bloquea cambios de asistencia o cancelaciones que alterarían el conjunto financiero; PR21 no ofrece reapertura ni recalculo silencioso. Ver [Liquidación de cancha](match-settlement.md).

PR17 también usa `actual_football = YES` como lista autoritativa del draft. Una vez
iniciado el draft, PostgreSQL bloquea cambios de asistencia real para evitar que la
lista disponible o las capacidades cambien a mitad de la selección.

## Modelo y Base de Datos

1. `actual_football` usa el enum de PostgreSQL `actual_attendance_status`:
   - `UNSET`: Todavía no se registró asistencia real para este participante.
   - `YES`: Asistió efectivamente al partido.
   - `NO`: Convocado o en la lista que no jugó.

2. **RPC Segura de Registro**:
   `record_match_attendance(p_event_id uuid, p_attendances jsonb)`
   - Definida en esquema `private` con `SECURITY DEFINER` y wrapper en `public`.
   - Verifica autenticación (`auth.uid()`).
   - Verifica que el usuario sea `ADMIN` activo del grupo del evento mediante `private.is_group_admin()`.
   - Bloquea la fila del evento (`for update`) para prevenir condiciones de carrera.
   - Rechaza modificaciones si el evento está en estado `CLOSED`.
   - Para participantes existentes (incluidos invitados), actualiza `actual_football`.
   - Para miembros del grupo que aún no tenían fila en `event_participants`, realiza un `insert ... on conflict (event_id, group_member_id) do update`.

3. **Lectura de Asistencia**:
   `get_event_attendance(p_event_id uuid)` ahora expone `actual_football` y `actual_dinner` preservando compatibilidad con los flujos de planificación (PR11/PR12).

## Experiencia en Angular y Pantalla 7

- **Ruta**: `/events/:eventId/match-attendance`.
- **Pre-selección Inteligente**:
  - Si el estado ya fue grabado (`YES` o `NO`), se respeta ese valor.
  - Si está en `UNSET` (primera vez que el admin ingresa), se pre-seleccionan automáticamente los jugadores con `football_response = 'YES'`.
- **Interacción Mobile-First**:
  - Filas táctiles con avatares, nombres e indicadores de confirmación/invitado.
  - Checkbox estilizado con feedback visual instantáneo (púrpura brand `#6d45c6` con checkmark `✓`).
  - Contador dinámico en cabecera: `X presentes`.
  - Acciones rápidas: _Todos_ / _Ninguno_.
  - Botón persistente/sticky en el pie: `[ Guardar y continuar ]`.
- **Navegación**:
  - Acceso desde el detalle del evento (`/events/:eventId`) mediante la tarjeta destacada _"⚽ ¿Quiénes jugaron? (Marcar presentes)"_.
  - Al guardar, redirige al detalle del evento con mensaje de feedback de éxito, listo para avanzar a la formación de equipos o la liquidación.
