# UI Design Guidelines

These standards keep Chess Move Tutor readable, focused, and consistent as the interface grows. The product is a learning tool, so visual hierarchy should direct attention to the board, the latest move, and the explanation without making the player decode the interface.

## Visual Direction

Use a calm, focused chess-study atmosphere:

- Favor high contrast, restrained surfaces, and one clear accent color.
- Keep the board as the primary visual object.
- Use color to communicate state and meaning, not as decoration.
- Prefer simple, recognizable controls over ornamental panels.
- Keep the interface compact enough that the board and feedback can be viewed together on a laptop.

## Color

Define colors as reusable CSS variables instead of scattering hex values across selectors. The current visual language uses a deep neutral background, slightly lighter panels, pale text, blue for primary actions, orange for evaluation values, and semantic move-quality colors.

| Role | Guidance |
| --- | --- |
| App background | Deep neutral; it should recede behind the board. |
| Surface/panel | One step lighter than the background; use it to group related feedback. |
| Primary text | Very light neutral with strong contrast. |
| Secondary text | Muted neutral; never use it for essential information by itself. |
| Primary action | Blue with a visible hover and focus state. |
| Evaluation | Orange is reserved for score values and should not be reused for unrelated actions. |
| Good | Green, paired with text such as `good`. |
| Inaccuracy | Yellow, paired with text such as `inaccuracy`. |
| Mistake | Orange, paired with text such as `mistake`. |
| Blunder | Red, paired with text such as `blunder`. |

Do not communicate move quality through color alone. Every quality color must appear alongside a text label, and important status messages must remain understandable in grayscale.

Check contrast for normal text, button labels, badges, focus indicators, and board-coordinate text. Aim for WCAG AA contrast: at least 4.5:1 for normal text and 3:1 for large text and meaningful graphical elements.

## Typography

- Use a readable sans-serif for controls, labels, and explanations.
- Use a clear size hierarchy: page title, panel title, section heading, body text, and muted helper text.
- Keep paragraph line length comfortable, approximately 45-75 characters where possible.
- Use tabular numerals for scores so values do not jump horizontally.
- Avoid all-caps for long content. Small uppercase section headings are acceptable when they remain legible.
- Never rely on font weight alone to distinguish an error from normal feedback; use a label and appropriate structure.

## Layout and Spacing

- Use a consistent spacing scale, preferably multiples of 4 or 8 pixels.
- Keep the board centered or clearly dominant on large screens.
- Keep feedback adjacent to the board on desktop and below it on narrow screens.
- Preserve stable board dimensions so a move, loading message, or long explanation cannot resize the board or shift nearby controls.
- Prevent horizontal scrolling at mobile widths.
- Leave enough space between the board, reset control, feedback sections, and viewport edges for comfortable touch use.
- Do not place one card-like container inside another unless the inner element is a genuinely separate control such as a dialog or repeated result.

## Shapes and Borders

- Keep the current restrained shape language: modest corner radii, generally no more than 8-12 pixels.
- Use borders to separate surfaces and sections, not to outline every piece of information.
- Use one consistent border color with enough contrast against its surface.
- Avoid excessive pills. Reserve pill-shaped badges for compact status labels such as move quality.
- Keep buttons large enough to operate comfortably, with a target of at least 44 by 44 pixels for touch controls.
- Use shadows sparingly. A shadow should establish board or panel layering, not add visual noise.

## Interaction States

Every interactive control needs visible default, hover, active, focus-visible, disabled, loading, and error states where applicable.

- Illegal piece drops must leave the board unchanged and should not trigger a misleading success message.
- Legal moves should update the board immediately, highlight the last move, and show a loading state in the feedback area.
- Do not leave stale feedback visible while it describes a newer board position.
- Backend failures should be visible as an actionable error, not silently treated as move feedback.
- Reset must restore the initial position, remove the move highlight, and clear feedback.
- Focus indicators must remain visible against both the page background and panel surfaces.
- Avoid motion that is necessary to understand the result. Respect `prefers-reduced-motion` for nonessential transitions.

## Chessboard Interaction

- Maintain clear distinction between light squares, dark squares, and last-move highlights.
- Do not use a highlight color that makes a piece or coordinate unreadable.
- Keep the board orientation and coordinate behavior consistent unless an explicit orientation control is introduced.
- If promotion choice is added, present a clearly labeled, keyboard-accessible choice rather than silently selecting a piece.
- If keyboard alternatives to drag and drop are introduced, make the focused square and selected piece obvious.

## Responsive and Accessible UI

- Test at narrow mobile widths, tablet widths, and desktop widths.
- Make text wrap inside its parent instead of clipping or overlapping neighboring content.
- Use semantic headings in order and meaningful button labels.
- Provide status text for loading and errors that can be announced by assistive technology.
- Do not depend on hover to reveal essential information.
- Keep hit areas and contrast usable on touch devices and in bright conditions.
- Verify keyboard focus order after adding controls or dialogs.

## Review Checklist

Before merging a UI change, confirm:

- Colors still communicate meaning with text labels and pass contrast review.
- No text, badge, button, or panel overlaps at supported widths.
- Borders, radii, and shadows follow the existing visual language.
- Loading, error, empty, hover, active, and focus states are intentional.
- The board remains the visual priority.
- The change has been checked in a browser, not only through a component test.
