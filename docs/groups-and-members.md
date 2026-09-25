# Grupos y miembros

PR08 incorpora la administración de grupos y miembros sin mezclar identidad autenticada con identidad dentro de un grupo.

```text
Profile
   │
   ├── GroupMember → Group A → ADMIN
   └── GroupMember → Group B → MEMBER
```

Un `Profile` pertenece a una cuenta de la aplicación. Un `GroupMember` es una identidad durable y específica de un grupo: puede existir sin `Profile`, tener un nombre, apodo y avatar propios, y vincularse más adelante mediante PR07.

Un invitado temporal no es un `GroupMember`. PR09 lo representa exclusivamente como un `EventParticipant` con nombre de invitado, limitado a una fecha concreta y sin rol, cuenta, perfil o invitación persistente. Consulte [Invitados de evento](guest-participants.md).

## Creación y múltiples grupos

`create_group` toma la identidad exclusivamente de `auth.uid()`. En una transacción crea el grupo y el primer `GroupMember`, vinculado al perfil actual con rol `ADMIN`. Angular nunca envía `created_by`, `profile_id` ni el rol del creador.

Una persona puede tener una membresía activa diferente en varios grupos. `/groups` lista sólo los grupos donde su perfil tiene una membresía activa. `GroupContextService` mantiene mediante Signals el grupo y la membresía que la vista actual cargó; sirve para decisiones de interfaz, no como frontera de autorización.

## Roles

PostgreSQL conserva solamente:

- `ADMIN`, presentado como “Admin”;
- `MEMBER`, presentado como “Asistente”.

Un ADMIN activo puede actualizar el grupo, agregar y editar miembros, cambiar roles, desactivar/reactivar miembros, subir avatares e invitar miembros no vinculados. Un MEMBER activo sólo puede leer su grupo y los miembros activos. PostgreSQL vuelve a calcular cada permiso desde `auth.uid()` y nunca confía en el estado Angular.

## Ciclo de vida del miembro

`group_members.deactivated_at` conserva la identidad y las referencias históricas:

```text
Group
   │
   ├── active ADMIN
   ├── active ADMIN
   ├── active MEMBER
   └── inactive historical MEMBER
```

Desactivar no elimina ni desvincula el perfil. La membresía deja de otorgar acceso activo, deja de contarse y deja de ser elegible para nuevas invitaciones. Las invitaciones pendientes se revocan dentro de la misma operación. Reactivar restaura el mismo UUID y su vínculo anterior.

Los ADMIN pueden ver miembros inactivos para reactivarlos; los MEMBER sólo ven los activos. No existe hard delete en la UI.

## Último administrador y concurrencia

`change_group_member_role` y `deactivate_group_member` adquieren un advisory transaction lock derivado del UUID del grupo. Todas las operaciones expuestas que pueden reducir administradores se serializan por grupo y vuelven a contar ADMIN activos bajo el lock.

Si no quedaría otro ADMIN activo, PostgreSQL devuelve `GROUP_LAST_ADMIN`. Esto protege tanto la auto-democión como dos modificaciones administrativas concurrentes. Múltiples ADMIN son válidos y no existe un rol OWNER separado.

## Avatares

El bucket privado `group-assets` acepta JPEG, PNG y WebP de hasta 2 MiB. Las rutas no usan nombres suministrados por el usuario:

```text
groups/{group_id}/avatar
members/{group_id}/{group_member_id}/avatar
```

Las filas guardan esa ruta, nunca binarios ni base64. Un miembro activo puede leer assets de su grupo mediante URL firmada; sólo un ADMIN activo puede insertar o reemplazarlos. Las políticas validan además que una ruta de miembro corresponda realmente al grupo indicado. Sin archivo, el componente Avatar muestra iniciales.

Storage y PostgreSQL no comparten una única transacción. El archivo usa una ruta determinística, por lo que un reintento reemplaza el mismo objeto en vez de acumular huérfanos.

## Invitaciones

Un ADMIN ve el estado vinculado/no vinculado y si existe una invitación activa. Como PR07 no persiste el token crudo, una invitación pendiente no puede recuperarse: “Regenerar” revoca el enlace anterior y entrega uno nuevo. Miembros inactivos no aparecen como invitables y no pueden recibir ni aceptar una invitación pendiente.

## RLS y RPC

Las lecturas simples usan `groups` y `group_members` bajo RLS. Las mutaciones pasan por wrappers públicos `SECURITY INVOKER`; sus implementaciones `SECURITY DEFINER` viven en `private`, usan `search_path = ''`, relaciones calificadas, validación explícita de `auth.uid()` y grants mínimos.

No existen grants de escritura directa sobre las tablas para el navegador. El bucket también usa RLS. Una membresía desactivada deja de satisfacer `private.is_group_member` y `private.is_group_admin`, por lo que pierde acceso a grupos e invitaciones.

## Interfaz

Rutas protegidas:

- `/groups`;
- `/groups/new`;
- `/groups/:groupId`;
- `/groups/:groupId/settings`;
- `/groups/:groupId/members/new`;
- `/groups/:groupId/members/:memberId/edit`.

El acceso se encuentra en Inicio y en el menú de cuenta; no se agregó una quinta opción a la navegación inferior. La lista prioriza ADMIN activos, luego MEMBER activos y el orden alfabético dentro de cada rol.
