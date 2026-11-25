'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export type LiveSubscription = {
  table: 'messages' | 'orders' | 'screening_log';
  event: 'INSERT' | 'UPDATE' | '*';
  filter?: string;
};

type LiveRefreshProps = {
  url: string;
  publishableKey: string;
  channelName: string;
  subscriptions: LiveSubscription[];
};

const REFRESH_DEBOUNCE_MS = 300;

export function LiveRefresh({ url, publishableKey, channelName, subscriptions }: LiveRefreshProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionKey = JSON.stringify(subscriptions);

  useEffect(() => {
    const supabase = createBrowserClient(url, publishableKey);
    const channel = supabase.channel(channelName);
    let cancelled = false;

    function scheduleRefresh() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (cancelled) return;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    for (const sub of subscriptions) {
      channel.on(
        'postgres_changes',
        { event: sub.event, schema: 'public', table: sub.table, filter: sub.filter },
        scheduleRefresh
      );
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [url, publishableKey, channelName, subscriptionKey, router]);

  return null;
}
