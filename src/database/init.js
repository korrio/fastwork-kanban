import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../jobs.db');

export function initDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
            
            db.exec(schema, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                console.log('Database initialized successfully');
                resolve(db);
            });
        });
    });
}

export function getDatabase() {
    return new sqlite3.Database(DB_PATH);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    initDatabase()
        .then(() => {
            console.log('Database setup complete');
            process.exit(0);
        })
        .catch(err => {
            console.error('Database setup failed:', err);
            process.exit(1);
        });
}