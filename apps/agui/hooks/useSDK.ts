import { cirisClient } from '@/lib/ciris-sdk';

export function useSDK() {
  // The cirisClient singleton already manages authentication state
  // through AuthStore, which is automatically set when users log in
  // via AuthContext's login method or OAuth callbacks
  return cirisClient;
}
