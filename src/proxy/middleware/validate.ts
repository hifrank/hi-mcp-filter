import { FastifyRequest } from 'fastify';
import { validateMCPResponse } from '../../mcp/validator';
import { getLogger } from '../../common/logger';
import { ValidationError } from '../../common/errors';

export async function validateResponse(
  request: FastifyRequest,
  _reply: unknown,
  responseData: unknown
): Promise<void> {
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
