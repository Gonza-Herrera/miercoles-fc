# Invitaciones y vinculación de miembros

PR07 vincula una identidad autenticada con un miembro que ya existe dentro de un grupo. No crea un miembro nuevo y no intenta inferir identidad por nombre o correo.

```text
ADMIN → GroupMember → Invitation → Authenticated Profile → Linked GroupMember
```

`auth.users`, `profiles` y `group_members` continúan siendo entidades diferentes. Un perfil puede representar un miembro distinto en varios grupos, pero el índice único `(group_id, profile_id)` evita que represente dos miembros dentro del mismo grupo.

## Ciclo de una invitación

Una invitación se encuentra en uno de estos estados derivados:

- `ACTIVE`: no fue aceptada ni revocada y todavía no venció;
- `ACCEPTED`: tiene `accepted_at`;
- `REVOKED`: tiene `revoked_at`;
- `EXPIRED`: `expires_at` ya pasó;
- `MEMBER_LINKED`: el miembro fue vinculado por otro proceso.

Las invitaciones nuevas vencen después de siete días. Generar una nueva para el mismo miembro revoca cualquier invitación activa anterior dentro de la misma operación. El índice parcial existente permite sólo una invitación no aceptada/no revocada por miembro.

## Token y almacenamiento

`private.create_group_invitation` genera 32 bytes con `pgcrypto.gen_random_bytes`, los codifica como Base64 URL-safe sin padding y devuelve el token crudo una sola vez. Esto proporciona 256 bits de entropía.

PostgreSQL persiste únicamente:

```text
SHA-256(raw token) → group_invitations.token_hash
```

El token crudo sólo vive en la URL y en el estado temporal de la página administrativa. No se guarda en tablas, almacenamiento del navegador, analytics ni logs. La URL es una credencial bearer hasta que vence, se revoca o se consume.

## RPC y seguridad

La Data API expone wrappers `SECURITY INVOKER` mínimos en `public`:

- `list_invitable_group_members()`;
- `create_group_invitation(group_member_id)`;
- `get_group_invitation_preview(raw_token)`;
- `accept_group_invitation(raw_token)`;
- `revoke_group_invitation(group_member_id)`.

Las implementaciones privilegiadas están en el esquema no expuesto `private`, usan `SECURITY DEFINER`, `search_path = ''`, relaciones totalmente calificadas y permisos de ejecución explícitos. `PUBLIC` no puede ejecutarlas.

Sólo `get_group_invitation_preview` está disponible para `anon`. Devuelve exclusivamente estado, nombre del grupo, nombre del miembro y vencimiento. `anon` no tiene `SELECT` sobre `group_invitations`, por lo que no puede enumerar invitaciones ni conocer hashes o identificadores internos.

La creación obtiene al llamador mediante `auth.uid()` y comprueba en PostgreSQL que:

1. existe su perfil;
2. representa a un `GroupMember` con rol `ADMIN`;
3. el objetivo pertenece al mismo grupo;
4. el objetivo aún no tiene perfil;
5. tanto el ADMIN como el objetivo mantienen una membresía activa.

La aplicación no envía ni puede afirmar un rol, un `created_by` o un perfil administrador.

## Aceptación atómica y concurrencia

`accept_group_invitation` requiere una sesión autenticada. Bloquea primero el `GroupMember` y después la invitación para mantener un orden consistente con creación/regeneración. En la misma transacción de la función:

1. valida hash, vencimiento, revocación y consumo;
2. comprueba que el perfil autenticado existe;
3. impide reemplazar un vínculo existente;
4. comprueba que el perfil no represente otro miembro del mismo grupo;
5. actualiza el `profile_id` del miembro existente;
6. establece `accepted_at`.

PostgreSQL ejecuta cada llamada de función como una transacción. Los locks y las restricciones únicas garantizan que dos dispositivos no puedan consumir correctamente el mismo enlace para perfiles diferentes. Repetir con el mismo perfil devuelve un resultado idempotente sin duplicar membresías.

PR08 revoca invitaciones pendientes cuando un miembro es desactivado. Un miembro inactivo no aparece en la lista administrativa de invitables y no puede recibir una invitación nueva.

## Flujo web y autenticación

`/invite/:token` es pública y presenta la invitación antes de modificar datos. Si la persona no está autenticada, `Unirme al grupo` navega a `/auth` con la misma ruta como `returnUrl` interno seguro.

Magic Link o Google regresan a `/auth/callback` y después a la invitación. El login no la acepta automáticamente: la persona debe revisar nuevamente y presionar `Unirme al grupo` con la identidad elegida.

La pantalla diferencia invitaciones inválidas, vencidas, revocadas, usadas, miembros ya vinculados y perfiles que ya representan otro miembro del grupo. Los errores técnicos de Supabase/PostgreSQL no se muestran.

## Superficie administrativa y compartir

`/invitations` conserva la superficie mínima global, mientras `/groups/:groupId` integra la acción en el miembro correspondiente. Una invitación activa puede regenerarse, pero no recuperarse, porque el token crudo nunca se persiste.

El enlace se construye con el origen actual de la aplicación. En móviles se intenta Web Share; si no está disponible, se usa Clipboard API y finalmente una copia manual visible. No existe integración con WhatsApp ni SDK de terceros.

## PWA

El flujo utiliza URLs web estándar para enlaces abiertos desde WhatsApp, correo o navegador. No presupone que el sistema operativo abra la ventana standalone instalada. Después de vincular el perfil en PostgreSQL, la relación estará disponible cuando se abra la PWA.

El Service Worker sólo cachea shell y archivos estáticos. No se agregaron cachés de RPC, Supabase ni URLs de invitación.

## Validación manual

1. Crear un grupo con un ADMIN vinculado y un miembro con `profile_id = null`.
2. Ingresar como ADMIN y abrir `/invitations`.
3. Generar el enlace y abrirlo en una sesión privada.
4. Confirmar que la previsualización funciona sin login.
5. Presionar `Unirme al grupo`, autenticarse y comprobar que se vuelve a la misma invitación.
6. Presionar nuevamente `Unirme al grupo`.
7. Confirmar que el mismo `group_members.id` ahora contiene el perfil y que no apareció otro miembro.
8. Abrir nuevamente el enlace y comprobar que no puede consumirse con otra cuenta.
9. Regenerar un enlace y confirmar que el anterior aparece revocado.
10. Probar compartir y copiar desde un navegador móvil compatible.

El comportamiento de retorno entre navegador y PWA standalone depende del sistema operativo. No se implementan Universal Links, Android App Links ni deep links nativos en PR07.
