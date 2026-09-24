import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { createAuthCallbackUrl } from './auth-redirect';
import { AuthOperationError, AuthState, Profile } from './auth.models';

const INITIAL_STATE: AuthState = {
  session: null,
  status: 'INITIALIZING',
  user: null,
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly client = inject(SUPABASE_CLIENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly stateSignal = signal<AuthState>(INITIAL_STATE);
  private readonly profileSignal = signal<Profile | null>(null);
  private readonly profileErrorSignal = signal<string | null>(null);
  private readonly initializedPromise: Promise<void>;
  private resolveInitialized!: () => void;
  private initializationResolved = false;
  private profileRequest = 0;
  private requestedProfileId: string | null = null;

  readonly state = this.stateSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly profileError = this.profileErrorSignal.asReadonly();
  readonly session = computed(() => this.state().session);
  readonly user = computed(() => this.state().user);
  readonly isAuthenticated = computed(() => this.state().status === 'AUTHENTICATED');
  readonly isInitializing = computed(() => this.state().status === 'INITIALIZING');
  readonly displayName = computed(
    () => this.profile()?.display_name ?? this.user()?.email?.split('@')[0] ?? 'Miércoles FC',
  );

  constructor() {
    this.initializedPromise = new Promise<void>((resolve) => {
      this.resolveInitialized = resolve;
    });

    const {
      data: { subscription },
    } = this.client.auth.onAuthStateChange((event, session) => {
      this.handleAuthChange(event, session);
    });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  initialize(): Promise<void> {
    return this.initializedPromise;
  }

  async requestMagicLink(email: string, returnUrl?: string | null): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: this.callbackUrl(returnUrl),
        shouldCreateUser: true,
      },
    });

    if (error) {
      throw new AuthOperationError('MAGIC_LINK');
    }
  }

  async signInWithGoogle(returnUrl?: string | null): Promise<void> {
    const { error } = await this.client.auth.signInWithOAuth({
      options: { redirectTo: this.callbackUrl(returnUrl) },
      provider: 'google',
    });

    if (error) {
      throw new AuthOperationError('GOOGLE');
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw new AuthOperationError('LOGOUT');
    }

    this.applySession(null);
  }

  private callbackUrl(returnUrl?: string | null): string {
    return createAuthCallbackUrl(this.document.location.origin, returnUrl);
  }

  private handleAuthChange(event: AuthChangeEvent, session: Session | null): void {
    this.applySession(session);

    if (event === 'INITIAL_SESSION' && !this.initializationResolved) {
      this.initializationResolved = true;
      this.resolveInitialized();
    }
  }

  private applySession(session: Session | null): void {
    if (!session) {
      this.profileRequest += 1;
      this.requestedProfileId = null;
      this.profileSignal.set(null);
      this.profileErrorSignal.set(null);
      this.stateSignal.set({ session: null, status: 'UNAUTHENTICATED', user: null });
      return;
    }

    this.stateSignal.set({ session, status: 'AUTHENTICATED', user: session.user });
    this.scheduleProfileLoad(session.user.id);
  }

  private scheduleProfileLoad(userId: string): void {
    if (this.profile()?.id === userId || this.requestedProfileId === userId) {
      return;
    }

    this.requestedProfileId = userId;
    const request = ++this.profileRequest;
    setTimeout(() => void this.loadProfile(userId, request), 0);
  }

  private async loadProfile(userId: string, request: number): Promise<void> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id, display_name, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (request !== this.profileRequest || this.user()?.id !== userId) {
      return;
    }

    this.requestedProfileId = null;

    if (error) {
      this.profileSignal.set(null);
      this.profileErrorSignal.set('No pudimos cargar tu perfil. Intentá nuevamente más tarde.');
      return;
    }

    this.profileErrorSignal.set(null);
    this.profileSignal.set(data);
  }
}
