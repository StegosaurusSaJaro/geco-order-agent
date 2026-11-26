'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-sidebar/50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {error.message || 'An unexpected error occurred while loading this page.'}
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" />
              Try again
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/orders">
                <ArrowLeft className="size-3.5" />
                Back to Orders
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
