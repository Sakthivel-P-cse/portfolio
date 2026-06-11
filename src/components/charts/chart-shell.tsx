"use client";

import { useState, type ReactNode } from "react";
import { Maximize2, Minimize2, Download, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AxisRange {
  min: number | null;
  max: number | null;
}

interface ChartShellProps {
  title: string;
  overlay?: ReactNode;
  controls?: ReactNode; // e.g. granularity tabs
  onResetZoom?: () => void;
  onExportPng?: () => void;
  onApplyAxis?: (range: AxisRange) => void;
  className?: string;
  children: ReactNode;
}

// Reusable frame around a TradingView chart: title, overlay slot, and a toolbar
// (fullscreen, export PNG, reset zoom, manual Y-axis min/max). Shared by all 3 charts.
export function ChartShell({
  title,
  overlay,
  controls,
  onResetZoom,
  onExportPng,
  onApplyAxis,
  className,
  children,
}: ChartShellProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-border/60 transition-shadow",
        fullscreen && "fixed inset-3 z-50 m-0 flex flex-col shadow-2xl",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="flex items-center gap-1">
          {controls}
          {onApplyAxis && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" title="Axis controls">
                  <SlidersHorizontal className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 space-y-3" align="end">
                <p className="text-xs font-medium text-muted-foreground">
                  Y-axis range (leave blank to auto-scale)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Min</Label>
                    <Input
                      type="number"
                      value={min}
                      onChange={(e) => setMin(e.target.value)}
                      placeholder="auto"
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max</Label>
                    <Input
                      type="number"
                      value={max}
                      onChange={(e) => setMax(e.target.value)}
                      placeholder="auto"
                      className="h-8"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    onApplyAxis({
                      min: min === "" ? null : Number(min),
                      max: max === "" ? null : Number(max),
                    })
                  }
                >
                  Apply
                </Button>
              </PopoverContent>
            </Popover>
          )}
          {onResetZoom && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onResetZoom}
              title="Reset zoom"
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
          {onExportPng && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onExportPng}
              title="Export PNG"
            >
              <Download className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn("relative p-0", fullscreen && "flex-1")}>
        {overlay && (
          <div className="pointer-events-none absolute right-4 top-2 z-10 text-right">
            {overlay}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
