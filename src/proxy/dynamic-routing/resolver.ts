import { DynamicBackendConfig } from '../../config/loader';
import { getLogger } from '../../common/logger';

const logger = getLogger();

export interface ParsedBackendHost {
  hostname: string;
  port: number | null;
}

export interface BackendUrlComponents {
  protocol: string;
  hostname: string;
  port: number;
  transport: 'http' | 'sse';
  path: string;
}

/**
 * Rule 1: Extract hostname and port from APIM-PROXIED-MCP-HOST header
 * Per protocol-handling-design.md
 */
export function parseBackendHostHeader(headerValue: string | undefined): ParsedBackendHost | null {
  if (!headerValue) {
    return null;
  }

  // Trim whitespace
  const trimmed = headerValue.trim();

  if (trimmed === '') {
    return null;
  }

  // Split on last ':' to separate hostname and optional port
  const lastColonIndex = trimmed.lastIndexOf(':');

  if (lastColonIndex === -1) {
    // No port specified
    return {
      hostname: trimmed.toLowerCase(),
      port: null,
    };
  }

  const hostname = trimmed.substring(0, lastColonIndex).trim();
  const portStr = trimmed.substring(lastColonIndex + 1).trim();

  // Validate hostname is not empty
  if (hostname === '') {
    throw new Error('Empty hostname in header');
  }

  // Validate and parse port
  if (portStr === '') {
    throw new Error('Empty port in header');
  }

  const port = parseInt(portStr, 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port in header: ${portStr} (must be 1-65535)`);
  }

  return {
    hostname: hostname.toLowerCase(),
    port,
  };
}

/**
 * Rule 2: Determine port number
 * Precedence: explicit port > config.defaultPort > 443
 * Per protocol-handling-design.md
 */
export function determinePort(parsed: ParsedBackendHost, config: DynamicBackendConfig): number {
  // Explicit port in header takes precedence
  if (parsed.port !== null) {
    return parsed.port;
  }

  // Config default port
  if (config.defaultPort !== undefined) {
    return config.defaultPort;
  }

  // Hardcoded default (HTTPS port)
  return 443;
}

/**
 * Rule 3: Determine protocol
 * MVP: Always HTTPS
 * Per protocol-handling-design.md
 */
export function determineProtocol(_config: DynamicBackendConfig): string {
  // MVP: Always use HTTPS (secure-by-default)
  // Future: Honor _config.allowInsecureProtocol for specific backends
  return 'https';
}

/**
 * Rule 4: Determine transport type (HTTP vs SSE)
 * Precedence: static config > auto-detect > HTTP default
 * Per protocol-handling-design.md
 */
export function determineTransport(
  hostname: string,
  staticServers?: Array<{ hostname?: string; transport?: 'http' | 'sse' | 'auto' }>
): 'http' | 'sse' {
  // Check if this hostname has static configuration
  if (staticServers) {
    const serverConfig = staticServers.find((s) => s.hostname === hostname);
    if (serverConfig && serverConfig.transport) {
      if (serverConfig.transport === 'sse') {
        return 'sse';
      }
      if (serverConfig.transport === 'http') {
        return 'http';
      }
    }
  }

  // Default to HTTP (auto-detection happens in forwarder based on Content-Type)
  return 'http';
}

/**
 * Rule 5: Construct backend URL
 * Per protocol-handling-design.md
 */
export function constructBackendUrl(components: BackendUrlComponents): string {
  const { protocol, hostname, port, transport } = components;

  // Determine path based on transport type
  const path = transport === 'sse' ? '/sse' : '/mcp';

  // Construct full URL
  return `${protocol}://${hostname}:${port}${path}`;
}

/**
 * Validate hostname format (basic DNS name or IP address validation)
 */
export function validateHostname(hostname: string): boolean {
  if (!hostname || hostname.length === 0) {
    return false;
  }

  // Check for invalid characters (spaces, special chars except - and .)
  const validHostnamePattern = /^[a-z0-9.-]+$/i;
  if (!validHostnamePattern.test(hostname)) {
    return false;
  }

  // Basic check: no leading/trailing dots or hyphens
  if (
    hostname.startsWith('.') ||
    hostname.endsWith('.') ||
    hostname.startsWith('-') ||
    hostname.endsWith('-')
  ) {
    return false;
  }

  return true;
}

/**
 * Complete backend URL resolution from header
 * Orchestrates Rules 1-5
 */
export function resolveBackendFromHeader(
  headerValue: string | undefined,
  config: DynamicBackendConfig,
  staticServers?: Array<{ hostname?: string; transport?: 'http' | 'sse' | 'auto' }>
): string | null {
  try {
    // Rule 1: Parse header
    const parsed = parseBackendHostHeader(headerValue);
    if (!parsed) {
      return null; // No header, use fallback
    }

    // Validate hostname format
    if (!validateHostname(parsed.hostname)) {
      throw new Error(`Invalid hostname format: ${parsed.hostname}`);
    }

    // Rule 2: Determine port
    const port = determinePort(parsed, config);

    // Rule 3: Determine protocol
    const protocol = determineProtocol(config);

    // Rule 4: Determine transport
    const transport = determineTransport(parsed.hostname, staticServers);

    // Rule 5: Construct URL
    const backendUrl = constructBackendUrl({
      protocol,
      hostname: parsed.hostname,
      port,
      transport,
      path: transport === 'sse' ? '/sse' : '/mcp',
    });

    logger.debug('Dynamic backend resolved from header', {
      headerValue,
      backendUrl,
      hostname: parsed.hostname,
      port,
      protocol,
      transport,
    });

    return backendUrl;
  } catch (error) {
    logger.error('Failed to resolve backend from header', {
      headerValue,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
