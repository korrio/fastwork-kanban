import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { initDatabase } from '../database/init.js';
import { jobsRouter } from './routes/jobs.js';
import { kanbanRouter } from './routes/kanban.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../web/public')));

// API Routes
app.use('/api/jobs', jobsRouter);
app.use('/api/kanban', kanbanRouter);

// Serve the Kanban board at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../web/public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
    try {
        // Initialize database
        await initDatabase();
        console.log('✅ Database initialized');

        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Fastwork Kanban Server running on http://localhost:${PORT}`);
            console.log(`📋 Kanban Board: http://localhost:${PORT}`);
            console.log(`🔌 API Endpoint: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT. Shutting down gracefully...');
    process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
    startServer();
}

export { app };