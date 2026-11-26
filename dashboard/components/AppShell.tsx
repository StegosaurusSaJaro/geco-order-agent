import Link from 'next/link';
import { Fragment } from 'react';
import { BarChart3, Box, Flag, Inbox, LogOut, MessageSquare, Package, UserPlus } from 'lucide-react';
import { signOutAction } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type NavSection = 'orders' | 'conversations' | 'inventory' | 'reports' | 'flagged' | 'signups';

type AppShellProps = {
  email: string | undefined;
  active: NavSection;
  breadcrumb?: BreadcrumbItem[];
  children: React.ReactNode;
};

const NAV_ITEMS: ReadonlyArray<{
  key: NavSection;
  label: string;
  href: string;
  icon: typeof Inbox;
}> = [
  { key: 'orders', label: 'Orders', href: '/orders', icon: Inbox },
  {
    key: 'conversations',
    label: 'Conversations',
    href: '/conversations',
    icon: MessageSquare,
  },
  { key: 'inventory', label: 'Inventory', href: '/inventory', icon: Box },
  { key: 'reports', label: 'Reports', href: '/reports', icon: BarChart3 },
  { key: 'flagged', label: 'Flagged', href: '/flagged', icon: Flag },
  { key: 'signups', label: 'Sign-ups', href: '/signups', icon: UserPlus },
];

function getInitials(email: string | undefined): string {
  if (!email) {
    return 'ST';
  }
  const local = email.split('@')[0] ?? '';
  const letters = local.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
  return letters.length === 2 ? letters : 'ST';
}

export function AppShell({
  email,
  active,
  breadcrumb,
  children,
}: AppShellProps) {
  const activeItem =
    NAV_ITEMS.find((item) => item.key === active) ?? NAV_ITEMS[0];
  const crumbs: BreadcrumbItem[] =
    breadcrumb && breadcrumb.length > 0
      ? breadcrumb
      : [{ label: activeItem.label }];
  const initials = getInitials(email);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:justify-between md:sticky md:top-0 md:h-screen md:overflow-y-auto bg-sidebar border-r border-sidebar-border p-3">
        <div>
          <Link
            href="/orders"
            className="flex items-center gap-2.5 px-2 pt-1.5 pb-3.5"
          >
            <div className="size-7 rounded-md bg-[var(--brand-crimson)] text-white grid place-items-center shrink-0">
              <Package className="size-[15px]" />
            </div>
            <div>
              <div className="text-[13.5px] font-semibold leading-tight">
                Iloilo Superb Mart
              </div>
              <div className="text-[11.5px] text-muted-foreground leading-tight">
                Order Desk
              </div>
            </div>
          </Link>

          <div className="text-[11px] font-medium text-muted-foreground px-2 pt-2 pb-1.5 tracking-[0.02em]">
            Operations
          </div>

          <nav className="grid gap-0.5" aria-label="Sidebar">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] font-medium transition-colors',
                    isActive
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                  )}
                >
                  <Icon className="size-[15px] shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-sidebar-border pt-2.5 flex flex-col gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {email === undefined ? (
              <>
                <Skeleton className="size-7 rounded-md shrink-0" />
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </>
            ) : (
              <>
                <div className="size-7 rounded-md bg-background border border-border grid place-items-center text-[11.5px] font-semibold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium truncate">
                    Sales Staff
                  </div>
                  {email ? (
                    <div className="font-mono text-[11px] text-muted-foreground truncate">
                      {email}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <form action={signOutAction} className="w-full">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-1.5"
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col bg-background">
        <header className="h-12 border-b border-border px-3 md:px-5 flex items-center justify-between gap-2 shrink-0">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-[13px] min-w-0 truncate"
          >
            <Link
              href="/orders"
              aria-label="Iloilo Superb Mart"
              className="md:hidden size-6 rounded-md bg-[var(--brand-crimson)] text-white grid place-items-center shrink-0"
            >
              <Package className="size-3.5" />
            </Link>
            <span className="md:hidden text-muted-foreground">/</span>
            <span className="hidden md:inline text-muted-foreground shrink-0">
              Iloilo Superb Mart
            </span>
            <span className="hidden md:inline text-muted-foreground">/</span>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? (
                    <span className="text-muted-foreground">/</span>
                  ) : null}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="text-muted-foreground hover:text-foreground truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground truncate">
                      {crumb.label}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </nav>

          <form action={signOutAction} className="md:hidden shrink-0">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </header>

        <nav
          aria-label="Primary"
          className="flex md:hidden items-center gap-1 border-b border-border bg-sidebar px-2.5 py-1.5 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="mx-auto w-full max-w-[1120px] px-3.5 py-4 md:px-6 md:py-6 flex flex-col gap-5 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
