# Auditoría de backups y UI/UX

Fecha: 14 de octubre de 2026. Alcance: copias completas y ajustes pequeños sobre la identidad iOS Dark Premium existente. Sin cambio de esquema, arquitectura, reglas de golf, diana, fórmulas o geometría de gráficos. Sin dependencias nuevas, PWA ni despliegue OpenShift.

## 1. Backup de palos

La exportación **ya era correcta**: `exportBackup` lee las siete tablas en una transacción de lectura, usando `toArray()` sobre `clubs`, sin filtrar por disponibilidad o visibilidad. El JSON incluye todos los atributos reales de `Club`: `id`, `nombre`, `categoria`, `activo`, `orden`, `creado`. No existe un objeto adicional de configuración personalizada; la personalización está en esos atributos.

Los inactivos siguen en `clubs` y se restauran completos. `snapshot()` ordena la bolsa por `orden`; la posición en el array exportado no sustituye ese atributo. Los golpes conservan sus IDs, `paloId` y la instantánea `paloNombre`, incluso cuando el palo se renombra o se desactiva.

Un palo eliminado antes de exportar no existe ya en la tabla: sus golpes mantienen ID y nombre históricos, y `historicalReferences.clubIds` declara la referencia ausente. La validación comprueba que la lista coincide exactamente con las referencias históricas ausentes. No se reconstruyen palos inventados ni se reasignan golpes por nombre. Las estadísticas admiten esas referencias históricas mediante la lógica existente.

`restoreBackup` valida y separa el payload antes de escribir. El vaciado y la inserción de todas las tablas ocurren en una transacción de escritura: TODO O NADA, sin fusión. IDs duplicados, atributos inválidos, referencias de hoyos rotas o referencias históricas no declaradas se rechazan antes de modificar datos. Los snapshots reactivos publican la bolsa y las estadísticas restauradas.

No se detectó pérdida de palos ni de sus atributos. No se reescribió el sistema. Se corrigió un error preexistente de lint en `domain/backup.ts`: se sustituyó la expresión regular de caracteres de control por la comprobación equivalente de códigos 0–31 y 127, con pruebas de regresión.

### Pruebas añadidas

- Bolsa con varios palos, personalizado e inactivo; igualdad de todos los atributos exportados.
- Ida y vuelta JSON: exportar, cambiar nombres/estado/orden, añadir palo, eliminar ronda, importar; igualdad exacta del snapshot y de las siete tablas exportadas, incluida reapertura de IndexedDB.
- IDs originales, nombres históricos y referencias a palos renombrados, desactivados y eliminados.
- Igualdad de estadísticas por palo antes/después, incluyendo putting y penalizaciones.
- Restauración repetida sin duplicados; bolsa vacía sin regenerar semilla.
- Rechazo de copias inválidas sin cambios, incluidos caracteres de control.
- Fallo de escritura tras vaciar las tablas: rollback completo.
- Snapshot reactivo coherente; actualización del detalle de palo y listado de bolsa.
- Selección de archivo y cancelación sin escritura; restauración mediante confirmación explícita; error accesible de archivo inválido.

## 2. Revisión de UI/UX

**Auditoría estática**, leyendo rutas, componentes, estilos, SVG y pruebas. No había navegadores disponibles en la herramienta de UI. Ninguna pantalla se declara revisada visualmente. jsdom comprueba interacciones y accesibilidad semántica, no geometría ni apariencia.

| Pantallas/componentes revisados | Ruta o implementación real | Alcance |
| --- | --- | --- |
| Inicio y ronda en curso | `/`, `Overview.tsx` | Hero, tarjetas con enlaces de superficie y papelera independiente, estados vacíos |
| Preparación y selección de campo | `/ronda/nueva` | Selector real, pares, inicio, ausencia de campos |
| Registro y edición de golpe | `/ronda/golpe`, `ShotForm` | Origen, palo histórico, diana, destino y penalización, guardado y errores |
| Diana y destino | `ShotTarget`, `DestinationChoices` | Pointer Events, selectores alternativos, etiquetas, iconos, selección explícita |
| Putting | `ShotForm` desde Green | Distancia inicial, resultado, dirección, red zone y validación existentes |
| Resumen y confirmación de hoyo | `/ronda/resumen` | Secuencia, edición/borrado, avisos y confirmación explícita |
| Scorecard y detalle de ronda | `/ronda/tarjeta` | Indicadores, navegación por hoyo, finalización y borrado |
| Historial | `/rondas` | Tarjetas navegables y diálogo de borrado, estado vacío |
| General, Salidas, Putting, Palos y detalle | `/estadisticas`, parámetros `seccion`/`palo` | Tabs por teclado, filtro, muestras, leyendas, matriz, estados sin datos y gráficos compartidos |
| Campos y bolsa | `/ajustes/campos`, `/ajustes/palos` | Formularios, orden, disponibilidad, edición y confirmaciones |
| Ajustes y backups | `/ajustes`, `/ajustes/datos` | Tarjetas, archivo, resumen y confirmación de sustitución |
| Diálogos, errores y carga | `ConfirmDialog`, `DataFeedback`, `WriteFeedback`, `EmptyState` | Dialog modal, Escape, foco, mensajes y reintentos |
| Navegación y responsive compartidos | `App.tsx`, `styles.css`, `index.html` | Foco, enlaces activos, safe areas, footer, controles y movimiento reducido |

### Ajustes realizados

- Tokens compartidos `--control-height` (48 px), `--touch-size` (44 px), `--section-gap` y `--nav-clearance`. Altura unificada de inputs, selects y acciones; radios de tarjetas y navegación reutilizan `--radius-card`.
- Inputs y selects comparten su definición CSS. Eliminados estilos sin usos identificados: `.target-grid`, `.target` y `.button-tag`.
- Separación consistente entre secciones estadísticas y entre resumen de ronda, borrado e indicadores. Enlaces de evolución de ronda tienen altura táctil de 44 px, subrayado y foco existente; tarjetas de palo incorporan estado de pulsación.
- Selectores alternativos de diana en una columna a ≤380 px para dejar leer las categorías; diana e interacción sin cambios.
- Tamaño de green de putting y separación reducidos a ≤380 px; porcentaje combinado puede envolver. Contenedores de métricas y leyendas admiten reducción y texto largo.
- Inputs y acciones limitan su ancho, sin ocultar posibles desbordamientos mediante `overflow-x: hidden`. Las acciones de diálogo se distribuyen y pueden saltar de línea; se conserva el límite de altura y scroll modal.
- Márgenes laterales y navegación inferior respetan safe areas izquierda/derecha. Se conserva el espacio inferior del footer y la safe area inferior existentes; el margen de scroll de los controles usa el mismo token de reserva inferior.
- Papeleras de gestión de campos y bolsa comparten `.icon-button`, con nombre accesible y confirmación existente. Tarjetas de gestión siguen siendo no navegables; no se añaden ediciones ficticias ni controles anidados.
- Errores asociados a formularios y controles de edición mediante `aria-describedby`; errores de registro asociados al grupo y selector de palo. Ayuda y error de backup asociados al input de archivo.
- Icono de descarga corregido en «Guardar copia de mis datos actuales» y texto de regreso a Ajustes unificado.

Se conservan el fondo oscuro verde, las tarjetas carbón, las acciones esmeralda, la tipografía del sistema, los colores de la diana y las visualizaciones de abanico, trayectorias y putting. Los gráficos continúan usando sus `viewBox` y anchos adaptables, con leyendas textuales y cantidades. Se conserva `prefers-reduced-motion` y foco visible.

Contraste calculado a partir de los colores CSS sólidos (no captura): texto principal/superficie 14,77:1; secundario/superficie 8,04:1; secundario/superficie elevada 6,12:1; texto de acción/fondo esmeralda 8,72:1; esmeralda/superficie elevada 5,75:1; texto/botón destructivo 5,89:1; advertencia/fondo 7,57:1; error/fondo 8,12:1. Estos valores no verifican todos los bordes, transparencias, SVG ni estados renderizados.

### Pendiente de verificación visual

Abrir las rutas anteriores con datos de prueba aislados a **320, 375, 390, 430, 768 y 1280 px**: no se midió ni comprobó visualmente ninguna de estas anchuras. Verificar ausencia de scroll horizontal, SVG completos y etiquetas sin solaparse, nombres largos, matriz 5×5, diálogos, foco y último botón de cada formulario. Las correcciones responsive se fundamentan en el código; falta confirmar el resultado renderizado.

En Safari/iPhone real: safe areas en orientación vertical/horizontal, toque/arrastre de la diana, controles de 44 px, scroll con barra inferior, teclado virtual abierto y acceso al botón de guardado. No se ha comprobado el comportamiento de la barra con el teclado abierto. Revisar también VoiceOver y los contrastes de bordes/estados sobre los fondos renderizados.

## 3. Archivos y validación

Creado: `AUDIT.md`, `src/test-helpers/backupFixture.ts`, `src/persistence/backupRepository.test.ts`, `src/pages/Backups.test.tsx`.

Modificado: `README.md`, `src/styles.css`, `src/domain/backup.ts`, `src/components/DataFeedback.tsx`, `src/components/ShotForm.tsx`, `src/components/DeleteRoundButton.tsx`, `src/pages/Clubs.tsx`, `src/pages/Courses.tsx`, `src/pages/Backups.tsx`.

Comandos reproducibles:

```bash
npm exec -- tsc --noEmit
npm run lint
npm test
npm run build
```

TypeScript, lint, tests y build completados correctamente. **230 pruebas en 16 archivos** (210 existentes y 20 nuevas). La persistencia usa fake-indexeddb y las pruebas de interfaz jsdom. No se reconstruyó ni ejecutó el contenedor durante esta revisión.

## 4. Contenedor local

```bash
podman build -t golf-tracker:dev -f Containerfile .
podman stop golf-tracker
podman rm golf-tracker
podman run -d --name golf-tracker -p 8080:8080 golf-tracker:dev
```

Si no existe contenedor anterior, omitir `stop` y `rm`. Abrir **http://localhost:8080** en el mismo perfil de navegador y origen para conservar IndexedDB. El contenedor no contiene los datos del navegador y no necesita volumen para guardarlos. No se inicia una fase posterior.
