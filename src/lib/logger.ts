type LogLevel = 'info' | 'warn' | 'error';

class Logger {
  private static MAX_LOGS = 100;
  private logs: { timestamp: number; level: LogLevel; message: string; details?: any }[] = [];
  
  private log(level: LogLevel, message: string, details?: any) {
    const entry = { timestamp: Date.now(), level, message, details };
    this.logs.unshift(entry);
    if (this.logs.length > Logger.MAX_LOGS) {
      this.logs.pop();
    }
    
    // In production, this would send to Sentry/Datadog
    if (level === 'error') {
      console.error(`[${level.toUpperCase()}] ${message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${level.toUpperCase()}] ${message}`, details || '');
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, details || '');
    }
  }

  info(message: string, details?: any) { this.log('info', message, details); }
  warn(message: string, details?: any) { this.log('warn', message, details); }
  error(message: string, details?: any) { this.log('error', message, details); }
  
  getLogs() {
    return [...this.logs];
  }
}

export const logger = new Logger();
