---
name: shadcn-usage
description: Design, implement, or review the Market Inspector React/Next dashboard using shadcn/ui, Tailwind CSS, responsive layouts, loading/error/empty states, accessibility, visual hierarchy, product copy, and DESIGN.md alignment. Use for components, app pages, global styles, UI tests, screenshots, and design documentation.
---

# shadcn Usage

Use this skill for dashboard UI and design-system work.

## Design contract

Read `DESIGN.md` before changing interface behavior, visual hierarchy, product language, or layout. Keep UI decisions aligned with the existing shadcn/Tailwind style instead of inventing a parallel component system.

The dashboard should feel like a professional market-monitoring console:

- clear status and source labels;
- compact cards and tables;
- readable charts;
- calm alert language;
- honest loading, empty, stale, and error states;
- responsive behavior across mobile, tablet, laptop, and desktop.

## Components

Use existing shadcn primitives and local UI components before adding new abstractions. Keep Client Components focused on interaction and rendering; keep provider and credential logic on the server.

Do not reintroduce removed portfolio UI unless the specification changes.

## Copy and tone

Use user-facing language that is professional and product-like. Avoid comments or UI copy that sound like an agent speaking privately to the developer.

Generated analysis must remain informational. Use labels such as "AI brief", "notable movement", "source", "last updated", and "demo quota" honestly.

## States and accessibility

For any new UI surface, define:

- loading state;
- empty state;
- error or partial-failure state;
- keyboard and screen-reader behavior where interactive;
- responsive layout behavior.

Use Playwright coverage for meaningful viewport or interaction changes.
