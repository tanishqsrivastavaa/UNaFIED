/*
 * One motion vocabulary for the whole app. Enters ease out over 280ms, exits are quicker,
 * page-level moves take 350ms. Only transform and opacity move. MotionConfig
 * reducedMotion="user" (App.tsx) drops the transforms and keeps the fades.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DUR = { micro: 0.15, exit: 0.2, enter: 0.28, page: 0.35 } as const;

/** Stagger for lists: quick, and capped so a long list never makes anyone wait. */
export const stagger = (i: number) => Math.min(i, 8) * 0.03;

/** Popovers grow from the control that opened them. */
export const pop = {
    initial: { opacity: 0, scale: 0.97, y: -4 },
    animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15, ease: EASE } },
};

/** Small things arriving in place: errors, notes, inline forms. */
export const rise = {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0, transition: { duration: DUR.enter, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.15, ease: EASE } },
};
