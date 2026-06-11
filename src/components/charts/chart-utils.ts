import type { UTCTimestamp } from "lightweight-charts";

// lightweight-charts wants either a 'yyyy-mm-dd' business day or a UTC timestamp.
// We use UTC timestamps (seconds) everywhere for consistent intraday + daily handling.
export function toUtcTs(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

// Sort ascending and drop duplicate timestamps — lightweight-charts throws otherwise.
export function dedupeSortByTime<T extends { time: number }>(points: T[]): T[] {
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const out: T[] = [];
  let lastTime: number | null = null;
  for (const p of sorted) {
    if (p.time === lastTime) {
      out[out.length - 1] = p; // keep last value for that timestamp
    } else {
      out.push(p);
      lastTime = p.time;
    }
  }
  return out;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
