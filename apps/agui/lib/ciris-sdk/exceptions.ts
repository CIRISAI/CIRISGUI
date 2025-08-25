// CIRIS TypeScript SDK - Exception Classes

export class CIRISError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CIRISError';
  }
}

export class CIRISAPIError extends CIRISError {
  constructor(
    public status: number,
    message: string,
    public detail?: string,
    public type?: string
  ) {
    super(message);
    this.name = 'CIRISAPIError';
  }
}

export class CIRISAuthError extends CIRISError {
  constructor(message: string) {
    super(message);
    this.name = 'CIRISAuthError';
  }
}

export class CIRISConnectionError extends CIRISError {
  constructor(message: string) {
    super(message);
    this.name = 'CIRISConnectionError';
  }
}

export class CIRISTimeoutError extends CIRISError {
  constructor(message: string) {
    super(message);
    this.name = 'CIRISTimeoutError';
  }
}

export class CIRISValidationError extends CIRISError {
  constructor(message: string) {
    super(message);
    this.name = 'CIRISValidationError';
  }
}

export class CIRISRateLimitError extends CIRISAPIError {
  constructor(
    public retryAfter: number,
    public limit: number,
    public window: string
  ) {
    super(429, `Rate limit exceeded. Retry after ${retryAfter} seconds`);
    this.name = 'CIRISRateLimitError';
  }
}

export class CIRISPermissionDeniedError extends CIRISAPIError {
  public discordInvite?: string;
  public canRequestPermissions?: boolean;
  public permissionRequested?: boolean;
  public requestedAt?: string;
  
  constructor(
    message: string,
    discordInvite?: string,
    canRequestPermissions?: boolean,
    permissionRequested?: boolean,
    requestedAt?: string
  ) {
    super(403, message);
    this.name = 'CIRISPermissionDeniedError';
    this.discordInvite = discordInvite;
    this.canRequestPermissions = canRequestPermissions;
    this.permissionRequested = permissionRequested;
    this.requestedAt = requestedAt;
  }
}
