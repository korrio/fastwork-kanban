import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.apiLogFile = path.join(this.logDir, 'fastwork-api.log');
        this.errorLogFile = path.join(this.logDir, 'errors.log');
        
        // Ensure logs directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatTimestamp() {
        return new Date().toISOString();
    }

    formatLogEntry(level, message, data = null) {
        const timestamp = this.formatTimestamp();
        const entry = {
            timestamp,
            level,
            message,
            ...(data && { data })
        };
        return JSON.stringify(entry, null, 2);
    }

    writeToFile(filePath, content) {
        try {
            fs.appendFileSync(filePath, content + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    logApiCall(method, url, params = null, responseData = null, duration = null, error = null) {
        const logData = {
            method,
            url,
            timestamp: this.formatTimestamp(),
            ...(params && { params }),
            ...(duration && { duration: `${duration}ms` }),
            ...(responseData && { 
                responseSize: responseData.jobs ? responseData.jobs.length : 0,
                success: responseData.success,
                pagination: responseData.pagination
            }),
            ...(error && { error: error.message || error })
        };

        const logEntry = this.formatLogEntry('API_CALL', `${method} ${url}`, logData);
        
        // Console output with colors
        const timestamp = new Date().toLocaleTimeString();
        if (error) {
            console.error(`[${timestamp}] ❌ API Error: ${method} ${url} - ${error.message || error}`);
        } else {
            const jobCount = responseData?.jobs?.length || 0;
            const durationStr = duration ? ` (${duration}ms)` : '';
            console.log(`[${timestamp}] 🌐 API Call: ${method} ${url} - ${jobCount} jobs${durationStr}`);
        }

        // Write to file
        this.writeToFile(this.apiLogFile, logEntry);
        
        if (error) {
            this.writeToFile(this.errorLogFile, logEntry);
        }
    }

    logJobProcessing(action, jobCount, categoryCount = null, duration = null, details = null) {
        const logData = {
            action,
            jobCount,
            timestamp: this.formatTimestamp(),
            ...(categoryCount && { categoryCount }),
            ...(duration && { duration: `${duration}ms` }),
            ...(details && { details })
        };

        const logEntry = this.formatLogEntry('JOB_PROCESSING', action, logData);
        
        // Console output
        const timestamp = new Date().toLocaleTimeString();
        const categoryStr = categoryCount ? ` from ${categoryCount} categories` : '';
        const durationStr = duration ? ` (${duration}ms)` : '';
        console.log(`[${timestamp}] 📊 ${action}: ${jobCount} jobs${categoryStr}${durationStr}`);

        this.writeToFile(this.apiLogFile, logEntry);
    }

    logCronActivity(action, message, data = null) {
        const logData = {
            action,
            message,
            timestamp: this.formatTimestamp(),
            ...(data && { data })
        };

        const logEntry = this.formatLogEntry('CRON', action, logData);
        
        // Console output
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ⏰ Cron: ${action} - ${message}`);

        this.writeToFile(this.apiLogFile, logEntry);
    }

    logInfo(context, message, additionalData = null) {
        const logData = {
            context,
            message,
            timestamp: this.formatTimestamp(),
            ...(additionalData && { additionalData })
        };

        const logEntry = this.formatLogEntry('INFO', `${context}: ${message}`, logData);
        
        // Console output
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ℹ️  ${context}: ${message}`);

        this.writeToFile(this.apiLogFile, logEntry);
    }

    logError(context, error, additionalData = null) {
        const logData = {
            context,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            timestamp: this.formatTimestamp(),
            ...(additionalData && { additionalData })
        };

        const logEntry = this.formatLogEntry('ERROR', `Error in ${context}`, logData);
        
        // Console output
        const timestamp = new Date().toLocaleTimeString();
        console.error(`[${timestamp}] ❌ Error in ${context}: ${error.message}`);

        this.writeToFile(this.errorLogFile, logEntry);
    }

    getLogStats() {
        try {
            const apiLogStats = fs.existsSync(this.apiLogFile) ? 
                fs.statSync(this.apiLogFile) : null;
            const errorLogStats = fs.existsSync(this.errorLogFile) ? 
                fs.statSync(this.errorLogFile) : null;

            return {
                apiLog: {
                    exists: !!apiLogStats,
                    size: apiLogStats ? apiLogStats.size : 0,
                    lastModified: apiLogStats ? apiLogStats.mtime : null
                },
                errorLog: {
                    exists: !!errorLogStats,
                    size: errorLogStats ? errorLogStats.size : 0,
                    lastModified: errorLogStats ? errorLogStats.mtime : null
                }
            };
        } catch (error) {
            console.error('Error getting log stats:', error.message);
            return null;
        }
    }

    clearLogs() {
        try {
            if (fs.existsSync(this.apiLogFile)) {
                fs.unlinkSync(this.apiLogFile);
            }
            if (fs.existsSync(this.errorLogFile)) {
                fs.unlinkSync(this.errorLogFile);
            }
            console.log('📝 Log files cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear log files:', error.message);
            return false;
        }
    }
}

export default new Logger();