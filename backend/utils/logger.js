import winston from 'winston';

/**
 * Logger configuration for GuestList Pro Backend
 * Logs to console with different levels: error, warn, info, debug
 */

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
};

winston.addColors(logColors);

// Custom format for better readability
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `[${timestamp}] ${level}: ${message}`;

        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta, null, 2)}`;
        }

        // Add stack trace for errors
        if (stack) {
            log += `\n${stack}`;
        }

        return log;
    })
);

// Create logger instance
const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
    ],
    exitOnError: false,
});

/**
 * Log an info message
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
export const info = (message, meta = {}) => {
    logger.info(message, meta);
};

/**
 * Log a warning message
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
export const warn = (message, meta = {}) => {
    logger.warn(message, meta);
};

/**
 * Log an error message
 * @param {string} message - Log message
 * @param {Error|object} error - Error object or metadata
 */
export const error = (message, error = {}) => {
    if (error instanceof Error) {
        logger.error(message, {
            error: error.message,
            stack: error.stack,
            ...error
        });
    } else {
        logger.error(message, error);
    }
};

/**
 * Log a debug message (only in development)
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
export const debug = (message, meta = {}) => {
    logger.debug(message, meta);
};

/**
 * Log API request details
 * @param {object} req - Request object
 */
export const logRequest = (req) => {
    info('Incoming Request', {
        method: req.method,
        url: req.url,
        ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
    });
};

/**
 * Log API response details
 * @param {object} req - Request object
 * @param {number} statusCode - Response status code
 * @param {number} duration - Request duration in ms
 */
export const logResponse = (req, statusCode, duration) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, 'Request Completed', {
        method: req.method,
        url: req.url,
        statusCode,
        duration: `${duration}ms`,
    });
};

export default logger;