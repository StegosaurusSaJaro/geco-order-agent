'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, Paperclip } from 'lucide-react';
import { loadOlderMessages } from '@/app/conversations/[id]/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency, formatDateTime, shortId, statusLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

export type ChatLinkedOrder = {
  id: string;
  status: string;
  total: number | string;
  currency: string;
  po_number: string | null;
};

export type ChatMessage = {
  id: string;
  direction: string;
  author: string;
  kind: string;
  body: string | null;
  file_name: string | null;
  created_at: string;
  linkedOrders: ChatLinkedOrder[];
};

type ChatLogProps = {
  conversationId: string;
  initialMessages: ChatMessage[];
  initialHasMore: boolean;
};

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const msg of existing) {
    map.set(msg.id, msg);
  }
  for (const msg of incoming) {
    map.set(msg.id, msg);
  }
  return Array.from(map.values()).sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id)
  );
}

export function ChatLog({
  conversationId,
  initialMessages,
  initialHasMore,
}: ChatLogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef<boolean>(false);
  const loadingRef = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const hasMoreRef = useRef<boolean>(hasMore);
  const prevInitialMessagesRef = useRef<ChatMessage[]>(initialMessages);
  const pendingScrollAdjustmentRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const pendingScrollToBottomRef = useRef<boolean>(false);

  messagesRef.current = messages;
  hasMoreRef.current = hasMore;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
    initializedRef.current = true;
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (pendingScrollAdjustmentRef.current) {
      const { scrollHeight, scrollTop } = pendingScrollAdjustmentRef.current;
      el.scrollTop = scrollTop + (el.scrollHeight - scrollHeight);
      pendingScrollAdjustmentRef.current = null;
    } else if (pendingScrollToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      pendingScrollToBottomRef.current = false;
    }
  }, [messages]);

  useEffect(() => {
    if (prevInitialMessagesRef.current === initialMessages) return;
    prevInitialMessagesRef.current = initialMessages;

    const el = scrollRef.current;
    const wasNearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight <= 80
      : false;

    const existingIds = new Set(messagesRef.current.map((msg) => msg.id));
    const hasNewMessages = initialMessages.some((msg) => !existingIds.has(msg.id));

    if (hasNewMessages && wasNearBottom) {
      pendingScrollToBottomRef.current = true;
    }

    setMessages((prev) => mergeMessages(prev, initialMessages));
  }, [initialMessages]);

  const handleLoadOlder = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    const oldest = messagesRef.current[0];
    if (!oldest) return;

    loadingRef.current = true;
    setIsLoadingOlder(true);
    setError(null);

    try {
      const result = await loadOlderMessages(conversationId, {
        created_at: oldest.created_at,
        id: oldest.id,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setHasMore(result.hasMore);

      if (result.messages.length > 0) {
        const el = scrollRef.current;
        if (el) {
          pendingScrollAdjustmentRef.current = {
            scrollHeight: el.scrollHeight,
            scrollTop: el.scrollTop,
          };
        }
        setMessages((prev) => mergeMessages(result.messages, prev));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load older messages.');
    } finally {
      loadingRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [conversationId]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || !initializedRef.current || loadingRef.current) {
          return;
        }
        void handleLoadOlder();
      },
      {
        root,
        rootMargin: '80px 0px 0px 0px',
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, error, handleLoadOlder]);

  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <div
        ref={scrollRef}
        className="h-[calc(100dvh-16rem)] min-h-[360px] overflow-y-auto overflow-x-hidden p-4 md:p-6 min-w-0"
      >
        {messages.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No messages in this conversation yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-w-0">
            {hasMore ? (
              <div className="flex flex-col items-center gap-2 pb-1">
                <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />
                {error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>
                      Failed to load older messages: {error}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleLoadOlder()}
                  disabled={isLoadingOlder}
                >
                  {isLoadingOlder ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Load older messages
                </Button>
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-muted-foreground">
                Start of conversation
              </div>
            )}

            {messages.map((msg) => {
              const bodyText = msg.body || (msg.file_name ? '' : '[No text]');
              const linkedOrders = msg.linkedOrders;
              const isOutgoing = msg.direction === 'out';
              return (
                <div
                  key={msg.id}
                  data-message-id={msg.id}
                  className={cn(
                    'max-w-[85%] md:max-w-[78%] min-w-0 border border-border rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5',
                    isOutgoing ? 'self-end bg-sidebar' : 'self-start bg-card'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {statusLabel(msg.author)}
                    </span>
                    <span>{msg.direction}</span>
                    <span>{msg.kind}</span>
                    <span className="font-mono tabular-nums">
                      {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                  {msg.file_name ? (
                    <div className="min-w-0">
                      <Badge variant="secondary" className="max-w-full font-mono text-xs">
                        <Paperclip className="size-3 shrink-0" />
                        <span className="truncate">{msg.file_name}</span>
                      </Badge>
                    </div>
                  ) : null}
                  {bodyText ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0">
                      {bodyText}
                    </div>
                  ) : null}
                  {linkedOrders.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1 min-w-0">
                      {linkedOrders.map((order) => (
                        <Link
                          key={order.id}
                          href={`/orders/${order.id}`}
                          className="inline-flex max-w-full items-center rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground transition-colors hover:border-brand-crimson hover:text-brand-crimson break-words"
                        >
                          {order.po_number || `#${shortId(order.id)}`} · {statusLabel(order.status)} · {formatCurrency(order.total, order.currency)}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
