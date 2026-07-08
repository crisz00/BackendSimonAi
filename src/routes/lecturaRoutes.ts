import { Router } from 'express';
import {
  createLecturaSensorHandler,
  createUbicacionApiarioGPSHandler,
  getLecturasByColmenaHandler,
  getLecturasByDispositivoHandler,
  getUltimaLecturaColmenaHandler,
  getHistorialGraficosHandler,
  getEstadisticasColmenaHandler,
} from '../controllers/lecturaController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { iotRateLimiter } from '../middlewares/rateLimiter';

const router = Router();

// Documentación para el dispositivo IoT
router.get('/lecturas/sensor/docs', (_req, res) => {
  res.json({
    endpoint: 'POST /api/lecturas/sensor',
    descripcion: 'Endpoint para enviar datos desde el dispositivo IoT Simon',
    headers: {
      'Content-Type': 'application/json'
    },
    body_requerido: {
      codigo_dispositivo: 'string (REQUERIDO) - Código único del dispositivo'
    },
    body_opcional: {
      temperatura_c: 'number - Temperatura en grados Celsius',
      humedad_h: 'number - Humedad relativa en porcentaje',
      peso_kg: 'number - Peso en kilogramos',
      sonido_hz: 'number - Frecuencia de sonido en Hertz',
      presion_hpa: 'number - Presión atmosférica en hectopascales'
    },
    ejemplo_curl: `curl -X POST https://simon-backend-mvp-1.onrender.com/api/lecturas/sensor \\
  -H "Content-Type: application/json" \\
  -d '{
    "codigo_dispositivo": "SIM-003",
    "temperatura_c": 25.5,
    "humedad_h": 65.2,
    "peso_kg": 45.3,
    "sonido_hz": 120.5,
    "presion_hpa": 1013.2
  }'`,
    ejemplo_body: {
      codigo_dispositivo: 'SIM-002',
      temperatura_c: 25.5,
      humedad_h: 65.2,
      peso_kg: 45.3,
      sonido_hz: 120.5,
      presion_hpa: 1013.2
    },
    respuesta_exitosa: {
      success: true,
      data: {
        lectura: '{ datos de la lectura creada }'
      }
    },
    nota: 'Solo codigo_dispositivo es obligatorio. Los demás campos son opcionales.'
  });
});

/**
 * @swagger
 * tags:
 *   name: Lecturas
 *   description: Ingesta y consulta de datos de sensores
 */

/**
 * @swagger
 * /api/lecturas/sensor:
 *   post:
 *     summary: Enviar datos desde el dispositivo IoT
 *     tags: [Lecturas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigo_dispositivo]
 *             properties:
 *               codigo_dispositivo:
 *                 type: string
 *               temperatura_c:
 *                 type: number
 *               humedad_h:
 *                 type: number
 *               peso_kg:
 *                 type: number
 *               sonido_hz:
 *                 type: number
 *               presion_hpa:
 *                 type: number
 *     responses:
 *       201:
 *         description: Lectura registrada
 */
router.post('/lecturas/sensor', iotRateLimiter, createLecturaSensorHandler);
router.post('/ubicacion/apiario', iotRateLimiter, createUbicacionApiarioGPSHandler);

/**
 * @swagger
 * /api/lecturas/colmena/{colmenaId}:
 *   get:
 *     summary: Obtener historial de lecturas de una colmena
 *     tags: [Lecturas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colmenaId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de lecturas
 */
router.get('/lecturas/colmena/:colmenaId', authenticateToken, getLecturasByColmenaHandler);

/**
 * @swagger
 * /api/lecturas/colmena/{colmenaId}/ultima:
 *   get:
 *     summary: Obtener la última lectura de una colmena
 *     tags: [Lecturas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colmenaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Última lectura
 */
router.get('/lecturas/colmena/:colmenaId/ultima', authenticateToken, getUltimaLecturaColmenaHandler);

/**
 * @swagger
 * /api/lecturas/colmena/{colmenaId}/graficos:
 *   get:
 *     summary: Obtener datos formateados para gráficos
 *     tags: [Lecturas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colmenaId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: dias
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Datos para gráficos
 */
router.get('/lecturas/colmena/:colmenaId/graficos', authenticateToken, getHistorialGraficosHandler);

/**
 * @swagger
 * /api/lecturas/colmena/{colmenaId}/estadisticas:
 *   get:
 *     summary: Obtener estadísticas (promedio, max, min) de una colmena
 *     tags: [Lecturas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: colmenaId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: dias
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estadísticas calculadas
 */
router.get('/lecturas/colmena/:colmenaId/estadisticas', authenticateToken, getEstadisticasColmenaHandler);

export default router;
