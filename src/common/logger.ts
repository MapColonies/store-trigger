import config from 'config';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { logMethod } from '@map-colonies/telemetry';

const loggerConfig = config.get<LoggerOptions>('telemetry.logger');

export default jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, hooks: { logMethod } });
