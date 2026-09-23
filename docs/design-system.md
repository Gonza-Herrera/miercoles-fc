# Miércoles FC Design System

PR02 establishes a small, mobile-first visual foundation for Miércoles FC. It is intentionally a starting point rather than a complete component library.

## Principles

- **Clarity over decoration:** information and actions remain easy to scan beside the pitch.
- **Mobile usability first:** fluid layouts, generous whitespace, and practical 44px touch targets.
- **Composition over configuration:** primitives project content and expose only meaningful variants.
- **Semantic tokens over literals:** components consume named roles instead of embedding colors.
- **Accessibility by default:** semantic elements, visible focus, readable contrast, and textual state.

## Tokens

Global CSS custom properties live in `src/styles/_tokens.scss`. Primitive palette values feed semantic roles such as `--color-primary`, `--color-surface`, `--color-success`, and `--color-danger`. Components use semantic roles wherever the meaning matters; palette steps are reserved for tonal relationships.

The same file defines compact scales for typography, spacing, radius, elevation, and layout. CSS custom properties keep component styles framework-native and leave room for future theming without implementing dark mode in PR02.

## Color semantics

| Role                 | Intended use                                 |
| -------------------- | -------------------------------------------- |
| Primary / brand      | Main actions and brand emphasis              |
| Secondary            | Football and team accents                    |
| Social               | Dinner and social accents                    |
| Background / surface | Application canvas and raised content        |
| Success              | Positive, paid, or confirmed states          |
| Warning              | Pending or attention states                  |
| Danger               | Errors and destructive actions only          |
| Neutral              | Text hierarchy, borders, and disabled states |

Color is never the only way an important state is communicated; labels remain visible.

## Typography

The system uses a dependency-free system font stack. Global classes cover display values, page titles, section titles, card titles, body, small body, captions, button labels, and numeric amounts. Amounts use tabular numerals and a robust monospace stack for rapid comparison.

## Spacing, shape, and layout

Spacing follows the `--space-1` through `--space-16` scale. Rounded surfaces use `--radius-sm` through `--radius-full`; only two subtle shadow levels are provided. `--content-max-width` and `--page-inline-padding` create a fluid mobile container that expands naturally on larger screens.

## Component inventory

Reusable standalone components live in `src/app/shared/ui/` and are exported from its single barrel:

- Button: primary, secondary, ghost, and danger variants; three sizes; leading/trailing slots.
- Icon Button: primary, neutral, and ghost variants with a required accessible label.
- Card: default, elevated, and interactive surface treatments.
- Avatar: image or initials fallback with three sizes.
- Badge: neutral and semantic status variants.
- Chip: selected, unselected, and disabled states with `aria-pressed`.
- Divider: semantic horizontal separator.
- Progress Bar: clamped values and complete ARIA progress semantics.
- Empty State: configurable copy plus projected icon and action areas.

The temporary Home route is the visual showcase. It is development scaffolding and will be replaced by the real product experience in a later PR.

### API conventions

- Variant and size inputs are string unions, so invalid options fail during template type checking.
- Boolean inputs such as `disabled`, `fullWidth`, and `selected` accept normal HTML-style boolean attributes.
- Button icons use the optional `button-leading` and `button-trailing` projection slots.
- `IconButton.ariaLabel`, `Avatar.name`, `ProgressBar.label`, and `EmptyState.title` are required inputs.
- `Chip.selectedChange` emits the requested boolean state and leaves state ownership with its consumer.
- `ProgressBar` accepts `value`, `max`, and an optional human-readable `valueText`; numeric values are normalized before rendering.

## Accessibility

- Interactive primitives use native buttons and links.
- Keyboard focus remains visible through a shared focus ring.
- Controls meet a practical minimum 44px touch target.
- Disabled controls remain visually distinct and use native disabled semantics.
- Icon buttons require an accessible label.
- Progress values are clamped and expose minimum, maximum, current, and text values.
- Motion is minimal and progress transitions respect reduced-motion preferences.

Consumers remain responsible for meaningful labels, image alternative text, and correct composition in feature context.
