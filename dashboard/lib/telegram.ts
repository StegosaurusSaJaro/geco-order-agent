export type TelegramSendResult = {
  ok: boolean;
  messageId: number | null;
  error?: string;
};

export async function sendTelegramMessage(
  chatId: number,
  text: string
): Promise<TelegramSendResult> {
  if (!Number.isFinite(chatId) || chatId < 0) {
    return { ok: false, messageId: null };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, messageId: null, error: 'Missing TELEGRAM_BOT_TOKEN' };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );

    const payload = (await response.json()) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };

    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        messageId: null,
        error: payload.description ?? `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      messageId: payload.result?.message_id ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      messageId: null,
      error: err instanceof Error ? err.message : 'Telegram request failed',
    };
  }
}
