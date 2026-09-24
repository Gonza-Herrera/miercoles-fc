import { Session, User } from '@supabase/supabase-js';

import { Database } from '../supabase/database.types';

export type AuthStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type AuthOperation = 'GOOGLE' | 'LOGOUT' | 'MAGIC_LINK';

export interface AuthState {
  readonly status: AuthStatus;
  readonly session: Session | null;
  readonly user: User | null;
}

export class AuthOperationError extends Error {
  constructor(readonly operation: AuthOperation) {
    super(operation);
    this.name = 'AuthOperationError';
  }
}
