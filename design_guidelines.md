# Design Guidelines for Basho Studio

## Design Approach
**System-Based with Custom SaaS Aesthetics**
- Modern B2B SaaS dashboard with dark theme
- Utility-focused productivity tool with high information density
- Clean, professional interface prioritizing workflow efficiency

## Color Palette
- **Background**: `#000000` (pure black or near-black)
- **Foreground Text**: `#FFFFFF` (white)
- **Accent Color**: `#00D1FF` (cyan) - single highlight color for CTAs, links, and status indicators
- **High Contrast Philosophy**: Strong contrast for readability without harshness

## Typography System
- Modern sans-serif system fonts for optimal legibility
- **Hierarchy**:
  - Headings: Bold weights (600-700) for section headers
  - Body: Regular weight (400) for content
  - UI Elements: Medium weight (500) for buttons and labels
- Generous line-height for dashboard readability (1.6-1.8 for body text)

## Layout & Spacing
**Core Layout Structure**:
- Left sidebar navigation (fixed width ~240px)
- Top bar (height ~64px) with environment badge and user avatar
- Main content area with max-width constraints for forms (max-w-4xl)
- Tailwind spacing units: Primarily `p-4`, `p-6`, `p-8`, `m-4`, `gap-4`, `gap-6`

**Whitespace Strategy**:
- Generous padding within cards and containers
- Clear visual separation between sections
- Breathing room around interactive elements

## Component Library

**Navigation Sidebar**:
- App logo/name: "Basho Studio" at top
- Navigation items: "Single Email", "Bulk Campaigns", "Settings"
- Dark background with subtle hover states

**Top Bar**:
- Environment indicator badge ("Sandbox" chip)
- User avatar placeholder (right-aligned)

**Cards & Containers**:
- Rounded corners (`rounded-lg` or `rounded-xl`)
- Soft drop shadows for depth
- Dark card backgrounds with subtle border treatment

**File Upload Zone**:
- Drag-and-drop area with dashed border
- Progress indicators for upload status
- Helper text for required CSV headers

**Data Table**:
- Columns: Name, Title, Company, Email, LinkedIn URL, Status, Preview
- Chip-style status badges with color coding:
  - Pending: Neutral gray
  - Generating: Cyan (accent)
  - Ready: Success green
  - Sent: Muted success
  - Error: Red alert
- Row actions and selection checkboxes

**Modal for Email Editing**:
- Subject line input field
- Body textarea (monospace font for email content)
- Action buttons: "Save Changes", "Regenerate", "Cancel"
- Overlay with semi-transparent dark backdrop

**Form Elements**:
- Input fields with labels
- Textarea for notes/context
- Clear focus states with cyan accent border
- Error states with red borders and helper text

**Buttons**:
- Primary CTA: Cyan accent background with white text
- Secondary: Outlined with cyan border
- Destructive: Red background for critical actions
- Loading states with spinner indicators

**Toast Notifications**:
- Bottom-right positioning
- Success, error, and info variants
- Auto-dismiss with progress indicator

## Responsive Behavior
- **Desktop** (>1024px): Full sidebar + main content layout
- **Tablet** (768-1024px): Collapsible sidebar, stacked cards
- **Mobile** (<768px): Hidden sidebar (hamburger menu), single column layout, hide non-critical table columns behind "Details" drawer

## Interactive States
- Hover states: Subtle brightness increase or opacity change
- Active/focus: Cyan accent borders and shadows
- Disabled: 50% opacity with no-cursor

## Visual Hierarchy
- Primary actions prominently featured with accent color
- Secondary actions in muted tones
- Critical information (email previews, status) with clear visual weight
- Iconography for quick scanning (status icons, action buttons)

## Key User Flows Visual Treatment

**Single Email Flow**:
- Centered form card with max-width constraint
- Prominent "Generate Basho Email" button
- Loading state with skeleton or spinner
- Result display in code-block-style container with copy button

**CSV Bulk Flow**:
- Large drag-and-drop zone as primary focal point
- Table takes full width with horizontal scroll on mobile
- Bulk actions ("Select All", "Send Selected") in sticky header
- Per-row "View/Edit" links opening modals

## Accessibility
- High contrast ratios (WCAG AAA on black background)
- Clear focus indicators with cyan outlines
- Keyboard navigation support
- Screen reader-friendly labels

## Brand Consistency
- Minimal, professional aesthetic avoiding flashy animations
- Consistent use of cyan accent throughout for interactive elements
- Dark theme reinforcing enterprise/productivity positioning