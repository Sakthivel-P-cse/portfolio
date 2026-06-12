"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { TransactionDTO } from "@/types";
import { cn } from "@/lib/utils";
import * as Tooltip from "@radix-ui/react-tooltip";
import confetti from "canvas-confetti";
import { Trophy, CheckCircle2 } from "lucide-react";

interface GoalProgressWidgetProps {
  transactions: TransactionDTO[];
  currentEquity: number;
  targetEquity?: number;
}

const EVENT_COLORS: Record<string, string> = {
  PROFIT: "#22C55E", // Green
  LOSS: "#EF4444", // Red
  DEPOSIT: "#F5B82E", // Yellow/Gold
  WITHDRAWAL: "#3F3F46", // Dark Gray
};

export function GoalProgressWidget({
  transactions,
  currentEquity,
  targetEquity = 200000,
}: GoalProgressWidgetProps) {
  const [hasReachedGoal, setHasReachedGoal] = useState(false);

  const progressPct = Math.min(100, Math.max(0, (currentEquity / targetEquity) * 100));
  const remaining = Math.max(0, targetEquity - currentEquity);
  const isGoalReached = currentEquity >= targetEquity;

  useEffect(() => {
    if (isGoalReached && !hasReachedGoal) {
      setHasReachedGoal(true);
      triggerConfetti();
    } else if (!isGoalReached && hasReachedGoal) {
      setHasReachedGoal(false);
    }
  }, [isGoalReached, hasReachedGoal]);

  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#22C55E", "#F5B82E", "#ffffff"],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#22C55E", "#F5B82E", "#ffffff"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  // Build the "journey" segments
  // To keep it legible, we might only want to show the last 100 events
  // But we need the total absolute sum to calculate flex basis
  const segments = useMemo(() => {
    // Sort transactions by date ascending
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Limit to last 150 transactions for performance and UI legibility
    const maxVisible = 150;
    const visibleTxns = sorted.slice(-maxVisible);
    
    // If there were earlier transactions, we could group them into a "Base" segment,
    // but the prompt implies showing the sequence. We'll just show the visible ones
    // taking up the entire progress bar space. This is a visual representation, not a strict math chart.
    
    let runningProgress = 0;
    const items = visibleTxns.map((t) => {
      const type = t.type;
      const amount = Number(t.amount);
      const absAmount = Math.abs(amount);
      
      const pBefore = runningProgress;
      // We simulate the progress visually. This doesn't strictly match the real equity at that point
      // if we clipped the history, but it's good enough for the tooltip.
      const contribution = type === "LOSS" || type === "WITHDRAWAL" ? -absAmount : absAmount;
      runningProgress += contribution;
      const pAfter = runningProgress;

      return {
        id: t.id,
        type,
        amount: absAmount,
        contribution,
        date: new Date(t.date),
        color: EVENT_COLORS[type] || "#ffffff",
        pBefore,
        pAfter,
      };
    });

    const totalAbs = items.reduce((sum, item) => sum + item.amount, 0);

    return items.map(item => ({
      ...item,
      // Flex basis based on absolute amount relative to total absolute amount
      flexBasis: totalAbs > 0 ? (item.amount / totalAbs) * 100 : 0
    }));
  }, [transactions]);

  const milestones = [25, 50, 75, 100];

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/80 p-5 shadow-2xl backdrop-blur-xl">
      {/* Header Info */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-widest text-white/60 uppercase">
              Goal Progress
            </h3>
            {isGoalReached && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400"
              >
                <Trophy className="size-3" />
                REACHED
              </motion.div>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {formatCurrency(currentEquity)}
            </span>
            <span className="text-sm font-medium text-white/40">
              / {formatCurrency(targetEquity)}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            {formatPercent(progressPct, 1)}
          </div>
          {!isGoalReached && (
            <div className="text-[11px] font-medium text-white/40">
              {formatCurrency(remaining)} Remaining
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar Container */}
      <Tooltip.Provider delayDuration={100}>
        <div className="relative mt-2 h-6 w-full rounded-full bg-white/[0.03] p-1 shadow-inner ring-1 ring-white/[0.05]">
          {/* Milestones */}
          <div className="absolute inset-0 px-1">
            {milestones.map((m) => {
              const crossed = progressPct >= m;
              return (
                <div
                  key={m}
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
                  style={{ left: `${m}%` }}
                >
                  <div
                    className={cn(
                      "h-full w-[1px] transition-all duration-500",
                      crossed ? "bg-emerald-500/50 shadow-[0_0_8px_1px_rgba(16,185,129,0.5)]" : "bg-white/10"
                    )}
                  />
                  <div 
                    className={cn(
                      "absolute -top-5 text-[9px] font-bold transition-colors duration-500",
                      crossed ? "text-emerald-400" : "text-white/30"
                    )}
                  >
                    {m}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filled Bar */}
          <motion.div
            className={cn(
              "relative flex h-full overflow-hidden rounded-full shadow-lg",
              isGoalReached ? "shadow-[0_0_20px_rgba(34,197,94,0.3)]" : ""
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 15 }}
          >
            {/* Segments wrapper */}
            <div className="flex h-full w-full min-w-full">
              <AnimatePresence>
                {segments.map((seg, i) => (
                  <Tooltip.Root key={seg.id}>
                    <Tooltip.Trigger asChild>
                      <motion.div
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        exit={{ opacity: 0, scaleX: 0 }}
                        style={{
                          flexBasis: `${seg.flexBasis}%`,
                          backgroundColor: seg.color,
                        }}
                        className="h-full min-w-[2px] transition-all hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-white/50"
                      />
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="z-50 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 rounded-xl border border-white/10 bg-[#121212]/95 px-4 py-3 shadow-2xl backdrop-blur-md"
                        sideOffset={10}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-4">
                            <span
                              className="text-xs font-bold uppercase tracking-wider"
                              style={{ color: seg.color }}
                            >
                              {seg.type}
                            </span>
                            <span className="text-[10px] text-white/40">
                              {seg.date.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="text-lg font-bold text-white">
                            {seg.contribution > 0 ? "+" : "-"}
                            {formatCurrency(seg.amount)}
                          </div>
                          {/* Not showing running progress because the local simulation might be confusing vs overall progress */}
                        </div>
                        <Tooltip.Arrow className="fill-white/10" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                ))}
              </AnimatePresence>
            </div>
            
            {/* Optional Success Glow Overlay */}
            {isGoalReached && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              />
            )}
          </motion.div>
        </div>
      </Tooltip.Provider>
    </div>
  );
}
