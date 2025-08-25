/**
 * Safely extracts an error message from various error formats
 * Handles CIRISAPIError, validation errors, and generic errors
 */
export function extractErrorMessage(error: any): string {
  // Handle null/undefined
  if (!error) {
    return 'Unknown error';
  }

  // If error is already a string, return it
  if (typeof error === 'string') {
    return error;
  }

  // Handle validation error arrays (FastAPI/Pydantic format)
  if (Array.isArray(error)) {
    return error.map(err => {
      if (typeof err === 'string') return err;
      if (err.msg) return err.msg;
      if (err.message) return err.message;
      return JSON.stringify(err);
    }).join('; ');
  }

  // Handle error objects with detail property
  if (error.detail) {
    // If detail is an array (validation errors)
    if (Array.isArray(error.detail)) {
      return error.detail.map((err: any) => {
        const location = Array.isArray(err.loc) ? err.loc.join('.') : err.loc || '';
        const message = err.msg || err.message || 'Validation error';
        return location ? `${location}: ${message}` : message;
      }).join('; ');
    }
    // If detail is a string
    if (typeof error.detail === 'string') {
      return error.detail;
    }
    // If detail is an object, stringify it
    if (typeof error.detail === 'object') {
      return JSON.stringify(error.detail);
    }
  }

  // Handle standard error message property
  if (error.message && typeof error.message === 'string') {
    return error.message;
  }

  // Handle error property (some APIs return { error: "message" })
  if (error.error && typeof error.error === 'string') {
    return error.error;
  }

  // Handle statusText property
  if (error.statusText && typeof error.statusText === 'string') {
    return error.statusText;
  }

  // Last resort: stringify the error
  try {
    const stringified = JSON.stringify(error);
    // Don't return huge stringified objects
    if (stringified.length > 200) {
      return 'Complex error object (see console for details)';
    }
    return stringified;
  } catch {
    // If we can't stringify it, return a generic message
    return 'Unknown error (see console for details)';
  }
}

/**
 * Checks if an error is a permission denied error with Discord invite
 */
export function isPermissionDeniedError(error: any): boolean {
  return error?.discordInvite || 
         error?.name === 'CIRISPermissionDeniedError' ||
         (error?.status === 403 && error?.detail?.includes?.('permission'));
}

/**
 * Extracts Discord invite URL from error if available
 */
export function getDiscordInvite(error: any): string | null {
  return error?.discordInvite || error?.discord_invite || null;
}