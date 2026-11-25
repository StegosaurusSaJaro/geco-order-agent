import { AppShell } from '@/components/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MESSAGE_BUBBLES: ReadonlyArray<{
  outgoing: boolean;
  width: string;
  lines: ReadonlyArray<string>;
}> = [
  { outgoing: false, width: 'w-72 max-w-[85%] md:max-w-[78%]', lines: ['w-full', 'w-3/4'] },
  { outgoing: true, width: 'w-80 max-w-[85%] md:max-w-[78%]', lines: ['w-full', 'w-5/6'] },
  { outgoing: false, width: 'w-64 max-w-[85%] md:max-w-[78%]', lines: ['w-full'] },
  { outgoing: true, width: 'w-96 max-w-[85%] md:max-w-[78%]', lines: ['w-full', 'w-full', 'w-2/3'] },
  { outgoing: false, width: 'w-72 max-w-[85%] md:max-w-[78%]', lines: ['w-full', 'w-1/2'] },
  { outgoing: true, width: 'w-64 max-w-[85%] md:max-w-[78%]', lines: ['w-full'] },
];

export default function ConversationDetailLoading() {
  return (
    <AppShell
      email={undefined}
      active="conversations"
      breadcrumb={[
        { label: 'Conversations', href: '/conversations' },
        { label: 'Conversation' },
      ]}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="shrink-0">
          <Skeleton className="h-8 w-40" />
        </div>
      </div>

      <Card className="gap-0 py-0 overflow-hidden">
        <CardContent className="p-4 md:p-6 min-w-0 max-h-[65vh] overflow-y-auto">
          <div className="flex flex-col gap-3 min-w-0">
            {MESSAGE_BUBBLES.map((bubble, idx) => (
              <div
                key={idx}
                className={cn(
                  'min-w-0 border border-border rounded-lg px-3.5 py-2.5 flex flex-col gap-2',
                  bubble.width,
                  bubble.outgoing ? 'self-end bg-sidebar' : 'self-start bg-card'
                )}
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-col gap-1.5">
                  {bubble.lines.map((lineWidth, lineIdx) => (
                    <Skeleton key={lineIdx} className={cn('h-4', lineWidth)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
