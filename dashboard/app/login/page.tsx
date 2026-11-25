import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  let isSignedIn = false;

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    isSignedIn = Boolean(data.user);
  } catch {}

  if (isSignedIn) {
    redirect('/orders');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-sidebar/50 px-4 py-8">
      <LoginForm />
    </main>
  );
}
