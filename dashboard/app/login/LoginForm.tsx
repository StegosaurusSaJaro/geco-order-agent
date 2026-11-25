'use client';

import { useActionState } from 'react';
import { signInAction, type LoginState } from './actions';

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState
  );

  return (
    <div className="login-card">
      <h1>GECO Orders</h1>
      <p>Sign in with your staff account to view orders and chats.</p>

      {state.error ? (
        <div className="error-box" role="alert">
          {state.error}
        </div>
      ) : null}

      <form action={formAction}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 6 }}
          disabled={pending}
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
