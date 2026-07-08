import { pgTable, uuid, text, numeric, integer, boolean, varchar, char, jsonb, inet, timestamp, date, index, pgEnum } from 'drizzle-orm/pg-core';

// 🧱 empresa
export const empresa = pgTable('empresa', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull(),
  pais: varchar('pais'),
  direccion: text('direccion'),
  telefono: varchar('telefono'),
  correo_contacto: text('correo_contacto').unique(),
  estado_empresa: varchar('estado_empresa').default('activa'),
  fecha_registro: timestamp('fecha_registro').defaultNow(),
});

// 🧱 usuario
export const usuario = pgTable('usuario', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_empresa: uuid('id_empresa').references(() => empresa.id),
  nombre: text('nombre').notNull(),
  correo: text('correo').notNull().unique(),
  password: text('password').notNull(),
  tipo_usuario: varchar('tipo_usuario'),
  fecha_nacimiento: date('fecha_nacimiento'),
  direccion: text('direccion'),
  ciudad: text('ciudad'),
  region: text('region'),
  pais: text('pais').default('Chile'),
  rut: varchar('rut').unique(),
  telefono: varchar('telefono'),
  foto_url: text('foto_url'), // ← NUEVA COLUMNA
  fecha_creacion: timestamp('fecha_creacion').defaultNow(),
}, (table) => {
  return {
    id_empresa_idx: index('usuario_id_empresa_idx').on(table.id_empresa),
  };
});

// 🧱 rol
export const rol = pgTable('rol', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre').notNull().unique(),
  descripcion: text('descripcion'),
});

// 🧱 usuario_rol
export const usuario_rol = pgTable('usuario_rol', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_usuario: uuid('id_usuario').references(() => usuario.id),
  id_rol: uuid('id_rol').references(() => rol.id),
  fecha_asignacion: timestamp('fecha_asignacion').defaultNow(),
});

// 🧱 apiario
export const apiario = pgTable('apiario', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_empresa: uuid('id_empresa').references(() => empresa.id),
  nombre: text('nombre').notNull(),
  limite_colmenas: integer('limite_colmenas').default(100),
  fecha_creacion: timestamp('fecha_creacion').defaultNow(),
}, (table) => {
  return {
    id_empresa_idx: index('apiario_id_empresa_idx').on(table.id_empresa),
  };
});

// 🧱 dispositivo_simonia
export const dispositivo_simonia = pgTable('dispositivo_simonia', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_propietario: uuid('id_propietario').references(() => empresa.id),
  codigo_unico: varchar('codigo_unico').notNull().unique(),
  modelo: varchar('modelo'),
  firmware_version: varchar('firmware_version'),
  estado: varchar('estado').default('activo'),
  fecha_registro: timestamp('fecha_registro').defaultNow(),
});

// 🧱 colmena
export const colmena = pgTable('colmena', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre_colmena: text('nombre_colmena').notNull(),
  id_apiario_actual: uuid('id_apiario_actual').references(() => apiario.id),
  id_dispositivo: uuid('id_dispositivo').references(() => dispositivo_simonia.id),
  id_empresa: uuid('id_empresa').references(() => empresa.id),
  // 🐝 Tipo de colmena: polinizacion | produccion (opcional)
  tipo_colmena: varchar('tipo_colmena'),
  fecha_instalacion: date('fecha_instalacion').defaultNow(),
  fecha_creacion: timestamp('fecha_creacion').defaultNow(),
}, (table) => {
  return {
    id_apiario_idx: index('colmena_id_apiario_idx').on(table.id_apiario_actual),
    id_empresa_idx: index('colmena_id_empresa_idx').on(table.id_empresa),
    id_dispositivo_idx: index('colmena_id_dispositivo_idx').on(table.id_dispositivo),
  };
});


// 🧱 ubicacion_apiario
export const ubicacion_apiario = pgTable('ubicacion_apiario', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_apiario: uuid('id_apiario').references(() => apiario.id),
  locacion: text('locacion').notNull(),
  fecha_registro: timestamp('fecha_registro').defaultNow(),
  latitud: numeric('latitud', { mode: 'number' }),
  longitud: numeric('longitud', { mode: 'number' }),
});

// 🧱 tipo_alerta
export const tipo_alerta = pgTable('tipo_alerta', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: varchar('nombre').notNull().unique(),
  codigo: varchar('codigo').notNull().unique(),
  color_hex: varchar('color_hex'),
  descripcion: text('descripcion'),
});

// 🧱 alerta
export const alerta = pgTable('alerta', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_colmena: uuid('id_colmena').references(() => colmena.id),
  id_tipo_alerta: uuid('id_tipo_alerta').references(() => tipo_alerta.id),
  descripcion: text('descripcion'),
  temperatura_c: numeric('temperatura_c'),
  humedad_h: numeric('humedad_h'),
  peso_kg: numeric('peso_kg'),
  presion_hpa: numeric('presion_hpa'),
  sonido_hz: numeric('sonido_hz'),
  fecha_evento: timestamp('fecha_evento').defaultNow(),
  estado: varchar('estado').default('pendiente'),
  prioridad: varchar('prioridad').default('media'),
  origen_alerta: varchar('origen_alerta').default('sistema'),
  atendida_por: uuid('atendida_por').references(() => usuario.id),
  comentario_atencion: text('comentario_atencion'),
}, (table) => {
  return {
    id_colmena_idx: index('alerta_id_colmena_idx').on(table.id_colmena),
    fecha_evento_idx: index('alerta_fecha_evento_idx').on(table.fecha_evento),
    estado_idx: index('alerta_estado_idx').on(table.estado),
  };
});

// 🧱 lectura_sensor
export const lectura_sensor = pgTable('lectura_sensor', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_colmena: uuid('id_colmena').references(() => colmena.id),
  id_dispositivo: uuid('id_dispositivo').references(() => dispositivo_simonia.id),
  temperatura_c: numeric('temperatura_c'),
  humedad_h: numeric('humedad_h'),
  peso_kg: numeric('peso_kg'),
  sonido_hz: numeric('sonido_hz'),
  presion_hpa: numeric('presion_hpa'),
  fecha_registro: timestamp('fecha_registro').defaultNow(),
}, (table) => {
  return {
    id_colmena_idx: index('lectura_sensor_id_colmena_idx').on(table.id_colmena),
    id_dispositivo_idx: index('lectura_sensor_id_dispositivo_idx').on(table.id_dispositivo),
    fecha_registro_idx: index('lectura_sensor_fecha_registro_idx').on(table.fecha_registro),
  };
});

// 🧱 historial_lectura_sensor
export const historial_lectura_sensor = pgTable('historial_lectura_sensor', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_lectura: uuid('id_lectura').references(() => lectura_sensor.id),
  temperatura_c: numeric('temperatura_c'),
  humedad_h: numeric('humedad_h'),
  peso_kg: numeric('peso_kg'),
  sonido_hz: numeric('sonido_hz'),
  presion_hpa: numeric('presion_hpa'),
  fecha_registro: timestamp('fecha_registro').defaultNow(),
}, (table) => {
  return {
    id_lectura_idx: index('historial_id_lectura_idx').on(table.id_lectura),
    fecha_registro_idx: index('historial_fecha_registro_idx').on(table.fecha_registro),
  };
});

// 🧱 estado_colmena
export const estado_colmena = pgTable('estado_colmena', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_colmena: uuid('id_colmena').references(() => colmena.id),
  estado: varchar('estado').notNull(),
  fecha_registro: date('fecha_registro').defaultNow(),
  hora_registro: text('hora_registro').default('00:00:00'),
  id_usuario: uuid('id_usuario').references(() => usuario.id),
  comentario: text('comentario'),
});

// 🧱 registro_cambios_colmenas_apiarios
export const registro_cambios_colmenas_apiarios = pgTable('registro_cambios_colmenas_apiarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_colmena: uuid('id_colmena').references(() => colmena.id),
  id_apiario_origen: uuid('id_apiario_origen').references(() => apiario.id),
  id_apiario_destino: uuid('id_apiario_destino').references(() => apiario.id),
  fecha_cambio: timestamp('fecha_cambio').defaultNow(),
  motivo_cambio: text('motivo_cambio'),
  responsable_cambio: uuid('responsable_cambio').references(() => usuario.id),
  observaciones: text('observaciones'),
});

// 🧱 Enums para Inspecciones
export const cieloEnum = pgEnum('cielo_enum', ['despejado', 'nublado', 'lluvia', 'tormenta']);
export const estadoColmenaEnum = pgEnum('estado_colmena_enum', ['buena', 'regular', 'mala']);
export const poblacionAbejasEnum = pgEnum('poblacion_abejas_enum', ['baja', 'media', 'alta', 'muy_alta']);
export const presenciaReinaEnum = pgEnum('presencia_reina_enum', ['si', 'no', 'dudoso']);
export const celdasRealesEnum = pgEnum('celdas_reales_enum', ['ninguna', 'pocas', 'muchas', 'enjambrazon']);
export const posturaEnum = pgEnum('postura_enum', ['nula', 'uniforme', 'irregular', 'ausente']);
export const reservasAlimentoEnum = pgEnum('reservas_alimento_enum', ['criticas', 'escasas', 'suficientes', 'abundantes']);
export const comportamientoAbejasEnum = pgEnum('comportamiento_abejas_enum', ['tranquilas', 'agresivas', 'muy_agresivas', 'nerviosas']);

// 🧱 registro_accion
export const registro_accion = pgTable('registro_accion', {
  id: uuid('id').defaultRandom().primaryKey(),
  id_usuario: uuid('id_usuario').references(() => usuario.id),
  id_empresa: uuid('id_empresa').references(() => empresa.id),
  tipo_accion: varchar('tipo_accion'),
  descripcion: text('descripcion'),
  tabla_afectada: varchar('tabla_afectada'),
  id_registro_afectado: uuid('id_registro_afectado'),
  datos_anteriores: jsonb('datos_anteriores'),
  datos_nuevos: jsonb('datos_nuevos'),
  ip_origen: inet('ip_origen'),
  fecha_accion: timestamp('fecha_accion').defaultNow(),
  exito: boolean('exito').default(true),
});

// 🧱 inspecciones_colmenas
export const inspecciones_colmenas = pgTable('inspecciones_colmenas', {
  id: uuid('id').defaultRandom().primaryKey(),
  alerta_id: uuid('alerta_id').references(() => alerta.id),
  colmena_id: uuid('colmena_id').references(() => colmena.id),
  // apiario_id eliminado (redundante, se obtiene via colmena JOIN apiario)
  fecha_inspeccion: date('fecha_inspeccion').notNull(),
  nombre_inspeccion: text('nombre_inspeccion').notNull(),
  ubicacion_apiario: text('ubicacion_apiario'),
  temperatura_celsius: numeric('temperatura_celsius'),
  humedad_porcentaje: numeric('humedad_porcentaje'),
  velocidad_viento_kmh: numeric('velocidad_viento_kmh'),
  direccion_viento: text('direccion_viento'),
  cielo: cieloEnum('cielo'),
  estado_colmena: estadoColmenaEnum('estado_colmena'),
  poblacion_abejas: poblacionAbejasEnum('poblacion_abejas'),
  presencia_reina: presenciaReinaEnum('presencia_reina'),
  celdas_reales: celdasRealesEnum('celdas_reales'),
  postura: posturaEnum('postura'),
  reservas_alimento: reservasAlimentoEnum('reservas_alimento'),
  comportamiento_abejas: comportamientoAbejasEnum('comportamiento_abejas'),
  signos_enfermedad: text('signos_enfermedad'),
  observaciones: text('observaciones'), // Ahora es opcional
  recomendaciones: text('recomendaciones'),
  acciones_correctivas: text('acciones_correctivas'),
  creado_en: timestamp('creado_en', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    colmena_id_idx: index('inspeccion_colmena_id_idx').on(table.colmena_id),
    fecha_inspeccion_idx: index('inspeccion_fecha_idx').on(table.fecha_inspeccion),
    alerta_id_idx: index('inspeccion_alerta_id_idx').on(table.alerta_id),
  };
});
