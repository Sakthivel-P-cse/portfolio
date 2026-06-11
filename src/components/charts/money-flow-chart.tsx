"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  LineType,
  CrosshairMode,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import type { SnapshotDTO, SnapshotGranularity, TransactionDTO } from "@/types";
import { formatCurrency, formatSignedCurrency, formatPercent, signClass } from "@/lib/format";
import { ChartShell, type AxisRange } from "./chart-shell";
import { toUtcTs, dedupeSortByTime, downloadCanvas } from "./chart-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GOLD = "#F5B82E";
const GRANS: { label: string; value: SnapshotGranularity }[] = [
  // "Hour" maps to DAY because snapshots are bucketed daily at the finest level.
  { label: "Day", value: "DAY" },
  { label: "Week", value: "WEEK" },
  { label: "Month", value: "MONTH" },
];

interface Props {
  data: SnapshotDTO[];
  transactions: TransactionDTO[];
  granularity: SnapshotGranularity;
  onGranularityChange: (g: SnapshotGranularity) => void;
}

export function MoneyFlowChart({
  data,
  transactions,
  granularity,
  onGranularityChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const last = data.at(-1);
  const currentValue = last?.portfolioValue ?? 0;
  const netPnl = last?.netPnl ?? 0;
  const returnPct = last?.returnPct ?? 0;

  const [empty, setEmpty] = useState(data.length === 0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#1A1A1A" },
        textColor: "#9CA3AF",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true },
      handleScroll: true,
      handleScale: true,
      autoSize: false,
      width: el.clientWidth,
      height: el.clientHeight || 360,
    });

    const series = chart.addSeries(LineSeries, {
      color: GOLD,
      lineWidth: 3,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Hover tooltip
    const onMove = (param: MouseEventParams) => {
      const tip = tooltipRef.current;
      if (!tip) return;
      if (!param.time || !param.point) {
        tip.style.display = "none";
        return;
      }
      const price = param.seriesData.get(series) as { value: number } | undefined;
      if (!price) {
        tip.style.display = "none";
        return;
      }
      const d = new Date((param.time as number) * 1000);
      tip.style.display = "block";
      tip.style.left = `${param.point.x + 12}px`;
      tip.style.top = `${param.point.y + 12}px`;
      tip.innerHTML = `<div class="font-medium">${formatCurrency(price.value)}</div><div class="opacity-60">${d.toLocaleDateString("en-IN")}</div>`;
    };
    chart.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight || 360 });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push data + markers when inputs change.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const points = dedupeSortByTime(
      data.map((s) => ({ time: toUtcTs(s.date), value: s.portfolioValue })),
    );
    series.setData(points.map((p) => ({ time: p.time as Time, value: p.value })));
    setEmpty(points.length === 0);

    // Markers from transactions (deposits/withdrawals + large profit/loss).
    const amounts = transactions.map((t) => t.amount);
    const big = amounts.length
      ? amounts.slice().sort((a, b) => b - a)[Math.floor(amounts.length * 0.1)] ?? 0
      : 0;

    const markers: SeriesMarker<Time>[] = dedupeSortByTime(
      transactions.map((t) => ({ time: toUtcTs(t.date), t })),
    ).map(({ time, t }) => {
      if (t.type === "DEPOSIT")
        return { time: time as Time, position: "belowBar", color: "#22c55e", shape: "arrowUp", text: "D" } as SeriesMarker<Time>;
      if (t.type === "WITHDRAWAL")
        return { time: time as Time, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "W" } as SeriesMarker<Time>;
      if (t.type === "PROFIT")
        return { time: time as Time, position: "belowBar", color: "#22c55e", shape: "circle", text: t.amount >= big ? "★" : "" } as SeriesMarker<Time>;
      return { time: time as Time, position: "aboveBar", color: "#ef4444", shape: "circle", text: t.amount >= big ? "✕" : "" } as SeriesMarker<Time>;
    });

    createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();
  }, [data, transactions]);

  const resetZoom = () => chartRef.current?.timeScale().fitContent();
  const exportPng = () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (canvas) downloadCanvas(canvas, "money-flow.png");
  };
  const applyAxis = (range: AxisRange) => {
    seriesRef.current?.priceScale().applyOptions(
      range.min === null && range.max === null
        ? { autoScale: true }
        : {
            autoScale: false,
            // lightweight-charts uses scaleMargins; for hard limits we use setVisibleRange via autoscaleInfoProvider-free approach:
          },
    );
    // Apply hard range through the price scale's autoscale provider workaround:
    if (range.min !== null || range.max !== null) {
      seriesRef.current?.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: {
            minValue: range.min ?? 0,
            maxValue: range.max ?? currentValue * 1.2,
          },
        }),
      });
    } else {
      seriesRef.current?.applyOptions({ autoscaleInfoProvider: undefined });
    }
  };

  return (
    <ChartShell
      title="Trade Journal · Portfolio Money Flow"
      onResetZoom={resetZoom}
      onExportPng={exportPng}
      onApplyAxis={applyAxis}
      overlay={
        <div>
          <div className="text-2xl font-semibold text-white">
            {formatCurrency(currentValue)}
          </div>
          <div className={cn("text-sm font-medium", signClass(netPnl))}>
            {formatSignedCurrency(netPnl)} ({formatPercent(returnPct)})
          </div>
        </div>
      }
      controls={
        <div className="mr-1 flex items-center rounded-lg bg-muted p-0.5">
          {GRANS.map((g) => (
            <Button
              key={g.value}
              variant="ghost"
              size="sm"
              onClick={() => onGranularityChange(g.value)}
              className={cn(
                "h-7 px-2 text-xs",
                granularity === g.value && "bg-background shadow-sm",
              )}
            >
              {g.label}
            </Button>
          ))}
        </div>
      }
    >
      <div className="relative">
        <div ref={containerRef} className="h-[360px] w-full bg-[#1A1A1A]" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 hidden rounded-md bg-black/80 px-2 py-1 text-xs text-white"
          style={{ display: "none" }}
        />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
            No data yet — add transactions to see your money flow.
          </div>
        )}
      </div>
    </ChartShell>
  );
}
