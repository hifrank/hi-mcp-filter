import { BackendSelection, RoutingDecision, DynamicBackendConfig } from '../../config/loader';
import { resolveBackendFromHeader } from './resolver';
import { getLogger } from '../../common/logger';

const logger = getLogger();

export interface SelectionContext {
  headerValue: string | undefined;
  config: DynamicBackendConfig;
  staticBackendUrl?: string;
  staticServers?: Array<{ hostname?: string; transport?: 'http' | 'sse' | 'auto' }>;
}

/**
 * Select backend based on header vs static config precedence
 * Implements FR-011: Header precedence rule
 */
export function selectBackend(context: SelectionContext): RoutingDecision {
  const { headerValue, config, staticBackendUrl, staticServers } = context;

  // Check if dynamic routing is enabled
  if (!config.enabled) {
    if (staticBackendUrl) {
      return {
        backendUrl: staticBackendUrl,
        selectionSource: BackendSelection.STATIC_CONFIG,
      };
    }
    
    return {
      backendUrl: '',
      selectionSource: BackendSelection.ERROR,
      error: 'No backend available: dynamic routing disabled and no static config',
    };
  }

  // Try dynamic routing via header (if present)
  if (headerValue && headerValue.trim() !== '') {
    try {
      const dynamicUrl = resolveBackendFromHeader(headerValue, config, staticServers);
      
      if (dynamicUrl) {
        logger.info('Backend selected from header', {
          source: BackendSelection.HEADER,
          backendUrl: dynamicUrl,
          headerValue,
        });

        return {
          backendUrl: dynamicUrl,
          selectionSource: BackendSelection.HEADER,
        };
      }
    } catch (error) {
      logger.error('Dynamic backend resolution failed', {
        headerValue,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        backendUrl: '',
        selectionSource: BackendSelection.ERROR,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Fallback to static config
  if (staticBackendUrl) {
    logger.debug('Backend selected from static config (fallback)', {
      source: BackendSelection.STATIC_CONFIG,
      backendUrl: staticBackendUrl,
    });

    return {
      backendUrl: staticBackendUrl,
      selectionSource: BackendSelection.STATIC_CONFIG,
    };
  }

  // No backend available
  return {
    backendUrl: '',
    selectionSource: BackendSelection.ERROR,
    error: 'No backend available: no header and no static config',
  };
}

/**
 * Determine if backend selection resulted in a valid backend
 */
export function isValidBackend(decision: RoutingDecision): boolean {
  return decision.selectionSource !== BackendSelection.ERROR && decision.backendUrl !== '';
}

/**
 * Get human-readable description of selection source
 */
export function getSelectionSourceDescription(source: BackendSelection): string {
  switch (source) {
    case BackendSelection.STATIC_CONFIG:
      return 'Static Configuration';
    case BackendSelection.HEADER:
      return 'Dynamic Header (APIM-PROXIED-MCP-HOST)';
    case BackendSelection.ERROR:
      return 'Error (No Backend Available)';
    default:
      return 'Unknown';
  }
}
