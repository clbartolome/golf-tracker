# Golf Tracker · Estadísticas personales y copias de seguridad

Aplicación React + TypeScript + Vite en español, mobile-first, para configurar campos y bolsa y registrar rondas reales, golpes, putts y penalizaciones. Conserva la identidad deportiva, rutas y datos de fases anteriores. Se respetan las instrucciones de `AGENTS.md`.

## Requisitos y desarrollo

Fedora con Podman rootless y un navegador moderno con IndexedDB y Pointer Events habilitados. Conexión a Internet para descargar dependencias e imágenes. Para desarrollo: Node.js 22.12+ y npm 10+. No se necesita Node instalado en Fedora para construir con Podman.

```bash
npm ci
npm run dev
```

Abrir http://localhost:5173. Para desarrollar en el mismo origen de producción, detener previamente el contenedor y ejecutar `npm run dev -- --port 8080`.

## Estructura

```text
src/
  domain/models.ts              Campos, hoyos, palos y validación
  domain/target.ts               Clasificación centralizada de diana
  domain/statistics.ts         Agregación pura y estadísticas personales
  domain/roundIndicators.ts     FIR, GIR, putting, penalizaciones y score derivados
  domain/rounds.ts               Entidades, resultado y continuidad
  persistence/database.ts       Esquema IndexedDB versiones 1, 2 y 3
  persistence/repository.ts     Campos, bolsa y snapshot reactivo
  persistence/roundRepository.ts Motor transaccional de rondas
  hooks/useGolfData.ts          Lectura, reintentos y escritura con bloqueo
  hooks/useRound.ts             Selección de ronda y hoyo desde URL
  components/ShotTarget.tsx     Diana circular reutilizable
  components/ShotForm.tsx       Registro y edición de normal/putt
  components/LiveRoundNav.tsx   Tarjeta, salir y deshacer
  components/                  UI, feedback y diálogos comunes
  pages/                       Pantallas de fases anteriores y tarjeta real
  App.tsx                      Rutas y navegación
  styles.css                   Paleta y diseño adaptable
  **/*.test.ts(x)              Pruebas de dominio, repositorio e interfaz
container/nginx.conf            Servidor estático y fallback SPA
Containerfile                   Node para construir; Nginx para servir
```

Los componentes nunca acceden a IndexedDB directamente. Los tipos y reglas de dominio son independientes de React y Dexie. El repositorio publica snapshots coherentes; las operaciones de ronda escriben en transacciones.

## Cómo jugar

1. En Ajustes → Mis campos, crear un campo de 9 o 18 hoyos. Par 4 inicial, editable entre 3 y 6. Favoritos primero; ampliación conserva los 9 primeros y reducción requiere confirmación.
2. En Mi bolsa de palos, personalizar nombres, categorías, disponibilidad y orden. Bolsa sugerida de 11 palos inicializada una sola vez, totalmente editable. Vaciarla no vuelve a generar la semilla.
3. Nueva ronda → seleccionar campo y 9/18 hoyos cuando el campo lo permita. Revisar pares e iniciar. Se guarda copia del nombre y pares históricos.
4. Primer golpe propone Tee. Seleccionar palo activo, diana, destino y penalización manual 0/+1/+2. **No hay diana seleccionada inicialmente.** Tocar, arrastrar, usar selectores alternativos o pulsar Recentrar son elecciones explícitas.
5. Tras guardar, Calle/Rough/Bunker/Green/Tee/Otro proponen el siguiente origen. Agua/Fuera dejan el origen sin seleccionar y exigen elegirlo manualmente; nunca añaden penalización automática.
6. Green propone putting con palo de categoría Putter. Seleccionar distancia Corto/Medio/Largo, dirección Izquierda/Centro/Derecha y resultado Muy corto/Corto/Red zone/Largo/Muy largo/Embocado (dirección opcional al embocar). Puede elegirse Normal desde Green; fuera de Green un putter se usa como golpe normal con diana. Si un putt no embocado sale del green, corregir manualmente el siguiente origen.
7. Embocar abre el resumen: golpes físicos + penalizaciones = resultado. Revisar y **confirmar explícitamente** el hoyo. Solo entonces avanzar al siguiente.
8. Tras el último hoyo confirmado, la tarjeta permite **finalizar explícitamente** la ronda. El historial conserva acceso a consulta y correcciones.

Un golpe al aire o sin desplazamiento cuenta como un golpe físico: se permite destino igual a origen, incluidos Tee y Otro. No se registran putts concedidos.

Inicio muestra la última ronda en curso y las últimas rondas; el historial permite recuperar cualquiera. Las pantallas de ronda incluyen Ver tarjeta, Deshacer último registro y Salir guardando. Deshacer requiere confirmación y solo se habilita para el último golpe del hoyo actual no confirmado. Salir conserva los registros persistidos; el formulario sin registrar no se guarda. Si sales durante un guardado ya iniciado, la transacción termina sin devolver la navegación a la pantalla anterior.

## Diana circular 5×5

SVG adaptable con tres zonas concéntricas (verde central #258654, amarillo medio #E7B65C y terracota exterior #C97862), centro y ejes reconocibles y marcador visible. Pointer Events permiten toque y arrastre con captura del puntero; `touch-action: none` evita desplazar la página dentro de la diana. Los selectores nativos de dirección/longitud permiten acceder a las mismas 25 categorías mediante teclado o tecnologías de asistencia. Referencia: [Pointer Events en MDN](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).

- Horizontal: Muy izquierda, Izquierda, Centro, Derecha, Muy derecha.
- Vertical: Muy corto, Corto, Distancia correcta, Largo, Muy largo.
- Centro + Distancia correcta se muestra como **Centro**.
- Posición normalizada `x,y` dentro del círculo unitario; `y` positivo representa largo. Fuera del círculo se limita radialmente al borde.
- Cada eje usa `[-1,-0.6)`, `[-0.6,-0.2)`, `[-0.2,0.2)`, `[0.2,0.6)`, `[0.6,1]`. Un valor exactamente en un límite pertenece al intervalo superior.
- Se persisten categorías y posición opcional para reproducción visual. No se guardan metros ni GPS, y los anillos no representan distancia métrica.
- Los colores son referencias visuales; la clasificación 5×5 depende de cada eje independientemente, nunca del radio. Durante el arrastre se muestran las categorías en tiempo real.
- `classifyTarget` es la única función de clasificación; se valida la coherencia entre punto y categorías al guardar. En putting no existe diana.

Red zone significa bola detenida muy cerca del hoyo sin embocar: referencia visual aproximada de un radio de 50 cm, sin medición obligatoria. No completa el hoyo; registrar el siguiente putt normalmente suma otro golpe. Mantener penalizaciones manuales 0/+1/+2.

Los datos preparan porcentajes de embocados y de red zone o embocados por distancia inicial, tendencias izquierda/derecha, frecuencia de cortos/largos y distribución de desviaciones por palo. La fase 5 implementa estas estadísticas personales desde rondas finalizadas.

## IndexedDB y migración

Base **`golf-tracker`**, ahora versión **3**, mediante Dexie. Se mantiene la definición de versión 1 y se añaden las tablas nuevas sin borrar campos, hoyos o bolsa. Referencia: [versionado de tablas en Dexie](<https://dexie.org/docs/Version/Version.stores()>).

| Store         | Entidad e información                                                                                                             | Índices                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `courses`     | Campo: ID, nombre, favorito, número de hoyos, creación/modificación                                                               | `id`, `nombre`                            |
| `holes`       | Hoyo de campo: ID, campoId, número, par                                                                                           | `id`, `campoId`, único `[campoId+numero]` |
| `clubs`       | Palo: ID, nombre, categoría, activo, orden, creación                                                                              | `id`, `orden`                             |
| `metadata`    | Marcador `initial-bag-v1` para semilla idempotente                                                                                | `key`                                     |
| `rounds`      | Ronda: ID, campoId, nombre histórico, inicio, fin opcional, estado, número de hoyos y revisión                                    | `id`, `inicio`, `estado`                  |
| `playedHoles` | Hoyo jugado: ID, rondaId, número, par histórico, estado pendiente/en curso/completado                                             | `id`, `rondaId`, único `[rondaId+numero]` |
| `shots`       | Golpe: ID, hoyoId, orden, tipo normal/putt, origen, paloId y nombre histórico, destino, penalización; diana o distancia inicial/dirección final/resultado | `id`, `hoyoId`, único `[hoyoId+orden]`    |

La migración v2→v3 conserva los putts antiguos con `direccion: null` como dato desconocido, sin inventar tendencias. Los nuevos fallos requieren dirección; al editar un fallo histórico se debe completarla.

IDs UUID estables y fechas ISO. Guardar/editar/eliminar golpes, renumerar y reconciliar estados de hoyos/ronda se realizan atómicamente. Editar no crea otro ID. Eliminar renumera manteniendo los IDs restantes. Los nombres históricos de los palos no cambian al renombrar o eliminar la bolsa; se permite mantener el palo histórico al corregir un registro aunque ya no esté activo.

Prevención de duplicados: bloqueo inmediato en el formulario, ID de solicitud estable e inserción idempotente en transacción. `revision` rechaza escrituras concurrentes desde pantallas desactualizadas. Una escritura fallida conserva el formulario y permite reintentar; errores de lectura ofrecen Reintentar lectura.

Editar o eliminar recalcula el resultado. Si desaparece el embocado válido, se reabre el hoyo y la ronda y se elimina la fecha final; los otros hoyos confirmados se conservan. Se detectan diferencias de superficies y golpes posteriores a un embocado sin modificar silenciosamente registros siguientes. Los avisos de superficie permiten revisión y confirmación explícita; una secuencia con golpes posteriores a un embocado no puede confirmarse.

Los datos pertenecen al **origen completo** y al perfil del navegador. Mantener `http://localhost:8080`, el mismo perfil y su almacenamiento conserva los datos al reconstruir el contenedor. `127.0.0.1:8080` y `localhost:5173` tienen almacenamientos independientes. Borrar datos del sitio o cambiar de perfil los elimina/separa. Las copias JSON completas están disponibles en Ajustes → Datos y copias de seguridad.

## Navegación

Se conservan `/`, `/rondas`, `/ronda/nueva`, `/ronda/golpe`, `/ronda/resumen`, `/estadisticas`, `/ajustes`, `/ajustes/campos` y `/ajustes/palos`. Se añade `/ronda/tarjeta` para tarjeta y resumen final. Los parámetros `r`, `h` y `edit` seleccionan IDs de ronda, hoyo y golpe; recargar esas URLs recupera datos persistidos. Sin `r`, jugar/resumen usan la última ronda en curso; un ID inválido muestra un estado útil y acceso al historial.

## Podman en Fedora

Instalación si hace falta:

```bash
sudo dnf install podman
```

Construir e iniciar, como usuario habitual sin sudo:

```bash
podman build -t golf-tracker:dev -f Containerfile .
podman run -d --name golf-tracker -p 8080:8080 golf-tracker:dev
```

Abrir **http://localhost:8080**. Nginx escucha en `0.0.0.0:8080`. Para publicar solo en el equipo usa `-p 127.0.0.1:8080:8080`.

```bash
podman logs golf-tracker
podman stop golf-tracker
podman start golf-tracker
```

Reconstruir después de cambios:

```bash
podman build -t golf-tracker:dev -f Containerfile .
podman stop golf-tracker
podman rm golf-tracker
podman run -d --name golf-tracker -p 8080:8080 golf-tracker:dev
```

**No añadir volúmenes para IndexedDB:** los datos están en el navegador, no en el contenedor. No se necesitan bind mounts ni ajustes de SELinux. Se conserva el Containerfile: Node para construir, Nginx estático en imagen final, UID `1001:0`, rootless y preparación para UID arbitrario; escrituras solo en `/tmp` y logs en stdout/stderr. Fallback SPA para todas las rutas. No se realiza despliegue OpenShift.

## Pruebas

```bash
npm run build
npm run lint
npm test
curl -4 --fail http://localhost:8080/ronda/tarjeta
```

Vitest, Testing Library, jsdom y fake-indexeddb cubren fases anteriores y motor de ronda: 25 zonas y bordes, toque/arrastre, ausencia de selección, migración v1→v2, inicio/copia de pares, normales/putts/penalizaciones, continuidad, agua/fuera, embocado/confirmación, edición/eliminación, renumeración, reapertura de ronda, finalización, recuperación, doble pulsación, revisiones y rollback.

Las pruebas de interacción no equivalen a una prueba visual/táctil en un iPhone real. La reapertura de la base se prueba con fake-indexeddb; la verificación HTTP comprueba el servidor y fallback, no ejecuta React.

## Fuera de alcance

Hándicap oficial, PWA offline, GPS, Garmin, provisionales, putts concedidos, Strokes Gained, autenticación, backend, sincronización y despliegue OpenShift. La pantalla Estadísticas incluye el módulo personal de fase 5. No quedan maquetas de registros de ronda ni datos de campo/golpes ficticios.

Están autorizadas las fases descritas hasta la fase 5. La siguiente fase requiere aprobación explícita.

## Validación de los ajustes de fase 3

Ejecutar `npm run build`, `npm run lint` y `npm test`. Las pruebas cubren las 25 combinaciones, independencia de ejes, tres colores, direcciones de putting, red zone sin completar el hoyo, siguiente putt, embocado con confirmación y persistencia de campos nuevos. La interacción se comprueba en jsdom y la persistencia en fake-indexeddb; falta validación táctil y visual en iPhone real.

Validación ejecutada para estos ajustes: `npm run build` y `npm run lint` correctos; `npm test`: **110 pruebas aprobadas en 7 archivos**. No se ha reconstruido el contenedor ni realizado validación en iPhone en esta entrega.

## Complemento fase 4: indicadores de ronda

La tarjeta de cada ronda muestra FIR y GIR con porcentaje y fracción, total de putts y media con dos decimales, golpes de penalización, score total y diferencia frente al par. Todos llevan «Parcial» hasta finalizar la ronda.

FIR usa solo hoyos confirmados par 4/5 y el destino del primer golpe desde Tee: Calle es acierto; cualquier otro destino es fallo. Par 3 no entra en el denominador. GIR usa todos los hoyos confirmados y suma golpes físicos más penalizaciones hasta la primera llegada a Green o embocado directo; consigue GIR si el acumulado no supera par - 2.

Total y media de putts usan hoyos confirmados, contando únicamente modo putting desde Green. Un putter usado fuera de Green y las penalizaciones no son putts. Red zone no completa el hoyo. Los indicadores sin denominador válido muestran «—»; FIR/GIR conservan la fracción 0/0.

Score total y penalizaciones incluyen todos los golpes registrados, también los de hoyos en curso. La diferencia frente al par compara únicamente score y par de hoyos confirmados y muestra «—» cuando aún no hay ninguno. El resumen explica este alcance para rondas parciales.

Los indicadores se calculan en el dominio a partir del snapshot; no se añaden campos ni migraciones a IndexedDB. Editar o eliminar actualiza automáticamente los valores y respeta la reapertura de hoyos existente. La fase 5 añade el módulo personal de estadísticas descrito a continuación.

Validación del complemento: `npm run build` y `npm run lint` correctos; `npm test`: **136 pruebas aprobadas en 8 archivos**, incluidas pruebas unitarias de indicadores y actualización de la tarjeta tras edición/eliminación. Sin inspección visual en iPhone ni reconstrucción del contenedor en esta entrega.

## Fase 5: estadísticas personales

Abrir **Estadísticas** (`/estadisticas`). General, Salidas, Putting y Palos comparten la selección Todas/Última/Últimas 5/10/20 rondas. Solo entran rondas finalizadas con fecha de fin válida, ordenadas por fin descendente y desempate estable por ID ascendente. Se usan las disponibles y los hoyos confirmados. La preferencia se recuerda en localStorage del mismo origen; no hay filtro por campo.

Los cálculos puros están en `src/domain/statistics.ts` y reutilizan `roundIndicators` para FIR/GIR. Los snapshots reactivos de IndexedDB actualizan todas las secciones y detalles tras correcciones. Si una edición reabre una ronda, sale del análisis hasta volver a finalizarla. La base permanece en v3; no se persisten métricas derivadas.

### Fórmulas y denominadores

- FIR = primeras salidas desde Tee a Calle / hoyos par 4 y 5 confirmados. Par 3 queda fuera.
- GIR = hoyos cuya primera llegada a Green o embocado directo ocurre con score acumulado <= par - 2 / hoyos confirmados. Score acumulado incluye golpe ejecutado y penalización de ese golpe, más los anteriores.
- Putting = golpes en modo putting desde Green. Media = total / hoyos analizados, incluidos hoyos de cero putts. Nunca incluye penalizaciones ni putter usado como golpe normal.
- Embocado, red zone o combinado por distancia = cantidad de ese resultado / putts de la distancia inicial correspondiente. Red zone no significa embocado. Las direcciones de fallos usan únicamente fallos con dirección conocida; se muestra el número de desconocidos históricos excluidos.
- Score equivalente a 18 = suma de golpes físicos y penalizaciones / hoyos × 18. Sobre par equivalente = (score total - par total) / hoyos × 18. Penalizaciones equivalentes = suma de golpes de penalización / hoyos × 18. Las rondas de 9 y 18 contribuyen por hoyo; no son scores reales ni hándicap oficial.
- Distribuciones = cantidad en categoría / muestra válida. Dispersión e índice requieren ambas categorías de diana válidas; se muestran las exclusiones.
- Índice de Precisión por eje = 100 centro/correcto, 60 media, 20 grande. Índice por golpe = promedio de ejes. Índice del palo = promedio de sus golpes normales válidos, sin ponderación por destino ni penalización. No representa calidad universal del palo.

La evolución de resultados muestra scores reales y equivalentes, de antiguo a reciente, con acceso a las tarjetas. El detalle de palo incluye matriz 5×5, ejes, destinos, penalizaciones y evolución del índice si hay al menos dos rondas válidas. Se agrupa por ID estable; se conservan nombres históricos y palos inactivos/eliminados. Putter muestra putting; si también tiene golpes normales, su detalle separa sus métricas normales. El nombre por defecto procede del registro más reciente del filtro seleccionado; se muestra el actual cuando difiere.

### Datos insuficientes y límites

Los porcentajes siempre tienen cantidades y denominadores. Sin denominador válido se muestra «—»; cero con muestra válida es un resultado real. Se avisa de muestras inferiores a 10 observaciones, sin atribuirles significación estadística. El índice no calcula distancia física ni calidad de contacto. Tee y Otro se conservan en destinos para no ocultar golpes sin desplazamiento. Los nombres/IDs históricos se conservan, pero no existe categoría histórica de palo: para palos eliminados se identifica uso de putting por los golpes registrados.

La interfaz mantiene controles táctiles, tabs navegables por teclado, leyendas textuales, indicadores de precisión y gráficos simples acompañados de cantidades. La matriz dispone de desplazamiento horizontal en pantallas estrechas. No hay navegador conectado en esta sesión: falta inspección visual/táctil en Safari/iPhone real. La persistencia y las interacciones se verifican con fake-indexeddb y jsdom.

### Verificar y reconstruir

```bash
npm exec -- tsc --noEmit
npm run lint
npm test
npm run build
```

Para actualizar el contenedor existente (se conserva el mismo origen y los datos del navegador):

```bash
podman build -t golf-tracker:dev -f Containerfile .
podman stop golf-tracker
podman rm golf-tracker
podman run -d --name golf-tracker -p 8080:8080 golf-tracker:dev
```

No se ha reconstruido el contenedor en esta entrega. No se implementan hándicap oficial, Strokes Gained, GPS, medición de golpes, cloud, backend ni OpenShift. Las copias JSON completas se verifican en la auditoría posterior descrita al final. La fase siguiente no se ha iniciado.

Validación ejecutada de fase 5: TypeScript (`npm exec -- tsc --noEmit`), lint y build correctos. **157 pruebas aprobadas en 10 archivos**. Bundle JS: 426,27 kB (133,16 kB gzip). Las nuevas pruebas cubren cálculos puros y flujo real del repositorio para finalizar, filtrar, editar y reabrir rondas; no se han generado datos de ejemplo en la base del usuario.

### Eliminación de rondas

El historial y la tarjeta permiten eliminar rondas en curso o finalizadas. El diálogo identifica el campo y la fecha y exige «Eliminar definitivamente»; cancelar conserva los datos. El borrado de ronda, hoyos jugados y golpes (incluidos putts y penalizaciones) usa una única transacción IndexedDB, conserva campos y palos y comprueba la revisión de la ronda. Las pulsaciones se bloquean durante el borrado; ante un fallo se conservan los registros y se permite reintentar. Tras eliminar se vuelve al historial con confirmación, y el snapshot reactivo actualiza las estadísticas y la disponibilidad de rondas en curso.

Verificación: `npm run lint`, `npx tsc -b`, `npm test` y `npm run build`. Las pruebas cubren cancelación, borrado de ambas clases de ronda, conservación de otras entidades, reapertura de IndexedDB, actualización de estadísticas, navegación, doble pulsación y rollback ante fallo del almacenamiento. No cambia el esquema IndexedDB v3 ni se añaden dependencias.


## Copias de seguridad y auditoría de UI/UX

Ajustes → **Datos y copias de seguridad** (`/ajustes/datos`) permite descargar y restaurar JSON de hasta 20 MiB. La restauración valida primero y, tras confirmar, sustituye todas las tablas en una única transacción: no fusiona datos. Un fallo de escritura revierte la operación completa. La preferencia de filtro de estadísticas en localStorage no pertenece a la copia.

IndexedDB permanece en v3. La copia versión 1 incluye `courses`, `holes`, `clubs`, `metadata`, `rounds`, `playedHoles` y `shots`. Cada palo conserva exactamente `id`, `nombre`, `categoria`, `activo`, `orden` y `creado`; nombre, categoría, disponibilidad y orden son las personalizaciones reales. Se exporta toda la tabla, incluidos los inactivos. Los palos ya eliminados se representan mediante sus referencias históricas declaradas y los golpes conservan `paloId` y `paloNombre`; no se inventan entidades ni se vinculan por nombre.

La auditoría añadió pruebas de exportación/restauración de bolsa, ida y vuelta tras modificar bolsa y rondas, IDs y orden, palos históricos, estadísticas reactivas, duplicados, rechazo de copias inválidas y rollback. El sistema de backup existente no necesitó reescritura. Se mantiene el diseño oscuro, los gráficos aprobados y la lógica de golf.

Consulta [AUDIT.md](AUDIT.md) para el alcance, archivos y validación. La revisión de UI fue estática: no hubo navegador conectado ni capturas. Quedan pendientes las comprobaciones visuales a 320/375/390/430/768/1280 px y Safari/iPhone con teclado abierto. Las pruebas jsdom no verifican layout ni contraste renderizado.
