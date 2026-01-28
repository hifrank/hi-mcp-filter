import { FastifyRequest } from 'fastify';
import { validateMCPResponse } from '../../mcp/validator';
import { getLogger } from '../../common/logger';
import { ValidationError } from '../../common/errors';

export function validateResponse(request: FastifyRequest, responseData: unknown): void {
  const logger = getLogger();

  const result = validateMCPResponse(responseData);

  if (!result.valid) {
    logger.warn('Invalid MCP response received', {
      errors: result.errors,
      requestId: request.id,
    });

    throw new ValidationError('MCP response validation failed', {
      errors: result.errors,
    });
  }

  logger.debug('MCP response validated', { requestId: request.id });
}
