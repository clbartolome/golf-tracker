# AGENTS.md — Golf Tracker

## Propósito

Golf Tracker es una aplicación web para registrar y analizar golpes de golf durante rondas informales de 9 o 18 hoyos.

Su objetivo es permitir un registro estructurado, completo y ágil desde un iPhone, y obtener estadísticas sobre resultados, palos, desviaciones, putting y penalizaciones.

## Entorno y arquitectura

- Desarrollo en Fedora con Codex.
- React, TypeScript y Vite.
- Aplicación web responsive, mobile-first.
- Contenedor OCI ejecutable con Podman.
- Servidor de archivos estáticos en producción.
- Puerto HTTP interno y externo previsto: 8080.
- Futuro despliegue en OpenShift.
- Sin backend ni base de datos en servidor.
- Persistencia local mediante IndexedDB versionado.
- Exportación e importación futura de copias JSON completas.
- PWA instalable y offline en una fase posterior.

## Principios

1. Mantener el alcance de cada fase estrictamente limitado.
2. Separar lógica de dominio, persistencia y componentes visuales.
3. Priorizar la experiencia táctil en iPhone.
4. No introducir servicios externos, autenticación ni APIs innecesarias.
5. No utilizar datos ficticios como si fueran reales.
6. Mantener accesibilidad, contraste y controles táctiles adecuados.
7. Conservar identificadores estables en las futuras entidades.
8. Evitar dependencias innecesarias.
9. Preparar el contenedor para ejecutarse sin root y con UID arbitrario en OpenShift.
10. Añadir instrucciones reproducibles de construcción y ejecución.

## Modelo funcional aprobado

### Campos

- Creación manual.
- Campos favoritos.
- 9 o 18 hoyos.
- Par configurable por hoyo.
- Los pares históricos de una ronda no cambian cuando se modifica el campo.

### Bolsa de palos

- Lista inicial de palos habituales.
- Personalización de nombre, disponibilidad y orden.
- Conservación de estadísticas históricas.

### Rondas

- Informales.
- 9 o 18 hoyos.
- Guardado y recuperación de rondas en curso.
- Finalización de un hoyo únicamente después de registrar un golpe embocado y confirmar.

### Golpes normales

- Origen: tee, calle, rough, bunker, green u otro.
- Palo.
- Diana circular 5×5, con 25 categorías relativas al objetivo previsto.
- Eje horizontal: Muy izquierda, Izquierda, Centro, Derecha, Muy derecha.
- Eje vertical: Muy corto, Corto, Distancia correcta, Largo, Muy largo.
- La combinación horizontal Centro / vertical Distancia correcta se llama «Centro».
- Cada eje normalizado usa intervalos [-1, -0.6), [-0.6, -0.2), [-0.2, 0.2), [0.2, 0.6), [0.6, 1]. Los límites pertenecen al intervalo superior; y positivo es largo.
- Anillos: verde central (#258654), amarillo de desviación media (#E7B65C), terracota de desviación grande (#C97862). Solo referencia visual, sin distancias físicas.
- Clasificar horizontal y vertical independientemente; el radio y los colores nunca sustituyen las categorías 5×5. Mostrar ambos ejes en tiempo real durante toque y arrastre.
- La posición se limita al círculo. No representa metros, radio de distancia ni coordenadas GPS.
- No hay selección inicial: seleccionar explícitamente antes de guardar. Recentrar es una selección manual.
- Interacción mediante Pointer Events (toque y arrastre), con controles alternativos accesibles.
- Persistir categorías y opcionalmente posición normalizada visual.
- Destino: calle, rough, bunker, green, agua, fuera u hoyo.
- Penalización manual: 0, 1 o 2.
- Cada golpe ejecutado cuenta como un golpe; las penalizaciones se suman al resultado sin crear golpes físicos.

### Putting

- Registro específico cuando se juega desde green.
- Distancia inicial: corto, medio o largo.
- Dirección final: izquierda, centro o derecha; puede ser nula para embocado.
- Resultado de distancia: muy corto, corto, red zone, largo, muy largo o embocado.
- Red zone: bola detenida muy cerca del hoyo sin embocar; radio visual aproximado de 50 cm en v1, sin exigir medición.
- Red zone NO significa embocado y NO completa el hoyo. Registrar el siguiente putt normalmente como otro golpe.
- Penalizaciones manuales: 0, +1 o +2.
- Persistir distancia inicial, dirección final y resultado separados. En putts históricos sin dirección registrada conservar null como desconocido; exigir dirección al registrar o editar un fallo.
- El putt es un golpe, no una entidad que sume un segundo golpe.
- No hay putts concedidos.

### Continuidad

- El destino del golpe anterior propone el origen del siguiente.
- Agua y fuera requieren seleccionar el siguiente origen manualmente.
- El golpe embocado propone la confirmación del hoyo.
- Editar golpes debe recalcular resultados y comprobar la continuidad.

### Estadísticas futuras

- Resultados por ronda y hoyo.
- Resultado frente al par.
- Penalizaciones.
- Rendimiento por palo.
- Distribución de las 25 categorías de la diana 5×5.
- Porcentaje de putts embocados por distancia inicial.
- Porcentaje de putts en red zone o embocados por distancia inicial.
- Tendencia de fallos a izquierda/derecha y frecuencia de putts cortos/largos.
- Distribución de desviaciones por palo para golpes normales.
- Preparar estos datos sin implementar estadísticas avanzadas en fase 3; excluir direcciones históricas desconocidas de las tendencias direccionales.
- Putts por hoyo.
- Tendencias entre rondas.
- Mostrar tamaños de muestra.

## Fuera de alcance de la v1

- GPS y medición de distancias normales.
- Integración con Garmin.
- Directorios externos de campos.
- Sincronización cloud.
- Usuarios y autenticación.
- Golpes provisionales.
- Putts concedidos.
- Calidad del contacto.
- Strokes Gained.

## Diseño visual

Estilo deportivo moderno.

- Verde principal: #123C2D.
- Verde de acción: #258654.
- Fondo claro: #F4F7F2.
- Advertencia: #E7B65C.
- Error: #C94D49.

La interfaz debe resultar limpia, legible y usable bajo luz solar.

## Forma de trabajo

Implementar por fases pequeñas y verificables. No anticipar funcionalidades de fases posteriores.

Al terminar cada fase, indicar:
- Archivos creados o modificados.
- Decisiones técnicas relevantes.
- Comandos para probarla.
- Pruebas realizadas y sus resultados.
- Limitaciones y tareas pendientes.

## Fase 3 — reglas de ronda

- Conservar una copia del nombre del campo, pares y nombres de palos en los registros históricos.
- Un golpe normal admite Green; desde Green se propone putting pero se puede cambiar a normal.
- Para golpes al aire o sin desplazamiento, permitir destino igual al origen, también Tee y Otro.
- Todo putt no embocado (incluido red zone) propone Green; el siguiente origen se puede corregir manualmente.
- Embocar no confirma automáticamente. Confirmar explícitamente el hoyo y finalizar explícitamente la ronda.
- Edición y eliminación conservan IDs existentes, renumeran y recalculan; las inconsistencias se avisan sin alterar golpes posteriores.
- Si se pierde el embocado final, reabrir el hoyo y la ronda. Deshacer solo el último golpe de un hoyo no confirmado.
- Guardado transaccional, prevención de doble registro y control de revisiones para cambios concurrentes.

## Fase 3 — pruebas obligatorias de estos ajustes

- Las 25 combinaciones de la diana, límites y clasificación independiente de ambos ejes, sin usar el radio como categoría.
- Tres colores diferenciados y clasificación en tiempo real mediante toque y arrastre.
- Dirección final de putts y validación de dirección nula solo para embocado en nuevos registros.
- Red zone no confirma ni completa el hoyo; el siguiente putt añade un golpe físico.
- Embocado propone confirmación explícita; nunca finaliza automáticamente.
- Persistencia y recuperación de distancia inicial, dirección y resultado; migración sin inventar dirección histórica.
- Mantener todas las demás reglas de fase 3. Las ampliaciones autorizadas están descritas en las fases 4 y 5 siguientes.

## Complemento fase 4 — indicadores de ronda

- Mostrar en la tarjeta/resumen de cada ronda FIR, GIR, media y total de putts, golpes de penalización, score total y diferencia frente al par.
- Derivar todos los indicadores de los registros reales mediante lógica de dominio; no persistir porcentajes ni medias. Recalcular desde el snapshot al editar o eliminar.
- FIR: solo hoyos confirmados par 4/5; destino Calle del primer golpe desde Tee. Otro destino o ausencia de salida a Calle es fallo. Excluir par 3 del denominador.
- GIR: solo hoyos confirmados; sumar golpes físicos y penalizaciones hasta la primera llegada a Green (o embocado directo). Conseguido si acumulado <= par - 2; sin llegada dentro del margen, fallo.
- FIR/GIR: mostrar porcentaje y fracción numerador/denominador; con denominador cero mostrar «—» en lugar de 0 %.
- Putting: contar solo modo putting desde Green en hoyos confirmados; excluir golpes normales con putter y penalizaciones. Mostrar total y media sobre hoyos confirmados con dos decimales; sin hoyos confirmados mostrar «—» para la media. Red zone no completa el hoyo.
- Penalizaciones y score total: sumar todos los golpes registrados de la ronda, incluidos los de hoyos en curso; sumar valores de penalización, no incidentes.
- Diferencia frente al par en rondas en curso: comparar score y par de los mismos hoyos confirmados, explicando el alcance. Sin hoyos confirmados mostrar «—».
- Etiquetar cada indicador «Parcial» hasta finalizar la ronda o si está incompleta.
- Pruebas unitarias para FIR, GIR, putting, penalizaciones, denominadores vacíos, edición/eliminación y aislamiento entre rondas; comprobar integración del resumen reactivo.
- Mantener arquitectura actual. El alcance de estadísticas personales se amplía únicamente mediante la fase 5 siguiente.

## Fase 5 — estadísticas personales

- Módulo `/estadisticas` con General, Salidas, Putting y Palos; detalle mediante `seccion=Palos&palo=<ID>` y navegación de regreso.
- Reutilizar IndexedDB v3, snapshot reactivo, lógica de ronda, paleta y componentes. Sin backend, servicios externos ni métricas derivadas persistidas.
- Filtro global: todas, última, últimas 5/10/20 rondas finalizadas con fecha de fin válida. Orden por fin descendente y desempate por ID ascendente; usar las disponibles. Solo hoyos confirmados de dichas rondas. Sin filtro por campo.
- Recordar únicamente la preferencia de filtro en localStorage; si falla, mantener selección en sesión y avisar. No almacenar porcentajes, medias o índices.
- Funciones puras en `domain/statistics.ts`: selección, agregación, FIR/GIR, putting, penalizaciones, normalización, diana/dispersión, destinos e índice por palo.
- General: rondas/hoyos, FIR/GIR con fracciones, media de putts, score, sobre par y penalizaciones equivalentes a 18 hoyos; evolución por ronda con score real y equivalente y destinos normales.
- Equivalentes: suma de la métrica / hoyos analizados × 18; sobre par usa suma(score - par). No promediar rondas de distinto tamaño con igual peso; no llamar hándicap oficial a estas métricas.
- Salidas: primer golpe desde Tee de cada hoyo confirmado, ejes 5 categorías, destinos, muestra y FIR par 4/5. No convertir diana a metros.
- Putting: solo modo putting desde Green; total/media, hoyos 0/1/2/3+, embocado, red zone y combinado por distancia inicial, resultados y dirección de fallos conocidos. Excluir embocados y fallos sin dirección de tendencias direccionales, indicando desconocidos. Red zone no emboca; penalizaciones no son putts.
- Palos: agrupar por ID estable, incluir palos actuales sin golpes y referencias históricas aunque eliminados/inactivos. Mostrar nombres registrados y actual si cambió.
- Precisión: puntuaciones por eje 100 centro/correcto, 60 desviación media, 20 grande; promedio de ejes por golpe y promedio de golpes normales con ambas categorías válidas. Excluir dianas incompletas e informar número. No ponderar destino ni penalización. No mide calidad universal del palo.
- Putter: usar métricas de putting. Si también tiene golpes normales, mostrar sus distribuciones/índice por separado en el detalle. No inferir categoría histórica a partir del nombre; para palos eliminados el modo putting registrado identifica su uso.
- Detalle: datos solo del filtro actual, índice, distribuciones, matriz 5×5 con cantidades/porcentajes, destinos, penalizaciones y evolución cuando hay al menos dos rondas con diana válida.
- Destinos incluyen Embocado (destino Hoyo), Calle, Rough, Bunker, Green, Agua, Fuera, además de Tee/Otro para conservar golpes sin desplazamiento.
- Sin denominador válido, mostrar «—», nunca porcentaje cero inventado. Un cero con muestra válida es real. Muestra pequeña: menos de 10 observaciones; aviso descriptivo, sin inferencia estadística.
- Accesibilidad: tabs por teclado, texto y cantidades junto a gráficos, leyendas, estados vacíos, diseño mobile-first; no depender solo de colores.
- Comprobar selección, exclusión de rondas abiertas, cálculos y normalización 9/18, dianas incompletas, índice, palos sin golpes, destinos, persistencia del filtro y actualización/reapertura tras correcciones.
- Ejecutar TypeScript, lint, pruebas y build. No implementar hándicap oficial, Strokes Gained, GPS, distancias métricas, cloud, backend, copias JSON ni OpenShift. Detenerse antes de fase 6.
