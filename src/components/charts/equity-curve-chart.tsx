"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  ColorType,
  LineType,
  LineStyle,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
  type MouseEventParams,
  type LogicalRange,
} from "lightweight-charts";
import {
  ZoomIn,
  ZoomOut,
  Minus,
  Maximize2,
  Minimize2,
  Upload,
  RotateCcw,
  ChevronDown,
  Calendar as CalendarIcon,
} from "lucide-react";
import type { SnapshotDTO, SnapshotGranularity, TransactionDTO } from "@/types";
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatDate,
  signClass,
} from "@/lib/format";
import {
  toUtcTs,
  dedupeSortByTime,
  downloadCanvas,
  classifyPoint,
  EVENT_COLORS,
  EVENT_LABEL,
  type EventKind,
} from "./chart-utils";
import { useCallbackRef } from "@/hooks/use-callback-ref";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ── Timeframe presets ───────────────────────────────────────────────────────
// Buttons are range presets that also pick the finest available granularity.
// Data only carries DAY/WEEK/MONTH, so 1H falls back to DAY. `days = null` = ALL.
interface Timeframe {
  label: string;
  granularity: SnapshotGranularity;
  days: number | null;
}
const TIMEFRAMES: Timeframe[] = [
  { label: "1H", granularity: "DAY", days: 7 },
  { label: "1D", granularity: "DAY", days: 14 },
  { label: "1W", granularity: "WEEK", days: 84 },
  { label: "1M", granularity: "DAY", days: 30 },
  { label: "3M", granularity: "DAY", days: 90 },
  { label: "6M", granularity: "MONTH", days: 180 },
  { label: "1Y", granularity: "MONTH", days: 365 },
  { label: "ALL", granularity: "MONTH", days: null },
];

const MARKER_LIMIT = 60; // hide per-point markers once the visible set is denser
const AXIS_TEXT = "#9CA3AF";

interface PointMeta {
  pnlDelta: number;
  kind: EventKind;
  color: string;
}
interface MarkerPoint {
  time: UTCTimestamp;
  value: number;
  color: string;
}

interface Props {
  data: SnapshotDTO[];
  transactions: TransactionDTO[];
  granularity: SnapshotGranularity;
  onGranularityChange: (g: SnapshotGranularity) => void;
  onRefresh?: () => void;
}

export function EquityCurveChart({
  data,
  transactions,
  granularity,
  onGranularityChange,
  onRefresh,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Lookup maps for tooltip + markers, keyed by UTC-second timestamp.
  const txnsByTime = useRef<Map<number, TransactionDTO[]>>(new Map());
  const metaByTime = useRef<Map<number, PointMeta>>(new Map());
  const markerPointsRef = useRef<MarkerPoint[]>([]);
  const hoverTimeRef = useRef<number | null>(null);

  const [activeTf, setActiveTf] = useState("1D");
  const [empty, setEmpty] = useState(data.length === 0);
  const [fullscreen, setFullscreen] = useState(false);
  const [markers, setMarkers] = useState<
    { x: number; y: number; color: string; time: number }[]
  >([]);

  // Indicator visibility toggles.
  const [showMarkers, setShowMarkers] = useState(true);
  const [showArea, setShowArea] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // Manual axis inputs (data-derived defaults are filled in by the data effect).
  const [minDate, setMinDate] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");

  // Auto-refresh.
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshSecs, setRefreshSecs] = useState("300");

  // ── Header summary (from the last snapshot, never hardcoded) ──────────────
  const last = data.at(-1);
  const netPnl = last?.netPnl ?? 0;
  const returnPct = last?.returnPct ?? 0;

  // ── Derived data-range bounds for X axis defaults ─────────────────────────
  const bounds = useMemo(() => {
    if (data.length === 0) return null;
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return { first: sorted[0].date, last: sorted[sorted.length - 1].date };
  }, [data]);

  // ── Recompute marker screen positions from the chart's coordinate system ──
  const repositionMarkers = useCallbackRef(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    if (!showMarkers) {
      setMarkers([]);
      return;
    }
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange() as LogicalRange | null;
    const pts = markerPointsRef.current;

    // Count how many points are visible; hide markers when too dense.
    let visibleCount = pts.length;
    if (range) {
      visibleCount = 0;
      for (const p of pts) {
        const x = ts.timeToCoordinate(p.time as Time);
        if (x !== null) visibleCount++;
      }
    }
    if (visibleCount > MARKER_LIMIT) {
      setMarkers([]);
      return;
    }

    const next: { x: number; y: number; color: string; time: number }[] = [];
    for (const p of pts) {
      const x = ts.timeToCoordinate(p.time as Time);
      const y = series.priceToCoordinate(p.value);
      if (x === null || y === null) continue;
      next.push({ x, y, color: p.color, time: p.time });
    }
    setMarkers(next);
  });

  // ── Crosshair tooltip ─────────────────────────────────────────────────────
  const repositionAndTooltip = useCallbackRef((param: MouseEventParams) => {
    const tip = tooltipRef.current;
    const series = seriesRef.current;
    if (!tip || !series) return;

    if (!param.time || !param.point) {
      tip.style.display = "none";
      hoverTimeRef.current = null;
      return;
    }
    const price = param.seriesData.get(series) as { value: number } | undefined;
    if (!price) {
      tip.style.display = "none";
      hoverTimeRef.current = null;
      return;
    }

    const timeNum = param.time as number;
    hoverTimeRef.current = timeNum;
    const d = new Date(timeNum * 1000);
    const meta = metaByTime.current.get(timeNum);

    const calSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-70"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;

    let html = `<div class="flex items-center gap-1.5 text-[12px] font-medium text-white/70 mb-1">${calSvg}${formatDate(
      d,
    )}</div>`;

    if (meta) {
      html += `<div class="text-[13px]"><span class="text-white/55">P&L: </span><span style="color:${meta.color}" class="font-semibold">${formatSignedCurrency(
        meta.pnlDelta,
      )} (${EVENT_LABEL[meta.kind]})</span></div>`;
    }
    html += `<div class="text-[13px]"><span class="text-white/55">Equity: </span><span class="font-semibold text-white">${formatCurrency(
      price.value,
    )}</span></div>`;

    const dayTxs = txnsByTime.current.get(timeNum);
    if (dayTxs && dayTxs.length > 0) {
      const flows = dayTxs.filter((t) => t.type === "DEPOSIT" || t.type === "WITHDRAWAL");
      if (flows.length > 0) {
        html += `<div class="mt-1.5 flex flex-col gap-1 border-t border-white/10 pt-1.5">`;
        for (const t of flows) {
          const isDep = t.type === "DEPOSIT";
          const c = isDep ? EVENT_COLORS.DEPOSIT : EVENT_COLORS.WITHDRAWAL;
          html += `<div class="text-[11px] font-medium" style="color:${c}">${
            isDep ? "+" : "−"
          } ${formatCurrency(t.amount)} ${isDep ? "Deposit" : "Withdrawal"}</div>`;
          if (t.reason)
            html += `<div class="ml-3 text-[10px] leading-tight text-white/40">${t.reason}</div>`;
        }
        html += `</div>`;
      }
    }

    tip.innerHTML = html;
    tip.style.display = "block";
    const el = containerRef.current;
    const w = el?.clientWidth ?? 0;
    // Flip the tooltip to the left when near the right edge.
    const left = param.point.x + 200 > w ? param.point.x - 188 : param.point.x + 16;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, param.point.y + 16)}px`;

    // Re-render markers so the hovered one scales up.
    setMarkers((prev) => (prev.length ? [...prev] : prev));
  });

  // ── Create chart once ─────────────────────────────────────────────────────
  // Declared after the stable useCallbackRef handlers so it can reference them.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: AXIS_TEXT,
        attributionLogo: false,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)", style: LineStyle.Dashed },
        horzLines: { color: "rgba(255,255,255,0.06)", style: LineStyle.Dashed },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.2)", style: LineStyle.Dashed, labelVisible: false },
        horzLine: { color: "rgba(255,255,255,0.2)", style: LineStyle.Dashed, labelVisible: false },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: true,
      handleScale: true,
      autoSize: false,
      width: el.clientWidth,
      height: el.clientHeight || 440,
    });

    const series = chart.addSeries(AreaSeries, {
      lineWidth: 3,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false, // we draw our own markers
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onMove = (param: MouseEventParams) => repositionAndTooltip(param);
    chart.subscribeCrosshairMove(onMove);

    const onRange = () => repositionMarkers();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight || 440 });
      repositionMarkers();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push data + colors when inputs change ─────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    // Map raw transactions onto their bucket timestamp.
    const tMap = new Map<number, TransactionDTO[]>();
    for (const t of transactions) {
      const time = toUtcTs(t.date) as number;
      const arr = tMap.get(time) ?? [];
      arr.push(t);
      tMap.set(time, arr);
    }
    txnsByTime.current = tMap;

    const raw = dedupeSortByTime(
      data.map((s) => ({
        time: toUtcTs(s.date) as number,
        value: s.portfolioValue,
        netPnl: s.netPnl,
      })),
    );

    const meta = new Map<number, PointMeta>();
    const markerPts: MarkerPoint[] = [];

    const points = raw.map((p, i) => {
      const dayTxs = tMap.get(p.time);
      const pnlDelta = i > 0 ? p.netPnl - raw[i - 1].netPnl : 0;
      const kind = classifyPoint(dayTxs, pnlDelta);
      const color = EVENT_COLORS[kind];

      meta.set(p.time, { pnlDelta, kind, color });
      markerPts.push({ time: p.time as UTCTimestamp, value: p.value, color });

      return {
        time: p.time as Time,
        value: p.value,
        lineColor: color,
        topColor: showArea ? color + "40" : "rgba(0,0,0,0)",
        bottomColor: showArea ? color + "00" : "rgba(0,0,0,0)",
      };
    });

    metaByTime.current = meta;
    markerPointsRef.current = markerPts;

    series.setData(points);
    setEmpty(points.length === 0);

    chart.timeScale().fitContent();
    repositionMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, transactions, showArea]);

  // ── React to indicator toggles that don't require re-setting data ─────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      grid: {
        vertLines: { visible: showGrid },
        horzLines: { visible: showGrid },
      },
    });
  }, [showGrid]);

  useEffect(() => {
    repositionMarkers();
  }, [showMarkers, repositionMarkers]);

  // ── Auto-refresh interval ─────────────────────────────────────────────────
  const refresh = useCallbackRef(() => onRefresh?.());
  useEffect(() => {
    if (!autoRefresh) return;
    const ms = Number(refreshSecs) * 1000;
    if (!Number.isFinite(ms) || ms <= 0) return;
    const id = setInterval(() => refresh(), ms);
    return () => clearInterval(id);
  }, [autoRefresh, refreshSecs, refresh]);

  // ── Apply manual X (date) range ───────────────────────────────────────────
  function applyDateRange(nextMin: string, nextMax: string) {
    const chart = chartRef.current;
    if (!chart || !nextMin || !nextMax) return;
    const from = Math.floor(new Date(nextMin).getTime() / 1000) as UTCTimestamp;
    const to = Math.floor(new Date(nextMax).getTime() / 1000) as UTCTimestamp;
    if (Number.isNaN(from) || Number.isNaN(to) || from >= to) return;
    try {
      chart.timeScale().setVisibleRange({ from: from as Time, to: to as Time });
      repositionMarkers();
    } catch {
      /* range outside data — ignore, keep current view */
    }
  }

  // ── Apply manual Y (value) range ──────────────────────────────────────────
  function applyValueRange(nextMin: string, nextMax: string) {
    const series = seriesRef.current;
    if (!series) return;
    const lo = nextMin === "" ? null : Number(nextMin);
    const hi = nextMax === "" ? null : Number(nextMax);
    if (lo === null && hi === null) {
      series.priceScale().applyOptions({ autoScale: true });
      series.applyOptions({ autoscaleInfoProvider: undefined });
    } else {
      series.priceScale().applyOptions({ autoScale: false });
      series.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: lo ?? 0,
            maxValue: hi ?? (lo ?? 0) + 1,
          },
        }),
      });
    }
    repositionMarkers();
  }

  function stepValue(which: "min" | "max", dir: 1 | -1) {
    const step = 1000;
    if (which === "min") {
      const next = String(Math.max(0, (Number(minValue) || 0) + dir * step));
      setMinValue(next);
      applyValueRange(next, maxValue);
    } else {
      const next = String(Math.max(0, (Number(maxValue) || 0) + dir * step));
      setMaxValue(next);
      applyValueRange(minValue, next);
    }
  }

  function resetAxis() {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    series.priceScale().applyOptions({ autoScale: true });
    series.applyOptions({ autoscaleInfoProvider: undefined });
    chart.timeScale().fitContent();
    if (bounds) {
      setMinDate(isoToInput(bounds.first));
      setMaxDate(isoToInput(bounds.last));
    }
    const vals = markerPointsRef.current.map((p) => p.value);
    if (vals.length) {
      setMinValue(String(Math.floor(Math.max(0, Math.min(...vals) * 0.9))));
      setMaxValue(String(Math.ceil(Math.max(...vals) * 1.1)));
    }
    repositionMarkers();
  }

  // ── Timeframe selection ───────────────────────────────────────────────────
  function selectTimeframe(tf: Timeframe) {
    setActiveTf(tf.label);
    if (tf.granularity !== granularity) onGranularityChange(tf.granularity);

    const chart = chartRef.current;
    if (!chart || !bounds) return;
    if (tf.days === null) {
      chart.timeScale().fitContent();
    } else {
      const lastMs = new Date(bounds.last).getTime();
      const firstMs = new Date(bounds.first).getTime();
      const fromMs = Math.max(firstMs, lastMs - tf.days * 86400_000);
      const from = Math.floor(fromMs / 1000) as UTCTimestamp;
      const to = Math.floor(lastMs / 1000) as UTCTimestamp;
      try {
        chart.timeScale().setVisibleRange({ from: from as Time, to: to as Time });
      } catch {
        chart.timeScale().fitContent();
      }
    }
    repositionMarkers();
  }

  // ── Bottom toolbar zoom/pan/fit/export ────────────────────────────────────
  function zoomBy(factor: number) {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    if (!r) return;
    const center = (r.from + r.to) / 2;
    const half = ((r.to - r.from) / 2) * factor;
    ts.setVisibleLogicalRange({ from: center - half, to: center + half } as LogicalRange);
    repositionMarkers();
  }
  const fit = () => {
    chartRef.current?.timeScale().fitContent();
    repositionMarkers();
  };
  const exportPng = () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (canvas) downloadCanvas(canvas, "equity-curve.png");
  };

  const legend: { kind: EventKind; sub: string }[] = [
    { kind: "PROFIT", sub: "Day's P&L > 0" },
    { kind: "LOSS", sub: "Day's P&L < 0" },
    { kind: "DEPOSIT", sub: "Fund Added" },
    { kind: "WITHDRAWAL", sub: "Fund Withdrawn" },
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-[#0A0A0A] p-5 shadow-2xl shadow-black/40 sm:p-6",
        fullscreen && "fixed inset-3 z-50 m-0 overflow-auto",
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            TRADE JOURNAL — EQUITY CURVE
          </h2>
          <p className="mt-1 text-sm text-white/45">
            The equity line color must reflect the nature of that time unit.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium uppercase tracking-wider text-white/45">
            Overall P&L (INR)
          </div>
          <div className={cn("text-2xl font-bold sm:text-3xl", signClass(netPnl))}>
            {formatSignedCurrency(netPnl)}
          </div>
          <div className={cn("text-sm font-medium", signClass(returnPct))}>
            ({formatPercent(returnPct, 2)})
          </div>
        </div>
      </div>

      {/* ── Timeframe controls + indicators ─────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => selectTimeframe(tf)}
              className={cn(
                "h-9 min-w-9 rounded-md border px-3 text-sm font-medium transition-colors",
                activeTf === tf.label
                  ? "border-transparent bg-[#EAB308] text-black"
                  : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]",
              )}
            >
              {tf.label}
            </button>
          ))}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
            title="Date range"
            onClick={() => applyDateRange(minDate, maxDate)}
          >
            <CalendarIcon className="size-4" />
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-9 gap-2 border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]"
            >
              Indicators
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Overlays</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showMarkers} onCheckedChange={setShowMarkers}>
              Data markers
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showArea} onCheckedChange={setShowArea}>
              Area fill
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>
              Grid lines
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Chart + side panel ──────────────────────────────────────────── */}
      <div className="mt-4 flex gap-4">
        <div className="relative min-w-0 flex-1">
          <span className="absolute left-2 top-1 z-10 text-[11px] font-medium text-white/40">
            INR
          </span>
          <div
            ref={containerRef}
            className="h-[440px] w-full overflow-hidden rounded-xl border border-white/[0.05] bg-[#0D0D0D]"
          />

          {/* Marker overlay */}
          {showMarkers && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {markers.map((m, i) => {
                const hovered = hoverTimeRef.current === m.time;
                return (
                  <circle
                    key={`${m.time}-${i}`}
                    cx={m.x}
                    cy={m.y}
                    r={hovered ? 7 : 4.5}
                    fill={m.color}
                    stroke="#ffffff"
                    strokeWidth={hovered ? 2.5 : 1.5}
                    className="transition-all duration-150"
                  />
                );
              })}
            </svg>
          )}

          {/* Tooltip */}
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute z-20 hidden min-w-[170px] rounded-lg border border-white/10 bg-[#121212]/95 p-3 shadow-xl backdrop-blur-md"
            style={{ display: "none" }}
          />

          {empty && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
              No data yet — add transactions to see your equity curve.
            </div>
          )}
        </div>

        {/* Right control panel */}
        <aside className="hidden w-52 shrink-0 flex-col gap-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:flex">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
              X-Axis Range
            </div>
            <AxisField label="Min Date">
              <input
                type="date"
                value={minDate}
                onChange={(e) => {
                  setMinDate(e.target.value);
                  applyDateRange(e.target.value, maxDate);
                }}
                className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-white outline-none focus:border-[#EAB308]/50 [color-scheme:dark]"
              />
            </AxisField>
            <AxisField label="Max Date">
              <input
                type="date"
                value={maxDate}
                onChange={(e) => {
                  setMaxDate(e.target.value);
                  applyDateRange(minDate, e.target.value);
                }}
                className="h-9 w-full rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-white outline-none focus:border-[#EAB308]/50 [color-scheme:dark]"
              />
            </AxisField>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Y-Axis Range
            </div>
            <AxisField label="Min Value">
              <Stepper
                value={minValue}
                onChange={(v) => {
                  setMinValue(v);
                  applyValueRange(v, maxValue);
                }}
                onStep={(dir) => stepValue("min", dir)}
              />
            </AxisField>
            <AxisField label="Max Value">
              <Stepper
                value={maxValue}
                onChange={(v) => {
                  setMaxValue(v);
                  applyValueRange(minValue, v);
                }}
                onStep={(dir) => stepValue("max", dir)}
              />
            </AxisField>
          </div>

          <button
            onClick={resetAxis}
            className="flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] text-sm font-medium text-white/80 hover:bg-white/[0.08]"
          >
            <RotateCcw className="size-3.5" /> Reset Axis
          </button>
        </aside>
      </div>

      {/* ── Info cards ──────────────────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoCard title="Line Color Rules (Per Time Unit)">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {legend.map((l) => (
              <div key={l.kind} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <span
                    className="h-[3px] w-5 rounded-full"
                    style={{ backgroundColor: EVENT_COLORS[l.kind] }}
                  />
                  {l.kind}
                </div>
                <div className="ml-7 text-[10px] text-white/40">{l.sub}</div>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard title="How It Works">
          <p className="text-xs leading-relaxed text-white/55">
            The line color for each unit ({granularity.toLowerCase()}) is determined by the net
            result of that unit.
            <br />
            <br />
            Only one color per unit. The line changes color at the start of the next unit.
          </p>
        </InfoCard>

        <InfoCard title={`Example (${granularity[0] + granularity.slice(1).toLowerCase()} View)`}>
          <ExampleSparkline />
        </InfoCard>
      </div>

      {/* ── Bottom toolbar ──────────────────────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-1.5">
          <ToolbarBtn title="Zoom in" onClick={() => zoomBy(0.7)}>
            <ZoomIn className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn title="Zoom out" onClick={() => zoomBy(1.4)}>
            <ZoomOut className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn title="Reset zoom" onClick={fit}>
            <Minus className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </ToolbarBtn>
          <button
            onClick={exportPng}
            className="ml-1 flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-white/80 hover:bg-white/[0.07]"
          >
            <Upload className="size-4" /> Export PNG
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            Auto Refresh
          </label>
          <Select value={refreshSecs} onValueChange={setRefreshSecs}>
            <SelectTrigger className="h-9 w-28 border-white/10 bg-white/[0.03] text-white/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60">1 min</SelectItem>
              <SelectItem value="300">5 min</SelectItem>
              <SelectItem value="900">15 min</SelectItem>
              <SelectItem value="1800">30 min</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ── Local presentational helpers ────────────────────────────────────────────

function isoToInput(iso: string): string {
  // 'yyyy-mm-dd' for <input type=date>, from an ISO date string.
  return new Date(iso).toISOString().slice(0, 10);
}

function AxisField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-[11px] text-white/45">{label}</div>
      {children}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  onStep,
}: {
  value: string;
  onChange: (v: string) => void;
  onStep: (dir: 1 | -1) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-white outline-none focus:border-[#EAB308]/50"
      />
      <button
        onClick={() => onStep(-1)}
        className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
      >
        <Minus className="size-3.5" />
      </button>
      <button
        onClick={() => onStep(1)}
        className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
      >
        <span className="text-sm leading-none">+</span>
      </button>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        {title}
      </div>
      {children}
    </div>
  );
}

function ToolbarBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
    >
      {children}
    </button>
  );
}

// Static mini-graphic illustrating segment coloring, built from shared colors.
function ExampleSparkline() {
  const segs: { d: string; kind: EventKind }[] = [
    { d: "M10,22 L40,14", kind: "DEPOSIT" },
    { d: "M40,14 L70,9", kind: "PROFIT" },
    { d: "M70,9 L100,11", kind: "PROFIT" },
    { d: "M100,11 L130,20", kind: "LOSS" },
    { d: "M130,20 L160,17", kind: "DEPOSIT" },
    { d: "M160,17 L190,26", kind: "WITHDRAWAL" },
    { d: "M190,26 L220,12", kind: "PROFIT" },
  ];
  return (
    <svg viewBox="0 0 230 36" className="mt-1 h-8 w-full overflow-visible">
      {segs.map((s, i) => (
        <path
          key={i}
          d={s.d}
          fill="none"
          stroke={EVENT_COLORS[s.kind]}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
