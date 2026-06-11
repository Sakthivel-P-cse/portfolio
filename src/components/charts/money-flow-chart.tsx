"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  ColorType,
  LineType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import type { SnapshotDTO, SnapshotGranularity, TransactionDTO } from "@/types";
import { formatCurrency, formatSignedCurrency, formatPercent, signClass } from "@/lib/format";
import { ChartShell, type AxisRange } from "./chart-shell";
import { toUtcTs, dedupeSortByTime, downloadCanvas } from "./chart-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GRANS: { label: string; value: SnapshotGranularity }[] = [
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
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const transactionsMapRef = useRef<Map<number, TransactionDTO[]>>(new Map());
  const pointsMetaMapRef = useRef<Map<number, { dailyPnl: number; eventType: string; color: string }>>(new Map());

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
        background: { type: ColorType.Solid, color: "transparent" },
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

    const series = chart.addSeries(AreaSeries, {
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
      const timeNum = param.time as number;
      const d = new Date(timeNum * 1000);
      tip.style.display = "flex";
      tip.style.flexDirection = "column";
      tip.style.gap = "4px";
      tip.style.left = `${param.point.x + 16}px`;
      tip.style.top = `${param.point.y + 16}px`;

      const meta = pointsMetaMapRef.current.get(timeNum);
      
      let pnlHtml = "";
      if (meta) {
        pnlHtml = `<div class="text-[13px]">
          <span class="text-white/60">P&L: </span>
          <span style="color: ${meta.color}" class="font-medium">
            ${formatSignedCurrency(meta.dailyPnl)} (${meta.eventType})
          </span>
        </div>`;
      }

      let content = `
        <div class="text-[12px] text-white/60 mb-1 flex items-center gap-1.5 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-70"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          ${d.toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
        ${pnlHtml}
        <div class="text-[13px]">
          <span class="text-white/60">Equity: </span>
          <span class="text-white font-medium">${formatCurrency(price.value)}</span>
        </div>
      `;
      
      const dayTxs = transactionsMapRef.current.get(timeNum);
      if (dayTxs && dayTxs.length > 0) {
        content += `<div class="mt-1 flex flex-col gap-1 border-t border-white/10 pt-1.5">`;
        for (const t of dayTxs) {
          if (t.type === "DEPOSIT") {
            content += `<div class="text-[#EAB308] font-medium flex items-center gap-1 text-[11px]">
              <span>+</span> ${formatCurrency(t.amount)} Deposit
            </div>`;
          } else if (t.type === "WITHDRAWAL") {
            content += `<div class="text-white font-medium flex items-center gap-1 text-[11px]">
              <span>-</span> ${formatCurrency(t.amount)} Withdrawal
            </div>`;
          }
          if (t.reason && (t.type === "DEPOSIT" || t.type === "WITHDRAWAL")) {
            content += `<div class="text-[10px] text-white/40 ml-3 leading-tight">${t.reason}</div>`;
          }
        }
        content += `</div>`;
      }
      
      tip.innerHTML = content;
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

  // Push data when inputs change.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const tMap = new Map<number, TransactionDTO[]>();
    for (const t of transactions) {
      const time = toUtcTs(t.date) as number;
      const existing = tMap.get(time) || [];
      existing.push(t);
      tMap.set(time, existing);
    }
    transactionsMapRef.current = tMap;

    const metaMap = new Map<number, { dailyPnl: number; eventType: string; color: string }>();

    const rawPoints = dedupeSortByTime(
      data.map((s) => ({ 
        time: toUtcTs(s.date), 
        value: s.portfolioValue,
        netPnl: s.netPnl 
      })),
    );

    const points = rawPoints.map((p, i) => {
      const dayTxs = tMap.get(p.time as number);
      let color = "#22C55E";
      let eventType = "Profit";
      
      let netFlow = 0;
      if (dayTxs && dayTxs.length > 0) {
        for (const t of dayTxs) {
          if (t.type === "DEPOSIT") netFlow += t.amount;
          else if (t.type === "WITHDRAWAL") netFlow -= t.amount;
        }
      }

      const prevNetPnl = i > 0 ? rawPoints[i - 1].netPnl : p.netPnl;
      const dailyPnl = i > 0 ? p.netPnl - prevNetPnl : 0;

      if (netFlow > 0) {
        color = "#EAB308";
        eventType = "Deposit";
      } else if (netFlow < 0) {
        color = "#000000";
        eventType = "Withdrawal";
      } else {
        if (dailyPnl < 0) {
          color = "#EF4444";
          eventType = "Loss";
        } else {
          color = "#22C55E";
          eventType = "Profit";
        }
      }
      
      metaMap.set(p.time as number, { dailyPnl, eventType, color });
      
      return { 
        time: p.time as Time, 
        value: p.value, 
        lineColor: color,
        topColor: color + "33", // 20% opacity for smoother gradient
        bottomColor: color + "00", // 0% opacity
      };
    });

    pointsMetaMapRef.current = metaMap;

    series.setData(points);
    setEmpty(points.length === 0);

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
          },
    );
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
        <div ref={containerRef} className="h-[360px] w-full bg-[#1A1A1A] rounded-lg overflow-hidden border border-white/5" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-20 hidden rounded-lg border border-white/10 bg-[#121212]/95 backdrop-blur-md p-3 text-xs shadow-xl min-w-[160px]"
          style={{ display: "none" }}
        />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
            No data yet — add transactions to see your money flow.
          </div>
        )}
      </div>

      {!empty && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg bg-[#141414] border border-white/5 p-4 flex flex-col justify-center">
            <div className="text-[10px] font-semibold text-white/40 mb-3 tracking-wider uppercase">Line Color Rules (Per Time Unit)</div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <div className="h-0.5 w-4 bg-[#22C55E] rounded-full"></div> PROFIT
                </div>
                <div className="text-white/40 text-[10px] ml-6">Unit's P&amp;L &gt; 0</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <div className="h-0.5 w-4 bg-[#EF4444] rounded-full"></div> LOSS
                </div>
                <div className="text-white/40 text-[10px] ml-6">Unit's P&amp;L &lt; 0</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <div className="h-0.5 w-4 bg-[#EAB308] rounded-full"></div> DEPOSIT
                </div>
                <div className="text-white/40 text-[10px] ml-6">Fund Added</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <div className="h-0.5 w-4 bg-[#000000] border border-white/20 rounded-full"></div> WITHDRAWAL
                </div>
                <div className="text-white/40 text-[10px] ml-6">Fund Withdrawn</div>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg bg-[#141414] border border-white/5 p-4 flex flex-col justify-center">
            <div className="text-[10px] font-semibold text-white/40 mb-3 tracking-wider uppercase">How It Works</div>
            <div className="text-xs text-white/60 leading-relaxed pr-4">
              The line color for each unit (day/week/month/hour) is determined by the net result of that unit.
              <br/><br/>
              Only one color per unit. The line changes color at the start of the next unit.
            </div>
          </div>
          
          <div className="rounded-lg bg-[#141414] border border-white/5 p-4 flex flex-col justify-center">
            <div className="text-[10px] font-semibold text-white/40 mb-3 tracking-wider uppercase">Example (Daily View)</div>
            <svg viewBox="0 0 240 40" className="w-full h-8 overflow-visible mt-2">
              <path d="M10,20 L40,12" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M40,12 L70,18" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M70,18 L100,26" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M100,26 L130,22" fill="none" stroke="#EAB308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M130,22 L160,32" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M160,32 L190,26" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M190,26 L220,12" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}
    </ChartShell>
  );
}
