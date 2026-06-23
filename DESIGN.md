# Market Inspector design contract

This document is the visual and interaction source of truth for people and coding agents working on the frontend. It describes the design already present in the product and the constraints future changes should preserve.

## Product character

Market Inspector should feel like a calm, credible market-monitoring console rather than a trading terminal or consumer investment app. The interface is information-dense but not noisy: clear hierarchy, restrained color, compact metadata, and explicit system state.

The product voice is concise, factual, and neutral. It may explain uncertainty and limitations. It must not sound like an agent instructing its owner what to trade.

## Visual language

- Foundation: shadcn/ui base components, Tailwind CSS v4, and Lucide icons.
- Typography: Geist Sans for interface text and Geist Mono for prices, symbols, timestamps, tools, and machine-oriented metadata.
- Shape: medium rounded corners, thin low-contrast borders, and very limited shadow.
- Background: cool neutral slate with subtle blue ambient light and a faint grid on the landing page.
- Primary accent: blue for navigation, active controls, Gemini context, and links.
- Semantic accents:
  - green for healthy/live/positive state
  - amber for caution, quota, and medium severity
  - orange/red for high severity and failures
  - purple only as a secondary analytical accent
- Color must reinforce meaning; never rely on color alone.

The exact theme tokens live in `app/globals.css`. Components should use semantic tokens such as `bg-background`, `text-muted-foreground`, `border-border`, and `text-primary` instead of introducing unrelated literal colors.

## Information hierarchy

1. Current market state and connection status.
2. Main asset metrics and anomalies.
3. Manual AI analysis and its execution state.
4. Supporting forex information.
5. Architecture and implementation explanation.

The dashboard uses two top-level views: `Market Dashboard` and `Agents & MCP`. Portfolio navigation is intentionally absent and must not be reintroduced unless the product specification changes.

## Layout

- Use the existing centered `max-w-7xl` container.
- Mobile layouts stack into one column; dense rows may wrap but should not require horizontal page scrolling.
- Section spacing is generous enough to separate concerns, while cards use compact internal spacing.
- Sticky elements are limited to the dashboard header and market ticker.
- Avoid modal workflows for core information; status and errors should remain in context.

## Component patterns

- Cards group one conceptual unit and use subtle borders rather than decorative elevation.
- Badges communicate live state, severity, source, model, quota, and counts.
- Tables and chart labels use monospaced numbers where comparison matters.
- Buttons use direct verbs such as `Run AI Scan` and expose disabled/quota states.
- Loading uses skeletons for content and spinners only for active operations.
- Errors use the shared Alert component and plain language.
- Tool activity is shown as an audit trail, not as conversational role-play.

## AI brief presentation

- Title: `AI Market Brief`.
- Required sections: headline, analysis, 24–48h outlook, monitoring priorities, and tool activity.
- Never label generated content as `Recommended Actions`.
- Monitoring priorities describe evidence, levels, confirmation, reversal, volatility, or liquidity without buy/sell/hold commands.
- Always show: `Informational analysis only — not personalized financial advice.`
- A Gemini response with zero extra tool calls is still a Gemini brief; only `model: "stub"` is labeled auto-detected.

## Quota and cost communication

- Explain that automatic anomaly scans use no Gemini calls.
- Display the manual local quota near the scan control.
- Describe requests as a range because function-calling rounds vary.
- The current demo ceiling is four scans and up to five calls per scan.
- Never imply that `localStorage` is secure billing enforcement.

## Motion and feedback

- Motion is functional: live pulse, spinner, subtle hover, ticker movement, and streamed progress.
- Avoid ornamental animation that competes with market changes.
- Every long-running action needs immediate feedback and a final success or error state.
- Respect platform reduced-motion behavior where animations are introduced.

## Accessibility

- Maintain keyboard access and visible focus states from the shared component system.
- Use semantic headings in order and accessible labels for icon-only controls.
- Status changes should have text and, where appropriate, `role="status"`.
- Charts require surrounding textual values; color-only interpretation is insufficient.
- Text contrast must remain readable in both light and dark themes.

## Responsive acceptance checks

Review changes at approximately 375 px, 768 px, 1024 px, and 1440 px widths. Confirm:

- no horizontal page overflow
- scan controls remain understandable
- prices and symbols do not collide
- tabs retain usable labels
- cards preserve hierarchy
- disclaimer and error states remain visible

## Agent workflow for design changes

Before editing UI code, an agent should read this file, the relevant component, and the theme tokens. It should reuse existing UI primitives and patterns, preserve terminology, and avoid broad visual rewrites unless explicitly requested.

After a visual change, the agent should:

1. Check the affected responsive states.
2. Verify loading, empty, success, quota, and error states.
3. Run lint, type checking, tests, E2E, and build as appropriate.
4. Update this file if a new reusable visual rule or pattern was introduced.

The design contract and product specification should evolve together; neither should describe a UI that the repository no longer implements.
