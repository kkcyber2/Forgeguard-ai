"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Reveal / Stagger
 * ----------------
 * Framer Motion's `whileInView` with a reduced-motion guard. These are
 * the only motion primitives the app should use for entrance — no
 * bespoke `useEffect` timers or GSAP wrappers.
 */

const ease = [0.2, 0.7, 0.2, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 12,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "span" | "li";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[Tag] as typeof motion.div;
  return (
    <Comp
      initial={reduce ? undefined : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.55, ease, delay }}
      className={cn(className)}
    >
      {children}
    </Comp>
  );
}

export function StaggerGroup({
  children,
  className,
  step = 0.06,
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? undefined : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-10%" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step } },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const Comp = motion[Tag] as typeof motion.div;
  return (
    <Comp
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
      }}
      className={cn(className)}
    >
      {children}
    </Comp>
  );
}
