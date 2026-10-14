import { categories, type Club, type Course, type Hole } from "./models";
import { canConfirmHole, destinations, origins, puttDirections, puttResults, validateShot, type PlayedHole, type Round, type Shot } from "./rounds";
import { horizontalZones, verticalZones } from "./target";

export const backupFormat = "golf-tracker-backup";
export const backupVersion = 1;
export const maxBackupBytes = 20 * 1024 * 1024;
export interface BackupData {
  courses: Course[];
  holes: Hole[];
  clubs: Club[];
  metadata: { key: string; value: boolean }[];
  rounds: Round[];
  playedHoles: PlayedHole[];
  shots: Shot[];
}
export interface Backup {
  format: typeof backupFormat;
  version: 1;
  exportedAt: string;
  data: BackupData;
  historicalReferences: { courseIds: string[]; clubIds: string[] };
}
function fail(reason: string): never { throw new Error(`Copia de seguridad no válida: ${reason}`); }
function check(condition: unknown, reason: string): asserts condition { if (!condition) fail(reason); }
function object(value: unknown): Record<string, unknown> {
  check(value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, "se esperaba un objeto JSON.");
  return value as Record<string, unknown>;
}
function shape(value: unknown, required: string[], optional: string[] = []) {
  const row = object(value);
  check(required.every(key => Object.hasOwn(row, key)) && Object.keys(row).every(key => [...required, ...optional].includes(key)), "faltan campos obligatorios o hay campos desconocidos.");
  return row;
}
function text(value: unknown, max = 200) {
  check(typeof value === "string" && value.trim().length > 0 && value.length <= max && !Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  }), "cadena vacía, demasiado larga o con caracteres de control.");
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) { check(Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max, "número entero fuera de rango."); }
function enumeration(value: unknown, options: readonly unknown[]) { check(options.includes(value), "valor de enumeración desconocido."); }
function date(value: unknown) {
  check(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, "fecha ISO UTC no válida.");
}
function list(value: unknown): unknown[] { check(Array.isArray(value) && value.length <= 100_000, "se esperaba una lista de hasta 100.000 registros."); return value; }
function entities(value: unknown, validate: (row: Record<string, unknown>) => void) {
  const seen = new Set<string>();
  for (const raw of list(value)) {
    const row = object(raw); text(row.id);
    check(!seen.has(row.id as string), "identificadores duplicados."); seen.add(row.id as string); validate(row);
  }
}
function groups<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) { const id = key(row); const group = grouped.get(id) ?? []; group.push(row); grouped.set(id, group); }
  return grouped;
}
function ordered<T>(rows: T[], size: number, order: (row: T) => number) {
  const numbers = rows.map(order).sort((a, b) => a - b);
  check(numbers.length === size && numbers.every((value, i) => value === i + 1), "secuencia incompleta o números duplicados.");
}
function historicalIds(value: unknown, missing: Set<string>) {
  const ids = list(value); ids.forEach(id => text(id));
  check(ids.length === missing.size && new Set(ids).size === ids.length && ids.every(id => missing.has(id as string)), "referencias históricas inexistentes, duplicadas o incompletas.");
}

/** Version dispatch is kept separate so a future format can migrate before validation. */
export function validateBackup(input: unknown): Backup {
  const root = object(input);
  check(root.format === backupFormat, "formato desconocido.");
  check(root.version === backupVersion, "versión incompatible. Esta aplicación solo admite la versión 1.");
  shape(root, ["format", "version", "exportedAt", "data", "historicalReferences"]); date(root.exportedAt);
  const data = shape(root.data, ["courses", "holes", "clubs", "metadata", "rounds", "playedHoles", "shots"]);
  entities(data.courses, row => {
    shape(row, ["id", "nombre", "favorito", "numeroHoyos", "creado", "modificado"]);
    text(row.nombre, 100); check(typeof row.favorito === "boolean", "favorito debe ser booleano."); enumeration(row.numeroHoyos, [9, 18]); date(row.creado); date(row.modificado);
  });
  entities(data.holes, row => { shape(row, ["id", "campoId", "numero", "par"]); text(row.campoId); integer(row.numero, 1, 18); integer(row.par, 3, 6); });
  entities(data.clubs, row => {
    shape(row, ["id", "nombre", "categoria", "activo", "orden", "creado"]); text(row.nombre, 60); enumeration(row.categoria, categories); check(typeof row.activo === "boolean", "activo debe ser booleano."); integer(row.orden); date(row.creado);
  });
  const metadata = list(data.metadata);
  check(metadata.length <= 1, "metadatos duplicados o desconocidos.");
  metadata.forEach(row => { const record = shape(row, ["key", "value"]); check(record.key === "initial-bag-v1" && typeof record.value === "boolean", "metadatos desconocidos."); });
  entities(data.rounds, row => {
    shape(row, ["id", "campoId", "campoNombre", "inicio", "estado", "numeroHoyos", "revision"], ["fin"]);
    text(row.campoId); text(row.campoNombre, 100); date(row.inicio); enumeration(row.estado, ["en curso", "finalizada"]); enumeration(row.numeroHoyos, [9, 18]); integer(row.revision);
    if (row.estado === "finalizada") { date(row.fin); check(Date.parse(row.fin as string) >= Date.parse(row.inicio as string), "fin anterior al inicio."); }
    else check(!Object.hasOwn(row, "fin"), "una ronda en curso no puede tener fecha final.");
  });
  entities(data.playedHoles, row => { shape(row, ["id", "rondaId", "numero", "par", "estado"]); text(row.rondaId); integer(row.numero, 1, 18); integer(row.par, 3, 6); enumeration(row.estado, ["pendiente", "en curso", "completado"]); });
  entities(data.shots, row => {
    const common = ["id", "hoyoId", "orden", "tipo", "origen", "paloId", "paloNombre", "destino", "penalizacion"];
    enumeration(row.tipo, ["normal", "putt"]); shape(row, [...common, ...(row.tipo === "normal" ? ["diana"] : ["distancia", "resultado", "direccion"])]);
    text(row.hoyoId); text(row.paloId); text(row.paloNombre, 60); integer(row.orden, 1); enumeration(row.origen, origins); enumeration(row.destino, destinations); enumeration(row.penalizacion, [0, 1, 2]);
    if (row.tipo === "normal") {
      const target = shape(row.diana, ["horizontal", "vertical"], ["point"]);
      enumeration(target.horizontal, horizontalZones); enumeration(target.vertical, verticalZones);
      if (Object.hasOwn(target, "point")) { const point = shape(target.point, ["x", "y"]); check(typeof point.x === "number" && typeof point.y === "number" && Number.isFinite(point.x) && Number.isFinite(point.y), "posición de diana no válida."); }
      validateShot(row as unknown as Shot);
    } else {
      check(row.origen === "Green", "un putt debe proceder de Green."); enumeration(row.distancia, ["Corto", "Medio", "Largo"]); enumeration(row.resultado, puttResults);
      // Legacy misses can have unknown direction: preserve null, never invent it.
      check(row.direccion === null || puttDirections.includes(row.direccion as never), "dirección de putting no válida.");
      check(row.destino === (row.resultado === "Embocado" ? "Hoyo" : "Green"), "resultado y destino de putting incoherentes.");
    }
  });
  const backup = input as Backup;
  const d = backup.data;
  check(metadata.length > 0 || (d.courses.length + d.holes.length + d.clubs.length + d.rounds.length + d.playedHoles.length + d.shots.length === 0), "falta el marcador de inicialización.");
  const courses = new Set(d.courses.map(row => row.id));
  const clubs = new Set(d.clubs.map(row => row.id));
  const rounds = new Set(d.rounds.map(row => row.id));
  const holes = new Set(d.playedHoles.map(row => row.id));
  d.holes.forEach(row => check(courses.has(row.campoId), "hoyo sin campo existente."));
  d.playedHoles.forEach(row => check(rounds.has(row.rondaId), "hoyo jugado sin ronda existente."));
  d.shots.forEach(row => check(holes.has(row.hoyoId), "golpe sin hoyo jugado existente."));
  const courseHoles = groups(d.holes, row => row.campoId);
  const played = groups(d.playedHoles, row => row.rondaId);
  const shots = groups(d.shots, row => row.hoyoId);
  d.courses.forEach(row => ordered(courseHoles.get(row.id) ?? [], row.numeroHoyos, hole => hole.numero));
  d.rounds.forEach(row => { const children = played.get(row.id) ?? []; ordered(children, row.numeroHoyos, hole => hole.numero); if (row.estado === "finalizada") check(children.every(hole => hole.estado === "completado"), "ronda finalizada con hoyos sin confirmar."); });
  d.playedHoles.forEach(row => {
    const children = (shots.get(row.id) ?? []).sort((a, b) => a.orden - b.orden);
    ordered(children, children.length, shot => shot.orden);
    if (row.estado === "completado") check(canConfirmHole(children), "hoyo confirmado sin embocado final válido.");
    if (row.estado === "pendiente") check(children.length === 0, "hoyo pendiente con golpes.");
  });
  const history = shape(root.historicalReferences, ["courseIds", "clubIds"]);
  historicalIds(history.courseIds, new Set(d.rounds.filter(row => !courses.has(row.campoId)).map(row => row.campoId)));
  historicalIds(history.clubIds, new Set(d.shots.filter(row => !clubs.has(row.paloId)).map(row => row.paloId)));
  return backup;
}
export function parseBackup(text: string): Backup {
  check(new Blob([text]).size <= maxBackupBytes, "el archivo supera 20 MiB.");
  let value: unknown;
  try { value = JSON.parse(text, (key, item: unknown) => { if (["__proto__", "prototype", "constructor"].includes(key)) fail("clave insegura."); return item; }); }
  catch (error) { if (error instanceof Error && error.message.startsWith("Copia de seguridad")) throw error; fail("el archivo no contiene JSON válido."); }
  return validateBackup(value);
}
export function createBackup(data: BackupData, exportedAt = new Date().toISOString()): Backup {
  const courses = new Set(data.courses.map(row => row.id)); const clubs = new Set(data.clubs.map(row => row.id));
  return validateBackup({ format: backupFormat, version: backupVersion, exportedAt, data, historicalReferences: {
    courseIds: [...new Set(data.rounds.filter(row => !courses.has(row.campoId)).map(row => row.campoId))],
    clubIds: [...new Set(data.shots.filter(row => !clubs.has(row.paloId)).map(row => row.paloId))],
  } });
}
