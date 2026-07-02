import { vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { CalendarOptions, EventInput } from '@fullcalendar/core'

/** FullCalendar relies on layout APIs that jsdom does not implement fully (see computeCanVGrowWithinCell). */
vi.mock('@fullcalendar/vue3', () => ({
  default: defineComponent({
    name: 'FullCalendarStub',
    props: {
      options: { type: Object, required: true },
    },
    setup(props) {
      return () => {
        const options = props.options as CalendarOptions
        const events = (options.events ?? []) as EventInput[]
        return h('div', { class: 'fc', 'data-testid': 'fullcalendar-stub' }, [
          h('button', { type: 'button', class: 'fc-prev-button', 'aria-label': 'Previous' }),
          ...events.map((ev) =>
            h('button', {
              type: 'button',
              class: 'fc-event',
              'data-event-id': String(ev.id ?? ''),
              onClick: () => {
                options.eventClick?.({
                  event: {
                    id: ev.id,
                    title: ev.title,
                    startStr: typeof ev.start === 'string' ? ev.start : '',
                    extendedProps: ev.extendedProps ?? {},
                  },
                } as Parameters<NonNullable<CalendarOptions['eventClick']>>[0])
              },
            }),
          ),
        ])
      }
    },
  }),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
}
