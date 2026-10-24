"use client";

import type { Transition, Variants } from "motion/react";
export { motion, AnimatePresence, useReducedMotion } from "motion/react";

/**
 * Focus Duo Apple-Inspired Motion System
 *
 * Core Principles (from Apple Design & docs/DESIGN.md):
 * 1. Restraint: Motion reinforces understanding, state changes and direct manipulation.
 * 2. Critical Damping: Default springs have damping = 1.0 (no cartoon overshoot or wobble).
 * 3. Short Durations: 160–280ms range keeps interactions interruptible without blocking input.
 * 4. Micro-displacements: 4–8px subtle movements; no full-page wild slides.
 * 5. Full Reduced-Motion Respect: Instantaneous cross-fade or static states when preferred.
 */

// Critically damped spring for active pill indicators (segmented tabs, nav)
export const activePillSpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 34,
  mass: 0.8,
};

// Subtle decelerate curve for cards and modal elements
export const subtleEaseTransition: Transition = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1],
};

// Fast ease for tooltips, micro-indicators and badges
export const fastEaseTransition: Transition = {
  duration: 0.16,
  ease: [0.16, 1, 0.3, 1],
};

// Small 6px vertical fade-in for status labels and badges
export const statusPillVariants: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] } },
};

// Task row insertion and removal with height collapse
export const taskRowVariants: Variants = {
  initial: { opacity: 0, y: 6, scale: 0.99 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: "hidden",
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
  },
};

// Subtle fade-scale for dialogs, modals, and confirmations
export const dialogMotionVariants: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 4 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 2,
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
  },
};

// Form field accordion expand / collapse (e.g. inviteCode in signup)
export const accordionVariants: Variants = {
  initial: { opacity: 0, height: 0, overflow: "hidden" },
  animate: {
    opacity: 1,
    height: "auto",
    overflow: "visible",
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    height: 0,
    overflow: "hidden",
    transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
  },
};
