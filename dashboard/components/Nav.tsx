import Link from 'next/link';
import { signOutAction } from '@/app/login/actions';

type NavProps = {
  email: string | undefined;
  active: 'orders' | 'conversations';
};

export function Nav({ email, active }: NavProps) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/orders" className="nav-brand">
          GECO Orders
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <Link
            href="/orders"
            className="nav-link"
            aria-current={active === 'orders' ? 'page' : undefined}
          >
            Orders
          </Link>
          <Link
            href="/conversations"
            className="nav-link"
            aria-current={active === 'conversations' ? 'page' : undefined}
          >
            Conversations
          </Link>
        </nav>

        <div className="nav-user">
          {email ? <span>{email}</span> : null}
          <form action={signOutAction}>
            <button type="submit" className="btn btn-ghost">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
