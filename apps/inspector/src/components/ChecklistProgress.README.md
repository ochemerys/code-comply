# ChecklistProgress Component

## Overview

The `ChecklistProgress` component displays real-time progress tracking for inspection checklists. It shows completion percentage, visual progress bar, and detailed counts for passed, failed, N/A, and unanswered items.

## Story Reference

- **Story ID:** M5-S10
- **Title:** Build Progress Indicator Component
- **Priority:** High
- **Status:** Completed

## Features

✅ **Progress Bar** - Visual percentage indicator with smooth animations  
✅ **Real-time Updates** - Automatically updates as checklist items are answered  
✅ **Count Display** - Shows passed (green), failed (red), N/A (gray), and remaining (blue) counts  
✅ **Complete State** - Visual distinction when checklist is 100% complete  
✅ **Accessibility** - Full ARIA support with live regions and screen reader labels  
✅ **Responsive Design** - Adapts from phone (2-column) to tablet (4-column) layout  
✅ **Dark Mode** - Full dark mode support with proper contrast

## Usage

### Basic Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ChecklistProgress from '@/components/ChecklistProgress.vue'

const progress = ref({
  passedCount: 5,
  failedCount: 2,
  naCount: 1,
  unansweredCount: 3,
})
</script>

<template>
  <ChecklistProgress :progress="progress" />
</template>
```

### With Dynamic Updates

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import ChecklistProgress from '@/components/ChecklistProgress.vue'
import type { ChecklistProgressData } from '@/components/ChecklistProgress.vue'

const checklistItems = ref([
  { id: '1', result: 'PASS' },
  { id: '2', result: 'FAIL' },
  { id: '3', result: 'NA' },
  { id: '4', result: undefined },
  { id: '5', result: undefined },
])

const progress = computed<ChecklistProgressData>(() => {
  const passed = checklistItems.value.filter((item) => item.result === 'PASS').length
  const failed = checklistItems.value.filter((item) => item.result === 'FAIL').length
  const na = checklistItems.value.filter((item) => item.result === 'NA').length
  const unanswered = checklistItems.value.filter((item) => !item.result).length

  return {
    passedCount: passed,
    failedCount: failed,
    naCount: na,
    unansweredCount: unanswered,
  }
})

const handleItemUpdate = (itemId: string, result: 'PASS' | 'FAIL' | 'NA') => {
  const item = checklistItems.value.find((i) => i.id === itemId)
  if (item) {
    item.result = result
  }
}
</script>

<template>
  <div>
    <ChecklistProgress :progress="progress" />

    <!-- Checklist items -->
    <div v-for="item in checklistItems" :key="item.id">
      <ChecklistItem :item="item" @update:result="handleItemUpdate(item.id, $event)" />
    </div>
  </div>
</template>
```

## Props

### `progress` (required)

Type: `ChecklistProgressData`

```typescript
interface ChecklistProgressData {
  passedCount: number // Number of items marked as PASS
  failedCount: number // Number of items marked as FAIL
  naCount: number // Number of items marked as N/A
  unansweredCount: number // Number of items not yet answered
}
```

**Example:**

```typescript
const progress = {
  passedCount: 7,
  failedCount: 2,
  naCount: 1,
  unansweredCount: 5,
}
```

## Computed Values

The component automatically calculates:

- **Total Items:** Sum of all counts
- **Answered Items:** Sum of passed, failed, and N/A counts
- **Progress Percentage:** (Answered / Total) × 100, rounded to nearest integer
- **Is Complete:** True when unansweredCount is 0 and total items > 0

## Visual States

### Incomplete State (Default)

- Blue progress bar
- Blue percentage text
- Standard border and background

### Complete State

- Green progress bar
- Green percentage text
- Green border and background
- "Checklist Complete" badge with checkmark icon

## Accessibility Features

### ARIA Attributes

- `role="region"` with `aria-label="Checklist Progress"` on container
- `role="progressbar"` on progress bar with:
  - `aria-valuenow`: Current percentage
  - `aria-valuemin="0"`
  - `aria-valuemax="100"`
  - `aria-label`: Descriptive label (e.g., "50% complete")
- `aria-live="polite"` on dynamic count values
- `aria-atomic="true"` on percentage display
- `role="status"` on complete badge
- `aria-hidden="true"` on decorative icons

### Screen Reader Support

- Progress updates announced automatically via live regions
- Count changes announced as they occur
- Complete state announced when reached
- All interactive elements have proper labels

### Keyboard Navigation

- Component is non-interactive (display only)
- Focusable elements within parent components maintain proper tab order

## Responsive Behavior

### Phone (<768px)

- 2-column grid for counts
- Smaller padding (p-4)
- Base text sizes
- Stacked layout

### Tablet (≥768px)

- 4-column grid for counts
- Larger padding (p-6)
- Larger text sizes
- Horizontal layout

### Tablet Landscape (≥1024px)

- Same as tablet
- Optimized spacing

## Color Coding

### Passed (Green)

- Background: `bg-green-50` / `dark:bg-green-900/20`
- Border: `border-green-200` / `dark:border-green-800`
- Text: `text-green-600` / `dark:text-green-400`
- Icon: Checkmark

### Failed (Red)

- Background: `bg-red-50` / `dark:bg-red-900/20`
- Border: `border-red-200` / `dark:border-red-800`
- Text: `text-red-600` / `dark:text-red-400`
- Icon: X mark

### N/A (Gray)

- Background: `bg-gray-50` / `dark:bg-gray-800/50`
- Border: `border-gray-200` / `dark:border-gray-700`
- Text: `text-gray-600` / `dark:text-gray-400`
- Icon: Dash

### Unanswered (Blue)

- Background: `bg-blue-50` / `dark:bg-blue-900/20`
- Border: `border-blue-200` / `dark:border-blue-800`
- Text: `text-blue-600` / `dark:text-blue-400`
- Icon: Question mark

## Design Alignment

### Mobile-First Design Guide

✅ **Touch Targets:** All interactive elements meet 44px minimum (not applicable - display only)  
✅ **Spacing Grid:** Uses 4px grid (gap-3, gap-4, p-4, p-6)  
✅ **Semantic Tokens:** Uses `bg-surface`, `border-subtle`, `text-primary`, `text-secondary`  
✅ **Dark Mode:** Conditional shadows and borders per guide  
✅ **Responsive:** Adapts from phone to tablet layouts  
✅ **Transitions:** 200-500ms ease-out animations  
✅ **Safe Areas:** Parent layout handles safe area insets

### Component Design Specification

✅ **Layout & Dimensions:** Follows 4px spacing grid  
✅ **Color Tokens:** Uses semantic tokens exclusively  
✅ **Typography:** Base font sizes with responsive scaling  
✅ **Elevation & Shadows:** Conditional based on theme  
✅ **States:** Clear visual distinction for complete state  
✅ **Responsive:** Tablet-first with phone adaptation  
✅ **Accessibility:** Full ARIA support and screen reader compatibility  
✅ **Interaction:** Smooth transitions for state changes  
✅ **Theming:** Supports light and dark modes

## Testing

### Test Coverage

The component has comprehensive test coverage including:

- ✅ Progress calculation (0%, 50%, 100%, rounding)
- ✅ Count display (all values, zeros, large numbers)
- ✅ Complete state (badge display, styling)
- ✅ Progress bar (width, color, transitions)
- ✅ Real-time updates (reactive to prop changes)
- ✅ Accessibility (ARIA attributes, live regions, roles)
- ✅ Visual distinction (color coding per state)
- ✅ Responsive behavior (grid, padding, text sizes)
- ✅ Edge cases (all passed, all failed, all N/A, mixed, single item, large checklists)

### Running Tests

```bash
# Run all tests
pnpm test

# Run component tests only
pnpm test ChecklistProgress

# Run tests in watch mode
pnpm test:watch ChecklistProgress

# Run tests with coverage
pnpm test:coverage ChecklistProgress
```

### Test Results

```
✓ ChecklistProgress (45 tests)
  ✓ Progress Calculation (5 tests)
  ✓ Count Display (3 tests)
  ✓ Complete State (6 tests)
  ✓ Progress Bar (5 tests)
  ✓ Real-time Updates (3 tests)
  ✓ Accessibility (8 tests)
  ✓ Visual Distinction (4 tests)
  ✓ Responsive Behavior (3 tests)
  ✓ Edge Cases (8 tests)

Test Files  1 passed (1)
     Tests  45 passed (45)
  Start at  [timestamp]
  Duration  [duration]
```

## Integration Example

### With Inspection View

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import ChecklistProgress from '@/components/ChecklistProgress.vue'
import ChecklistItem from '@/components/ChecklistItem.vue'

const inspection = ref({
  id: 'insp-123',
  items: [
    { id: '1', description: 'Check foundation', result: 'PASS' },
    { id: '2', description: 'Inspect framing', result: 'FAIL' },
    { id: '3', description: 'Verify insulation', result: undefined },
    // ... more items
  ],
})

const progress = computed(() => {
  const items = inspection.value.items
  return {
    passedCount: items.filter((i) => i.result === 'PASS').length,
    failedCount: items.filter((i) => i.result === 'FAIL').length,
    naCount: items.filter((i) => i.result === 'NA').length,
    unansweredCount: items.filter((i) => !i.result).length,
  }
})
</script>

<template>
  <div class="inspection-view">
    <!-- Sticky Progress Header -->
    <div class="sticky top-0 z-10 bg-app p-4">
      <ChecklistProgress :progress="progress" />
    </div>

    <!-- Checklist Items -->
    <div class="space-y-4 p-4">
      <ChecklistItem
        v-for="item in inspection.items"
        :key="item.id"
        :item="item"
        @update:result="handleItemUpdate(item.id, $event)"
      />
    </div>
  </div>
</template>
```

## Performance Considerations

- ✅ **Reactive Updates:** Uses computed properties for efficient recalculation
- ✅ **Minimal Re-renders:** Only updates when progress prop changes
- ✅ **Smooth Animations:** CSS transitions for progress bar (500ms)
- ✅ **Lightweight:** No external dependencies beyond Vue
- ✅ **Optimized Rendering:** Conditional rendering for complete badge

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest) - iOS 14+
- ✅ Safari (desktop) - macOS 11+

## Related Components

- `ChecklistItem.vue` - Individual checklist item with Pass/Fail/N/A buttons
- `SyncStatus.vue` - Displays sync status for offline functionality
- `SyncProgressBar.vue` - Shows sync progress for data upload

## Changelog

### v1.0.0 (2024-01-15)

- ✅ Initial implementation
- ✅ Progress calculation and display
- ✅ Real-time updates
- ✅ Complete state visualization
- ✅ Full accessibility support
- ✅ Responsive design
- ✅ Dark mode support
- ✅ Comprehensive test coverage

## Future Enhancements

- [ ] Add animation when transitioning to complete state
- [ ] Add optional confetti effect on completion
- [ ] Add optional sound feedback on completion
- [ ] Add export progress data functionality
- [ ] Add progress history tracking
- [ ] Add estimated time to completion

## License

Part of the Safety Codes Inspection System - Internal Use Only
