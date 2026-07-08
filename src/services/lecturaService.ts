import { db } from '../config/db';
import { lectura_sensor, historial_lectura_sensor, dispositivo_simonia, colmena, ubicacion_apiario } from '../config/db/schema';
import { eq, desc, gte, sql } from 'drizzle-orm';

export type LecturaInput = {
  codigo_dispositivo: string; // codigo_unico del dispositivo físico
  temperatura_c?: number;
  humedad_h?: number;
  peso_kg?: number;
  sonido_hz?: number;
  presion_hpa?: number;
  fecha_registro?: string; // Para simulaciones históricas
};

export type UbicacionGPSInput = {
  codigo_dispositivo: string;
  latitud: number;
  longitud: number;
  locacion?: string;
};

export async function createUbicacionApiarioByCodigo(payload: UbicacionGPSInput) {
  const rows = await db
    .select({
      dispositivo: dispositivo_simonia,
      colmena: colmena
    })
    .from(dispositivo_simonia)
    .leftJoin(colmena, eq(colmena.id_dispositivo, dispositivo_simonia.id))
    .where(eq(dispositivo_simonia.codigo_unico, payload.codigo_dispositivo))
    .limit(1);

  const row = rows[0];

  if (!row || !row.dispositivo) {
    throw new Error('Dispositivo no encontrado');
  }

  if (!row.colmena) {
    throw new Error('El dispositivo no está asignado a ninguna colmena');
  }

  if (!row.colmena.id_apiario_actual) {
    throw new Error('La colmena no tiene apiario asignado');
  }

  const ubicacionPayload = {
    id_apiario: row.colmena.id_apiario_actual,
    locacion: payload.locacion || `GPS ${payload.codigo_dispositivo}`,
    latitud: payload.latitud,
    longitud: payload.longitud,
  };

  const result = await db
    .insert(ubicacion_apiario)
    .values(ubicacionPayload)
    .returning();

  const ubicacionCreada = result[0];

  if (!ubicacionCreada) {
    throw new Error('Error al guardar la ubicación GPS');
  }

  return {
    ubicacion: ubicacionCreada,
    apiario: { id: row.colmena.id_apiario_actual },
    colmena: {
      id: row.colmena.id,
      nombre_colmena: row.colmena.nombre_colmena
    },
    dispositivo: {
      id: row.dispositivo.id,
      codigo_unico: row.dispositivo.codigo_unico
    },
  };
}

export async function createLecturaSensorByCodigo(payload: LecturaInput) {
  // 1. Buscar dispositivo y colmena asociada en UNA sola consulta usando JOIN
  const rows = await db
    .select({
      dispositivo: dispositivo_simonia,
      colmena: colmena
    })
    .from(dispositivo_simonia)
    .leftJoin(colmena, eq(colmena.id_dispositivo, dispositivo_simonia.id))
    .where(eq(dispositivo_simonia.codigo_unico, payload.codigo_dispositivo))
    .limit(1);

  const row = rows[0];
  if (!row || !row.dispositivo) throw new Error('Dispositivo no encontrado');
  if (!row.colmena) throw new Error('El dispositivo no está asignado a ninguna colmena');

  const { dispositivo, colmena: colmenaAsignada } = row;

  // Validar que existe al menos un dato de sensor
  if (
    payload.temperatura_c === undefined &&
    payload.humedad_h === undefined &&
    payload.peso_kg === undefined &&
    payload.sonido_hz === undefined &&
    payload.presion_hpa === undefined
  ) {
    throw new Error('Debe enviar al menos un valor de sensor');
  }

  const insertValues: any = {
    id_colmena: colmenaAsignada.id,
    id_dispositivo: dispositivo.id,
  };

  if (payload.temperatura_c !== undefined) insertValues.temperatura_c = payload.temperatura_c;
  if (payload.humedad_h !== undefined) insertValues.humedad_h = payload.humedad_h;
  if (payload.peso_kg !== undefined) insertValues.peso_kg = payload.peso_kg;
  if (payload.sonido_hz !== undefined) insertValues.sonido_hz = payload.sonido_hz;
  if (payload.presion_hpa !== undefined) insertValues.presion_hpa = payload.presion_hpa;
  if (payload.fecha_registro !== undefined) {
    insertValues.fecha_registro = payload.fecha_registro;
  }

  // 1. Insertar en lectura_sensor (tabla principal) - CRÍTICO, debe completarse
  const result = await db.insert(lectura_sensor).values(insertValues).returning();
  const lecturaCreada = result[0];

  if (!lecturaCreada) throw new Error('Error al guardar la lectura principal');

  // 2. ⚡ FIRE & FORGET: Guardar historial en segundo plano para no bloquear respuesta
  setImmediate(() => {
    db.insert(historial_lectura_sensor).values({
      id_lectura: lecturaCreada.id,
      temperatura_c: insertValues.temperatura_c,
      humedad_h: insertValues.humedad_h,
      peso_kg: insertValues.peso_kg,
      sonido_hz: insertValues.sonido_hz,
      presion_hpa: insertValues.presion_hpa,
      fecha_registro: insertValues.fecha_registro || lecturaCreada.fecha_registro,
    }).catch(err => console.error('Error guardando historial (async):', err));
  });

  // Retornamos solo lo esencial para reducir payload de respuesta
  return {
    lectura: lecturaCreada,
    colmena: { id: colmenaAsignada.id, nombre_colmena: colmenaAsignada.nombre_colmena },
    dispositivo: { id: dispositivo.id, codigo_unico: dispositivo.codigo_unico },
  };
}

export async function getLecturasByColmena(colmenaId: string, limit = 50) {
  const [colmenaRows, lecturaRows] = await Promise.all([
    db
      .select({ nombre_colmena: colmena.nombre_colmena })
      .from(colmena)
      .where(eq(colmena.id, colmenaId))
      .limit(1),
    db
      .select()
      .from(lectura_sensor)
      .where(eq(lectura_sensor.id_colmena, colmenaId))
      .orderBy(desc(lectura_sensor.fecha_registro))
      .limit(limit),
  ]);

  return {
    nombre_colmena: colmenaRows[0]?.nombre_colmena || 'Colmena',
    lecturas: lecturaRows,
  };
}

export async function getLecturasByCodigoDispositivo(codigo_unico: string, limit = 50) {
  const dispositivoRows = await db
    .select()
    .from(dispositivo_simonia)
    .where(eq(dispositivo_simonia.codigo_unico, codigo_unico));
  const dispositivo = dispositivoRows[0];
  if (!dispositivo) throw new Error('Dispositivo no encontrado');

  const colmenaRows = await db
    .select()
    .from(colmena)
    .where(eq(colmena.id_dispositivo, dispositivo.id));
  const colmenaAsignada = colmenaRows[0];
  if (!colmenaAsignada) throw new Error('El dispositivo no está asignado a ninguna colmena');

  const { lecturas } = await getLecturasByColmena(colmenaAsignada.id, limit);
  return lecturas;
}

export async function getUltimaLecturaByColmena(colmenaId: string) {
  const rows = await db
    .select()
    .from(lectura_sensor)
    .where(eq(lectura_sensor.id_colmena, colmenaId))
    .orderBy(desc(lectura_sensor.fecha_registro))
    .limit(1);
  return rows[0] || null;
}

/**
 * Obtiene la última lectura que tenga sonido válido (>= 100 Hz)
 */
export async function getUltimaLecturaValidaByColmena(colmenaId: string) {
  const rows = await db
    .select()
    .from(lectura_sensor)
    .where(
      sql`${lectura_sensor.id_colmena} = ${colmenaId} AND ${lectura_sensor.sonido_hz} >= 100`
    )
    .orderBy(desc(lectura_sensor.fecha_registro))
    .limit(1);
  return rows[0] || null;
}

// 📊 FUNCIONES PARA GRÁFICOS (usa historial_lectura_sensor)

/**
 * Obtiene historial de lecturas para gráficos
 * @param colmenaId - ID de la colmena
 * @param dias - Días hacia atrás (default: 7)
 */
export async function getHistorialParaGraficos(colmenaId: string, dias = 7) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);
  const fechaLimiteISO = fechaLimite.toISOString();

  const historial = await db
    .select({
      temperatura_c: historial_lectura_sensor.temperatura_c,
      humedad_h: historial_lectura_sensor.humedad_h,
      peso_kg: historial_lectura_sensor.peso_kg,
      sonido_hz: historial_lectura_sensor.sonido_hz,
      presion_hpa: historial_lectura_sensor.presion_hpa,
      fecha_registro: historial_lectura_sensor.fecha_registro,
    })
    .from(historial_lectura_sensor)
    .innerJoin(lectura_sensor, eq(historial_lectura_sensor.id_lectura, lectura_sensor.id))
    .where(
      sql`${lectura_sensor.id_colmena} = ${colmenaId} AND ${historial_lectura_sensor.fecha_registro} >= ${fechaLimiteISO}`
    )
    .orderBy(historial_lectura_sensor.fecha_registro);

  return historial;
}

/**
 * Obtiene estadísticas agregadas para gráficos de resumen
 */
export async function getEstadisticasColmena(colmenaId: string, dias = 7) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);
  const fechaLimiteISO = fechaLimite.toISOString();

  const stats = await db
    .select({
      temp_promedio: sql<number>`AVG(${historial_lectura_sensor.temperatura_c})`,
      temp_max: sql<number>`MAX(${historial_lectura_sensor.temperatura_c})`,
      temp_min: sql<number>`MIN(${historial_lectura_sensor.temperatura_c})`,
      humedad_promedio: sql<number>`AVG(${historial_lectura_sensor.humedad_h})`,
      peso_promedio: sql<number>`AVG(${historial_lectura_sensor.peso_kg})`,
      peso_max: sql<number>`MAX(${historial_lectura_sensor.peso_kg})`,
      peso_min: sql<number>`MIN(${historial_lectura_sensor.peso_kg})`,
      total_lecturas: sql<number>`COUNT(*)`,
    })
    .from(historial_lectura_sensor)
    .innerJoin(lectura_sensor, eq(historial_lectura_sensor.id_lectura, lectura_sensor.id))
    .where(
      sql`${lectura_sensor.id_colmena} = ${colmenaId} AND ${historial_lectura_sensor.fecha_registro} >= ${fechaLimiteISO}`
    );

  return stats[0];
}
