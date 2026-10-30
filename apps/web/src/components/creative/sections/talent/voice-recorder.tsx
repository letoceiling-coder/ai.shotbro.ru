"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, RotateCcw, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealUpload } from "@/hooks/use-real-upload";
import { waitAssetReady } from "@/hooks/use-talent";
import { downmixToMono, encodeWav, formatSeconds, resample, rmsLevel } from "@/lib/wav";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "./talent-file-input";

/** Texts to read aloud for a voice clone: varied intonation, ~45–60 s each at a calm pace. */
export const VOICE_SAMPLE_SCRIPTS = [
  "Привет! Меня зовут так, как вы меня назовёте, а этот голос будет звучать в ваших роликах. " +
    "Сегодня я расскажу, как за одну минуту превратить идею в рекламное видео. Сначала мы пишем короткий сценарий, " +
    "потом выбираем героя, голос и стиль. Затем студия собирает сцены, озвучку и монтаж. Звучит просто? Так и есть! " +
    "Попробуйте сами на сайте shotbro точка ру — и первый ролик будет готов быстрее, чем остынет ваш кофе.",
  "Представьте утро понедельника. Вы открываете ноутбук, а рекламный ролик для нового продукта уже готов. " +
    "Три сцены, понятный призыв к действию и голос, который узнают ваши клиенты. Никаких студий звукозаписи, " +
    "долгих согласований и лишних расходов. Хотите изменить вторую сцену? Скажите об этом агенту — он предложит варианты " +
    "и покажет стоимость. Вы просто нажимаете «Подтвердить». Удобно, правда?",
  "Внимание, важное объявление! С сегодняшнего дня каждый может снимать видео как профессионал. " +
    "Одна идея, один сценарий, один клик — и ролик готов для соцсетей, сайта или презентации. " +
    "Расскажите о своём бизнесе спокойно, уверенно и с улыбкой. Сделайте паузу. А теперь чуть быстрее и энергичнее: " +
    "ваши клиенты ждут, время действовать! Спасибо, что дослушали до конца.",
];

export function consentScript(personName: string, what: "голоса" | "внешности") {
  const date = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const name = personName.trim() || "[ваше имя и фамилия]";
  return (
    `Я, ${name}, даю согласие на создание и использование цифровой копии моего ${what} ` +
    `в рекламных роликах, созданных в студии SHOTBRO. Сегодня ${date}. Я делаю эту запись добровольно.`
  );
}

type Phase = "idle" | "asking" | "recording" | "recorded" | "uploading" | "error";

const TARGET_RATE = 24_000;

/**
 * Record a voice sample (or a spoken consent) right in the browser: read the text on screen,
 * listen back, then save. The recording is stored as WAV in the project's files.
 */
export function VoiceRecorder({
  projectId,
  script,
  onNextScript,
  minSeconds,
  maxSeconds,
  fileLabel,
  onSaved,
  testId,
  disabled,
}: {
  projectId: string;
  script: string;
  onNextScript?: () => void;
  minSeconds: number;
  maxSeconds: number;
  fileLabel: string;
  onSaved: (file: UploadedFile) => void;
  testId: string;
  disabled?: boolean;
}) {
  const upload = useRealUpload(projectId);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [wav, setWav] = useState<{ url: string; file: File; seconds: number } | null>(null);
  const rec = useRef<{ stream: MediaStream; recorder: MediaRecorder; ctx: AudioContext; raf: number; timer: ReturnType<typeof setInterval> } | null>(
    null,
  );
  const chunks = useRef<Blob[]>([]);

  const supported =
    typeof window !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  useEffect(
    () => () => {
      stopTracks();
      if (wav) URL.revokeObjectURL(wav.url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function stopTracks() {
    const r = rec.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close().catch(() => undefined);
    rec.current = null;
  }

  async function start() {
    setError(null);
    if (!window.isSecureContext) {
      setPhase("error");
      setError("Запись работает только по защищённому адресу (https).");
      return;
    }
    setPhase("asking");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
      setPhase("error");
      setError("Нет доступа к микрофону. Разрешите его в браузере (значок замка слева от адреса сайта) и нажмите «Записать» ещё раз.");
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const frame = new Float32Array(analyser.fftSize);
    const recorder = new MediaRecorder(stream);
    chunks.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    recorder.onstop = () => void finish(recorder.mimeType);
    const started = Date.now();
    const tick = () => {
      analyser.getFloatTimeDomainData(frame);
      setLevel(rmsLevel(frame));
      if (rec.current) rec.current.raf = requestAnimationFrame(tick);
    };
    const timer = setInterval(() => {
      const s = (Date.now() - started) / 1000;
      setSeconds(s);
      if (s >= maxSeconds) stop();
    }, 250);
    rec.current = { stream, recorder, ctx, raf: requestAnimationFrame(tick), timer };
    setSeconds(0);
    recorder.start(1000);
    setPhase("recording");
  }

  function stop() {
    const r = rec.current;
    if (!r || r.recorder.state === "inactive") return;
    r.recorder.stop();
  }

  async function finish(mimeType: string) {
    stopTracks();
    try {
      const blob = new Blob(chunks.current, { type: mimeType || "audio/webm" });
      const decodeCtx = new AudioContext();
      const audio = await decodeCtx.decodeAudioData(await blob.arrayBuffer());
      void decodeCtx.close().catch(() => undefined);
      const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
      const mono = resample(downmixToMono(channels), audio.sampleRate, TARGET_RATE);
      const bytes = encodeWav(mono, TARGET_RATE);
      const file = new File([bytes], `${fileLabel}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.wav`, { type: "audio/wav" });
      if (wav) URL.revokeObjectURL(wav.url);
      setWav({ url: URL.createObjectURL(file), file, seconds: audio.duration });
      setPhase("recorded");
    } catch {
      setPhase("error");
      setError("Не удалось обработать запись. Попробуйте ещё раз или загрузите файл.");
    }
  }

  async function save() {
    if (!wav) return;
    setPhase("uploading");
    setError(null);
    try {
      const assetId = await upload.mutateAsync(wav.file);
      await waitAssetReady(assetId);
      onSaved({ assetId, name: wav.file.name });
      URL.revokeObjectURL(wav.url);
      setWav(null);
      setSeconds(0);
      setPhase("idle");
    } catch (e) {
      setPhase("recorded");
      setError(`Не удалось сохранить запись: ${e instanceof Error ? e.message : "ошибка загрузки"}`);
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={`${testId}-unsupported`}>
        Этот браузер не умеет записывать звук. Откройте студию в Chrome, Edge, Firefox или Safari — или загрузите готовый файл.
      </p>
    );
  }

  const tooShort = wav ? wav.seconds < minSeconds : false;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3" data-testid={testId} data-phase={phase}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Прочитайте вслух:</p>
        {onNextScript && phase !== "recording" ? (
          <button type="button" className="text-[11px] text-primary hover:underline" onClick={onNextScript}>
            Другой текст
          </button>
        ) : null}
      </div>
      <p className="max-h-36 overflow-y-auto rounded-md bg-background p-2 text-sm leading-relaxed" data-testid={`${testId}-script`}>
        {script}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Тихое помещение, микрофон в 15–20 см, обычный темп. {minSeconds > 5 ? `Нужно не меньше ${minSeconds} с, лучше около минуты.` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {phase === "recording" ? (
          <>
            <Button type="button" size="sm" variant="destructive" onClick={stop} data-testid={`${testId}-stop`}>
              <Square className="mr-1 h-3.5 w-3.5" />
              Остановить
            </Button>
            <span className="flex items-center gap-1.5 text-xs tabular-nums" data-testid={`${testId}-timer`}>
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {formatSeconds(seconds)} / {formatSeconds(maxSeconds)}
            </span>
            <span className="h-2 w-24 overflow-hidden rounded bg-muted" aria-label="Уровень звука">
              <span className="block h-full bg-emerald-500 transition-[width]" style={{ width: `${Math.round(level * 100)}%` }} />
            </span>
          </>
        ) : phase === "recorded" || phase === "uploading" ? (
          <>
            <audio controls src={wav?.url} className="h-8 max-w-[240px]" data-testid={`${testId}-playback`} />
            <Button
              type="button"
              size="sm"
              disabled={phase === "uploading" || tooShort || disabled}
              onClick={() => void save()}
              data-testid={`${testId}-save`}
            >
              {phase === "uploading" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
              Использовать запись
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={phase === "uploading"} onClick={() => void start()}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Перезаписать
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={phase === "asking" || disabled}
            onClick={() => void start()}
            data-testid={`${testId}-start`}
          >
            {phase === "asking" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Mic className="mr-1 h-3.5 w-3.5" />}
            {phase === "asking" ? "Разрешите микрофон…" : "Записать с микрофона"}
          </Button>
        )}
      </div>
      {wav && tooShort ? (
        <p className={cn("text-xs text-[var(--sb-warning)]")}>
          Запись {Math.round(wav.seconds)} с — слишком коротко, нужно хотя бы {minSeconds} с. Перезапишите, дочитав текст.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
