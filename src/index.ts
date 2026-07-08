import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import empresaRouter from './routes/empresaRoutes';
import authRouter from './routes/authRoutes';
import apiarioRouter from './routes/apiarioRoutes';
import dispositivoRouter from './routes/dispositivoRoutes';
import lecturaRouter from './routes/lecturaRoutes';
import alertaRouter from './routes/alertaRoutes';
import inspeccionRouter from './routes/inspeccionRoutes';
import analiticaRouter from './routes/analiticaRoutes';
import { db } from './config/db';
import { sql } from 'drizzle-orm';
import { startKeepAlive } from './utils/keepAlive';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import compression from 'compression';
import helmet from 'helmet';

dotenv.config();

const startTime = Date.now();

const app = express();

// 🛡️ Seguridad y Optimización de Headers
app.use(helmet({
	contentSecurityPolicy: false, // Desactivar si causa problemas con Swagger, o configurar
}));

// 📦 Compresión de respuestas (Gzip)
app.use(compression());

// CORS configurado para producción - Lista blanca de dominios
const allowedOrigins = [
	'http://localhost:5173',
	'http://localhost:3000',
	'https://simoniareactfrontend.pages.dev',
	process.env.FRONTEND_URL, // Variable de entorno para dominio personalizado
].filter(Boolean) as string[];

app.use(cors({
	origin: (origin, callback) => {
		// Permitir requests sin origin (Postman, curl, apps móviles)
		if (!origin) return callback(null, true);
		// Verificar si el origin está en la lista blanca
		if (allowedOrigins.includes(origin)) {
			return callback(null, true);
		}
		// En desarrollo, ser más permisivo
		if (process.env.NODE_ENV !== 'production') {
			return callback(null, true);
		}
		return callback(new Error('CORS not allowed'), false);
	},
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());

// 🔍 Middleware de logging EFICIENTE
app.use((req, _res, next) => {
	// Solo loguear en desarrollo o peticiones importantes
	if (process.env.NODE_ENV === 'production' && req.path === '/health') return next();

	const timestamp = new Date().toISOString();
	const method = req.method;
	const path = req.path;

	console.log(`[${timestamp}] ${method} ${path}`);

	// Solo procesar body si es necesario y no es un stream gigante
	if (['POST', 'PATCH', 'PUT'].includes(method) && req.headers['content-length']) {
		const size = req.headers['content-length'];
		console.log(`  Payload: ${size} bytes`);

		if (path.includes('/lecturas') && req.body) {
			const preview = JSON.stringify(req.body).substring(0, 100);
			console.log(`  Preview: ${preview}...`);
		}
	}

	next();
});
// Swagger UI endpoint
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root endpoint
app.get('/', (_req, res) => {
	res.json({
		message: 'Simon Backend MVP API',
		version: '1.0.0',
		status: 'running',
		endpoints: {
			health: '/health',
			empresas: '/api/empresas',
			auth: '/auth/login',
			apiarios: '/api/apiarios',
			dispositivos: '/api/dispositivos',
			lecturas: '/api/lecturas/sensor',
			ubicacion_apiario: '/api/ubicacion/apiario',
			alertas: '/api/alertas/empresa/todas'
		}
	});
});

// 🧪 Endpoint de prueba para verificar que el servidor recibe datos
app.post('/api/test/echo', (req, res) => {
	const timestamp = new Date().toISOString();
	console.log('\n🧪 TEST ECHO - Petición recibida:', timestamp);
	console.log('Headers:', JSON.stringify(req.headers, null, 2));
	console.log('Body:', JSON.stringify(req.body, null, 2));

	res.json({
		success: true,
		message: 'Servidor recibió tu petición correctamente',
		timestamp: timestamp,
		recibido: {
			headers: {
				'content-type': req.headers['content-type'],
				'user-agent': req.headers['user-agent']
			},
			body: req.body,
			method: req.method,
			path: req.path
		}
	});
});

// Rutas
app.use('/api', empresaRouter);
app.use('/auth', authRouter);
app.use('/api', apiarioRouter);
app.use('/api', dispositivoRouter);
app.use('/api', lecturaRouter);
app.use('/api', alertaRouter);
app.use('/api/inspecciones', inspeccionRouter);
app.use('/api/analitica', analiticaRouter);

// Health check endpoint mejorado
app.get('/health', async (_req, res) => {
	const healthCheck = {
		status: 'ok',
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		serverUptime: Math.floor((Date.now() - startTime) / 1000),
		environment: process.env.NODE_ENV || 'development',
		version: '1.0.0',
		database: {
			status: 'unknown',
			responseTime: 0
		}
	};

	// Verificar conexión a la base de datos
	try {
		const dbStartTime = Date.now();
		await db.execute(sql`SELECT 1 as health`);
		healthCheck.database.status = 'connected';
		healthCheck.database.responseTime = Date.now() - dbStartTime;
	} catch (error) {
		healthCheck.status = 'degraded';
		healthCheck.database.status = 'disconnected';
		console.error('Database health check failed:', error);
	}

	const statusCode = healthCheck.status === 'ok' ? 200 : 503;
	res.status(statusCode).json(healthCheck);
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0'; // Necesario para Render y otros servicios de hosting

const server = app.listen(PORT, HOST, () => {
	console.log(`✅ Server listening on ${HOST}:${PORT}`);
	console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

	// Iniciar keep-alive solo en producción (Render)
	if (process.env.RENDER_EXTERNAL_URL) {
		startKeepAlive(PORT);
	}
});

// 🛑 Manejo de SIGTERM (Render envía esto antes de detener el proceso)
process.on('SIGTERM', () => {
	console.log('🛑 SIGTERM received. Shutting down gracefully...');
	server.close(() => {
		console.log('✅ Server closed.');
		process.exit(0);
	});
});

// 🛑 Manejo de SIGINT (Ctrl+C en desarrollo)
process.on('SIGINT', () => {
	console.log('🛑 SIGINT received. Shutting down...');
	server.close(() => {
		console.log('✅ Server closed.');
		process.exit(0);
	});
});

