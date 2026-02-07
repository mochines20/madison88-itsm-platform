/**
 * Logger utility for consistent logging across the application
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_LEVELS = {
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
  debug: 'DEBUG'
};

const getTimestamp = () => {
  return new Date().toISOString();
};

const formatLog = (level, message, data = null) => {
  const timestamp = getTimestamp();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };
  return JSON.stringify(logEntry);
};

const writeLog = (level, message, data) => {
  const logLine = formatLog(level, message, data);
  
  // Console output
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[consoleMethod](`[${getTimestamp()}] [${level.toUpperCase()}] ${message}`, data || '');
  
  // File output
  if (process.env.NODE_ENV !== 'test') {
    fs.appendFileSync(LOG_FILE, logLine + '\n');
  }
};

module.exports = {
  error: (message, data) => writeLog('ERROR', message, data),
  warn: (message, data) => writeLog('WARN', message, data),
  info: (message, data) => writeLog('INFO', message, data),
  debug: (message, data) => writeLog('DEBUG', message, data)
};
