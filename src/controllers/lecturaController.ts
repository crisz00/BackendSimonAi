import type { Request, Response } from 'express';
import {
  createLecturaSensorByCodigo,
  createUbicacionApiarioByCodigo,
  getLecturasByColmena,
  getLecturasByCodigoDispositivo,
  getUltimaLecturaByColmena,
  getHistorialParaGraficos,
  getEstadisticasColmena,
  type LecturaInput,
} from '../services/lecturaService';
import { checkAndCreateAlerts } from '../services/alertaService';
import type { AuthRequest } from '../middlewares/authMiddleware';
import { validateLecturaInput, isValidUUID } from '../utils/validation';

// Ingesta desde dispositivo (no requiere auth humano, usa codigo_unico)
export async function createLecturaSensorHandler(req: Request, res: Response) {
  try {
    const {
      codigo_dispositivo,
      temperatura_c,
      humedad_h,
      peso_kg,
      sonido_hz,
      presion_hpa,
    } = req.body;

    // Validación mejorada de inputs
    const validation = validateLecturaInput({
      codigo_dispositivo,
      temperatura_c,
      humedad_h,
      peso_kg,
      sonido_hz,
      presion_hpa,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Datos de sensor inválidos',
        details: validation.errors
      });
    }

    const payload: LecturaInput = {
      codigo_dispositivo,
      temperatura_c,
      humedad_h,
      peso_kg,
      sonido_hz,
      presion_hpa,
    };

    const resultado = await createLecturaSensorByCodigo(payload);

    // ✅ RESPUESTA INMEDIATA: Prioridad máxima para el dispositivo IoT
    res.status(201).json({ success: true, data: resultado });

    // ⚡ PROCESOS EN SEGUNDO PLANO (Fire & Forget)
    setImmediate(() => {
      const fechaRegistro = resultado.lectura?.fecha_registro;
      const fechaChile = fechaRegistro
        ? new Date(fechaRegistro).toLocaleString('es-CL', {
          timeZone: 'America/Santiago',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
        : 'N/A';

      console.log(`✅ LECTURA: ${resultado.dispositivo.codigo_unico} -> ${resultado.colmena.nombre_colmena} (${fechaChile})`);

      if (resultado.lectura) {
        checkAndCreateAlerts(resultado.lectura, resultado.colmena.id).catch(err => {
          console.error('Error en proceso de alertas en segundo plano:', err);
        });
      }
    });
  } catch (error: any) {
    console.error(`❌ ERROR LECTURA: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al crear lectura'
    });
  }
}

export async function createUbicacionApiarioGPSHandler(req: Request, res: Response) {
  try {
    const {
      codigo_dispositivo,
      latitud,
      longitud,
      locacion,
    } = req.body;

    const codigo = String(codigo_dispositivo || '').trim();
    const lat = Number(latitud);
    const lng = Number(longitud);

    if (!codigo) {
      return res.status(400).json({
        success: false,
        error: 'codigo_dispositivo es requerido',
      });
    }

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        error: 'latitud inválida',
      });
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'longitud inválida',
      });
    }

    const resultado = await createUbicacionApiarioByCodigo({
      codigo_dispositivo: codigo,
      latitud: lat,
      longitud: lng,
      locacion: locacion ? String(locacion) : undefined,
    });

    res.status(201).json({
      success: true,
      data: resultado,
    });

    setImmediate(() => {
      console.log(`📍 GPS: ${codigo} -> ${lat}, ${lng}`);
    });

  } catch (error: any) {
    console.error(`❌ ERROR GPS: ${error.message}`);

    res.status(500).json({
      success: false,
      error: error.message || 'Error al guardar ubicación GPS',
    });
  }
}

export async function getLecturasByColmenaHandler(req: AuthRequest, res: Response) {
  try {
    const colmenaIdParam = req.params.colmenaId;
    const colmenaId = Array.isArray(colmenaIdParam) ? colmenaIdParam[0] : colmenaIdParam;
    const { limit } = req.query;

    if (!colmenaId || !isValidUUID(colmenaId)) {
      return res.status(400).json({ success: false, error: 'colmenaId inválido o no proporcionado' });
    }

    const parsedLimit = Math.min(Math.max(1, Number(limit) || 50), 500);
    const { nombre_colmena, lecturas } = await getLecturasByColmena(colmenaId, parsedLimit);
    res.status(200).json({ success: true, nombre_colmena, data: lecturas });
  } catch (error: any) {
    console.error('Error obteniendo lecturas por colmena:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener lecturas' });
  }
}

export async function getLecturasByDispositivoHandler(req: AuthRequest, res: Response) {
  try {
    const codigoParam = req.params.codigo;
    const codigo = Array.isArray(codigoParam) ? codigoParam[0] : codigoParam;
    const { limit } = req.query;

    if (!codigo) {
      return res.status(400).json({ success: false, error: 'codigo requerido' });
    }

    const lecturas = await getLecturasByCodigoDispositivo(codigo, Number(limit) || 50);
    res.status(200).json({ success: true, data: lecturas });
  } catch (error: any) {
    console.error('Error obteniendo lecturas por dispositivo:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener lecturas' });
  }
}

export async function getUltimaLecturaColmenaHandler(req: AuthRequest, res: Response) {
  try {
    const colmenaIdParam = req.params.colmenaId;
    const colmenaId = Array.isArray(colmenaIdParam) ? colmenaIdParam[0] : colmenaIdParam;
    if (!colmenaId) {
      return res.status(400).json({ success: false, error: 'colmenaId requerido' });
    }

    const lectura = await getUltimaLecturaByColmena(colmenaId);
    res.status(200).json({ success: true, data: lectura });
  } catch (error: any) {
    console.error('Error obteniendo última lectura:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener lectura' });
  }
}

// 📊 CONTROLADORES PARA GRÁFICOS

export async function getHistorialGraficosHandler(req: AuthRequest, res: Response) {
  try {
    const colmenaIdParam = req.params.colmenaId;
    const colmenaId = Array.isArray(colmenaIdParam) ? colmenaIdParam[0] : colmenaIdParam;
    const { dias } = req.query;

    if (!colmenaId) {
      return res.status(400).json({ success: false, error: 'colmenaId requerido' });
    }

    const historial = await getHistorialParaGraficos(colmenaId, Number(dias) || 7);

    res.status(200).json({
      success: true,
      data: historial,
      periodo_dias: Number(dias) || 7,
      total_registros: historial.length
    });
  } catch (error: any) {
    console.error('Error obteniendo historial para gráficos:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener historial' });
  }
}

export async function getEstadisticasColmenaHandler(req: AuthRequest, res: Response) {
  try {
    const colmenaIdParam = req.params.colmenaId;
    const colmenaId = Array.isArray(colmenaIdParam) ? colmenaIdParam[0] : colmenaIdParam;
    const { dias } = req.query;

    if (!colmenaId) {
      return res.status(400).json({ success: false, error: 'colmenaId requerido' });
    }

    const estadisticas = await getEstadisticasColmena(colmenaId, Number(dias) || 7);

    res.status(200).json({
      success: true,
      data: estadisticas,
      periodo_dias: Number(dias) || 7
    });
  } catch (error: any) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, error: error.message || 'Error al obtener estadísticas' });
  }
}
