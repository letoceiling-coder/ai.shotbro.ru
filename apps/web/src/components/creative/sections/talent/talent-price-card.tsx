"use client";

import { useState } from "react";
import type { TalentQuoteResult } from "@shotbro/contracts";
import { BadgeDollarSign, Check, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useConfirmTalentQuote,
  useQuoteTalent,
  useRejectTalentQuote,
  type TalentQuoteRequest,
} from "@/hooks/use-talent";
import { talentErrorMessage } from "@/lib/talent-errors";

const PRICE_STATUS: Record<TalentQuoteResult["priceStatus"], string> = {
  ESTIMATED: "оценка",
  INCLUDED_IN_PLAN: "входит в тариф",
  FREE: "бесплатно",
};

export function formatQuotePrice(q: Pick<TalentQuoteResult, "estimatedLiveUsd" | "priceStatus">) {
  if (q.priceStatus === "FREE") return "Бесплатно";
  if (q.priceStatus === "INCLUDED_IN_PLAN" && q.estimatedLiveUsd === 0) return "Входит в тариф";
  return `≈ $${q.estimatedLiveUsd.toFixed(2)}`;
}

/**
 * Two-step paid action: "Узнать цену" creates the approval card (budget held, nothing runs),
 * "Подтвердить" approves it and the server starts the job. The same card is also in the chat.
 */
export function TalentPriceCard({
  request,
  actionLabel,
  disabled,
  disabledReason,
  testId,
  onStarted,
}: {
  request: TalentQuoteRequest | null;
  actionLabel: string;
  disabled?: boolean;
  disabledReason?: string;
  testId: string;
  onStarted?: () => void;
}) {
  const quote = useQuoteTalent();
  const confirm = useConfirmTalentQuote();
  const reject = useRejectTalentQuote();
  const [q, setQ] = useState<TalentQuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function ask() {
    if (!request) return;
    setError(null);
    setDone(false);
    try {
      setQ(await quote.mutateAsync(request));
    } catch (e) {
      setError(talentErrorMessage(e));
    }
  }

  async function approve() {
    if (!request || !q) return;
    setError(null);
    try {
      await confirm.mutateAsync({ request, quote: q });
      setDone(true);
      setQ(null);
      onStarted?.();
    } catch (e) {
      setError(talentErrorMessage(e));
    }
  }

  async function cancel() {
    if (!q) return;
    const current = q;
    setQ(null);
    try {
      await reject.mutateAsync(current);
    } catch {
      /* the hold expires on its own in 30 minutes */
    }
  }

  return (
    <div className="space-y-2" data-testid={testId}>
      {!q ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={disabled || !request || quote.isPending}
            onClick={() => void ask()}
            data-testid={`${testId}-quote`}
          >
            {quote.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <BadgeDollarSign className="mr-1 h-4 w-4" />}
            {actionLabel} — узнать цену
          </Button>
          {disabled && disabledReason ? <span className="text-xs text-muted-foreground">{disabledReason}</span> : null}
        </div>
      ) : (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3" data-testid={`${testId}-offer`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" data-testid={`${testId}-price`}>
              {formatQuotePrice(q)}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {PRICE_STATUS[q.priceStatus]}
            </Badge>
            {q.mock ? (
              <Badge variant="secondary" className="text-[10px]" data-testid={`${testId}-mock`}>
                тест: списание $0
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">через {q.providerId}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {q.note}. {q.free ? "Подтверждение не требуется." : "Бюджет удержан на 30 минут; списание — только после подтверждения. Эта же карточка есть в чате."}
          </p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" onClick={() => void approve()} disabled={confirm.isPending} data-testid={`${testId}-approve`}>
              {confirm.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Подтвердить
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void cancel()} data-testid={`${testId}-cancel`}>
              <X className="mr-1 h-4 w-4" />
              Отмена
            </Button>
          </div>
        </div>
      )}
      {done ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400" data-testid={`${testId}-started`}>
          Запущено. Статус обновится автоматически.
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert" data-testid={`${testId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
