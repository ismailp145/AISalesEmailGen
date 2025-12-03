# Design Guidelines for Basho Studio

## Design Philosophy
**Premium AI SaaS Aesthetic** - Inspired by Linear, Vercel, and Notion
- Sophisticated monochrome palette with subtle graphite tones
- Minimal visual noise, maximum information clarity
- Refined typography with tight letter-spacing
- Subtle depth through shadows and layered surfaces
- Professional, enterprise-grade visual language

## Color Palette

### Primary Colors
- **Background**: `#000000` (pure black)
- **Foreground**: Off-white with warm ivory undertone for comfortable reading
- **Cards/Surfaces**: Dark graphite (`hsl(220, 6%, 6%)`) with subtle blue undertone

### Neutral Grays (Graphite Scale)
- **Border**: `hsl(220, 5%, 15%)` - Subtle separation
- **Muted**: `hsl(220, 4%, 14%)` - Background surfaces
- **Muted Foreground**: `hsl(220, 5%, 50%)` - Secondary text

### Interactive States
- **Primary**: Off-white/porcelain (`hsl(0, 0%, 90%)`) - CTAs and key actions
- **Secondary**: Dark graphite (`hsl(220, 5%, 11%)`) - Secondary buttons
- **Accent**: Lighter graphite (`hsl(220, 4%, 12%)`) - Hover states

### Status Colors (Monochrome-Based)
- **Draft**: Muted gray background with muted text
- **Active**: Primary/10 background with primary text and subtle border
- **Paused**: Muted gray, slightly transparent
- **Archived**: Muted gray with reduced opacity
- **Error/Destructive**: Red (`hsl(0, 72%, 51%)`) - Only color accent

## Typography System

### Font Family
- **Primary**: Inter, -apple-system, BlinkMacSystemFont
- **Monospace**: SF Mono, Menlo

### Typography Scale
- **H1**: 28-32px, semibold (600), letter-spacing: -0.02em
- **H2**: 22-24px, semibold (600), letter-spacing: -0.02em
- **H3**: 18-20px, semibold (600), letter-spacing: -0.02em
- **Body**: 14-16px, regular (400), letter-spacing: -0.01em
- **Small/Labels**: 12-13px, medium (500), letter-spacing: -0.01em

### Reading Comfort
- Line height: 1.5-1.6 for body text
- Maximum content width for readability
- Consistent vertical rhythm

## Spacing System

### Scale
- **xs**: 8px
- **sm**: 12px
- **md**: 16px
- **lg**: 20px
- **xl**: 24px
- **2xl**: 32px

### Application
- Card padding: 16-20px (md-lg)
- Section gaps: 24-32px (xl-2xl)
- Form field spacing: 16px (md)
- Button internal padding: 12-16px horizontal

## Component Styling

### Buttons
- **Primary**: Off-white/porcelain background, dark text
  - Subtle border matching background
  - Hover: Slight elevation effect
- **Secondary**: Dark graphite background, light text
  - Subtle border
  - Hover: Brightness increase
- **Ghost**: Transparent, light text
  - Hover: Subtle background fill
- **Destructive**: Red background, white text
- **Border radius**: 0.5rem (premium pill-ish feel)
- **No manual hover colors** - Use built-in elevate system

### Cards
- Background: `bg-card` (dark graphite)
- Border: 1px `border-card-border`
- Shadow: `shadow-md` for depth
- Border radius: 0.5rem
- Padding: 16-20px
- No nested cards

### Badges/Status Pills
- Monochrome variants based on status
- Small size for information density
- Subtle borders for definition
- Status-specific styling via utility classes

### Input Fields
- Background: `bg-input` (slightly lighter than card)
- Border: 1px `border`
- Focus: Ring with `ring` token
- Placeholder: `text-muted-foreground`
- Transition: 200ms smooth

### Sidebar
- Background: Near-black (`hsl(0, 0%, 2%)`)
- Border: Subtle graphite line
- Active item: Porcelain background, dark text
- Inactive hover: Accent background
- Width: 280-320px (customizable via CSS vars)

### Dialogs/Modals
- Background: `bg-card` with shadow
- Overlay: Semi-transparent black
- Border radius: 0.5rem
- Max-height with scroll for content

## Layout Patterns

### Page Structure
- Fixed sidebar with collapsible option
- Sticky header with actions
- Main content with max-width constraints
- Consistent padding throughout

### Grid System
- 12-column conceptual grid
- Responsive breakpoints
- Gap spacing: 16-24px

### Information Density
- Dense layouts for productivity tools
- Clear visual hierarchy
- Scannable content organization

## Interaction Design

### Hover States
- Use built-in `hover-elevate` utility
- Subtle brightness increase
- No color shifts on hover
- Consistent timing (150-200ms)

### Active States
- Use built-in `active-elevate-2` utility
- Slightly more pronounced than hover
- Immediate feedback

### Focus States
- Ring with `ring` token color
- Clear visibility for accessibility
- Consistent across all inputs

### Transitions
- Duration: 150-200ms
- Easing: ease-out or ease-in-out
- Properties: background, opacity, transform

## Visual Refinements

### Shadows
- Subtle, realistic shadows for depth
- Darker in dark mode for visibility
- Layer surfaces with shadow hierarchy

### Borders
- Hairline (1px) for subtle separation
- Consistent color from token
- Never partial borders on rounded elements

### Scrollbars
- Custom styled, thin (8px)
- Muted colors
- Hover state for visibility

## Accessibility

### Contrast
- Minimum 4.5:1 for body text
- 3:1 for large text and UI elements
- Test with contrast checker

### Focus Indicators
- Visible ring on all interactive elements
- High contrast against background
- Never remove outline without replacement

### Motion
- Respect reduced motion preferences
- Keep animations subtle and purposeful

## Brand Expression

### Visual Tone
- Professional and sophisticated
- Minimal and focused
- Premium and trustworthy
- Enterprise-ready

### Consistency
- Same interaction patterns throughout
- Unified color application
- Predictable component behavior

### Avoid
- Bright accent colors (cyan, green highlights)
- Heavy gradients or patterns
- Excessive shadows or depth
- Decorative elements without purpose
