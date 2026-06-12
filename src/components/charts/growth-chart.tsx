"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  LineType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import type { SnapshotDTO } from "@/types";
import { formatPercent, signClass } from "@/lib/format";
import { ChartShell, type AxisRange } from "./chart-shell";
import { toUtcTs, dedupeSortByTime, downloadCanvas } from "./chart-utils";
import { cn } from "@/lib/utils";

interface Props {
  data: SnapshotDTO[];
}

// Chart 2: white background, black line, portfolio return % over time.
export function GrowthChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(data.length === 0);

  const overall = data.at(-1)?.returnPct ?? 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#374151",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.05)" },
        horzLines: { color: "rgba(0,0,0,0.05)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(0,0,0,0.1)", autoScale: false },
      timeScale: { borderColor: "rgba(0,0,0,0.1)", timeVisible: true },
      handleScroll: true,
      handleScale: true,
      width: el.clientWidth,
      height: el.clientHeight || 360,
    });

    const series = chart.addSeries(LineSeries, {
      color: "#111111",
      lineWidth: 3,
      lineType: LineType.Curved,
      priceLineVisible: false,
      priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(1)}%` },
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
      tip.innerHTML = `<div class="font-medium">${price.value.toFixed(2)}%</div><div class="opacity-60">${d.toLocaleDateString("en-IN")}</div>`;
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

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const points = dedupeSortByTime(
      data.map((s) => ({ time: toUtcTs(s.date), value: s.returnPct })),
    );
    series.setData(points.map((p) => ({ time: p.time as Time, value: p.value })));
    setEmpty(points.length === 0);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  const resetZoom = () => chartRef.current?.timeScale().fitContent();
  const exportPng = () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (canvas) downloadCanvas(canvas, "growth.png");
  };
  const applyAxis = (range: AxisRange) => {
    if (range.min === null && range.max === null) {
      seriesRef.current?.applyOptions({ autoscaleInfoProvider: undefined });
    } else {
      seriesRef.current?.applyOptions({
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: range.min ?? 0, maxValue: range.max ?? 100 },
        }),
      });
    }
  };

  return (
    <ChartShell
      title="Portfolio Percentage Growth"
      onResetZoom={resetZoom}
      onExportPng={exportPng}
      onApplyAxis={applyAxis}
      overlay={
        <div className={cn("text-2xl font-semibold", signClass(overall))}>
          {formatPercent(overall)}
        </div>
      }
    >
      <div className="relative">
        <div ref={containerRef} className="h-[360px] w-full bg-white" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 hidden rounded-md bg-white/90 px-2 py-1 text-xs text-black shadow"
          style={{ display: "none" }}
        />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-black/40">
            No data yet.
          </div>
        )}
      </div>
    </ChartShell>
  );
}
