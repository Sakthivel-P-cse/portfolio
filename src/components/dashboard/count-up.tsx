"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

interface CountUpProps {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
}

// Tweens a number and formats each frame without re-rendering React.
export function CountUp({ value, format, durationMs = 700 }: CountUpProps) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (latest) => format(latest));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: durationMs / 1000,
      ease: "easeOut",
    });
    return controls.stop;
  }, [value, durationMs, mv]);

  return <motion.span>{text}</motion.span>;
}
