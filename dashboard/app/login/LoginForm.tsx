'use client';

import { useActionState } from 'react';
import { AlertCircle, ArrowLeft, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInAction, type LoginState } from './actions';

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState
  );

  return (
    <div className="w-full max-w-[380px] flex flex-col gap-5">
      <a href="/" className="flex items-center justify-center gap-2.5">
        <div className="size-7 rounded-md bg-[var(--brand-crimson)] text-white grid place-items-center shrink-0">
          <Package className="size-[15px]" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight">
          Iloilo Superb Mart · Order Desk
        </span>
      </a>

      <Card className="w-full max-w-[380px]">
        <CardHeader>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>
            Sign in with your staff account to view orders and chats.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {state.error ? (
            <Alert variant="destructive" role="alert">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full mt-1" disabled={pending}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <a
        href="/"
        className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to website
      </a>
    </div>
  );
}
