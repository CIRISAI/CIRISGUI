// CIRIS TypeScript SDK - Base Resource Class

import { Transport } from '../transport';

export abstract class BaseResource {
  constructor(protected transport: Transport) {}

  /**
   * Helper to build consistent error messages
   */
  protected buildErrorMessage(operation: string, detail?: string): string {
    const base = `Failed to ${operation}`;
    return detail ? `${base}: ${detail}` : base;
  }
}
