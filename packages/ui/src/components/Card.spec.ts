import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Card from './Card.vue'

describe('Card', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      const wrapper = mount(Card, {
        slots: { default: 'Card content' },
      })

      expect(wrapper.text()).toBe('Card content')
      expect(wrapper.classes()).toContain('card')
    })

    it('renders default slot content', () => {
      const wrapper = mount(Card, {
        slots: { default: '<p>Test content</p>' },
      })

      expect(wrapper.find('.card-body').html()).toContain('<p>Test content</p>')
    })

    it('renders without header when not provided', () => {
      const wrapper = mount(Card, {
        slots: { default: 'Content' },
      })

      expect(wrapper.find('.card-header').exists()).toBe(false)
    })

    it('renders without footer when not provided', () => {
      const wrapper = mount(Card, {
        slots: { default: 'Content' },
      })

      expect(wrapper.find('.card-footer').exists()).toBe(false)
    })
  })

  describe('Slots', () => {
    it('renders header slot', () => {
      const wrapper = mount(Card, {
        slots: {
          header: '<h3>Card Title</h3>',
          default: 'Content',
        },
      })

      expect(wrapper.find('.card-header').exists()).toBe(true)
      expect(wrapper.find('.card-header').html()).toContain('<h3>Card Title</h3>')
    })

    it('renders footer slot', () => {
      const wrapper = mount(Card, {
        slots: {
          default: 'Content',
          footer: '<button>Action</button>',
        },
      })

      expect(wrapper.find('.card-footer').exists()).toBe(true)
      expect(wrapper.find('.card-footer').html()).toContain('<button>Action</button>')
    })

    it('renders all slots together', () => {
      const wrapper = mount(Card, {
        slots: {
          header: '<h3>Title</h3>',
          default: '<p>Body</p>',
          footer: '<button>Footer</button>',
        },
      })

      expect(wrapper.find('.card-header').exists()).toBe(true)
      expect(wrapper.find('.card-body').exists()).toBe(true)
      expect(wrapper.find('.card-footer').exists()).toBe(true)
    })
  })

  describe('Padding', () => {
    it('applies default medium padding', () => {
      const wrapper = mount(Card, {
        slots: { default: 'Content' },
      })

      expect(wrapper.classes()).toContain('p-4')
    })

    it('applies no padding when padding is none', () => {
      const wrapper = mount(Card, {
        props: { padding: 'none' },
        slots: { default: 'Content' },
      })

      expect(wrapper.classes()).toContain('p-0')
    })

    it('applies small padding', () => {
      const wrapper = mount(Card, {
        props: { padding: 'sm' },
        slots: { default: 'Content' },
      })

      expect(wrapper.classes()).toContain('p-2')
    })

    it('applies medium padding', () => {
      const wrapper = mount(Card, {
        props: { padding: 'md' },
        slots: { default: 'Content' },
      })

      expect(wrapper.classes()).toContain('p-4')
    })

    it('applies large padding', () => {
      const wrapper = mount(Card, {
        props: { padding: 'lg' },
        slots: { default: 'Content' },
      })

      expect(wrapper.classes()).toContain('p-6')
    })
  })

  describe('Clickable State', () => {
    it('is not clickable by default', () => {
      const wrapper = mount(Card, {
        slots: { default: 'Content' },
      })

      expect(wrapper.classes()).not.toContain('cursor-pointer')
      expect(wrapper.classes()).not.toContain('hover:shadow-lg')
    })

    it('applies clickable styles when clickable is true', () => {
      const wrapper = mount(Card, {
        props: { clickable: true },
        slots: { default: 'Content' },
      })

      expect(wrapper.classes()).toContain('cursor-pointer')
      expect(wrapper.classes()).toContain('hover:shadow-lg')
      expect(wrapper.classes()).toContain('transition-all')
      expect(wrapper.classes()).toContain('dark:hover:shadow-none')
    })
  })

  describe('Header Styling', () => {
    it('applies border to header', () => {
      const wrapper = mount(Card, {
        slots: {
          header: 'Header',
          default: 'Content',
        },
      })

      const header = wrapper.find('.card-header')
      expect(header.classes()).toContain('border-b')
      expect(header.classes()).toContain('border-gray-200')
    })

    it('applies spacing to header', () => {
      const wrapper = mount(Card, {
        slots: {
          header: 'Header',
          default: 'Content',
        },
      })

      const header = wrapper.find('.card-header')
      expect(header.classes()).toContain('pb-3')
      expect(header.classes()).toContain('mb-3')
    })
  })

  describe('Footer Styling', () => {
    it('applies border to footer', () => {
      const wrapper = mount(Card, {
        slots: {
          default: 'Content',
          footer: 'Footer',
        },
      })

      const footer = wrapper.find('.card-footer')
      expect(footer.classes()).toContain('border-t')
      expect(footer.classes()).toContain('border-gray-200')
    })

    it('applies spacing to footer', () => {
      const wrapper = mount(Card, {
        slots: {
          default: 'Content',
          footer: 'Footer',
        },
      })

      const footer = wrapper.find('.card-footer')
      expect(footer.classes()).toContain('pt-3')
      expect(footer.classes()).toContain('mt-3')
    })
  })

  describe('Complex Content', () => {
    it('handles complex nested content', () => {
      const wrapper = mount(Card, {
        slots: {
          header: '<div><h2>Title</h2><p>Subtitle</p></div>',
          default: '<div><p>Paragraph 1</p><p>Paragraph 2</p></div>',
          footer: '<div><button>Cancel</button><button>Save</button></div>',
        },
      })

      expect(wrapper.find('.card-header h2').text()).toBe('Title')
      expect(wrapper.find('.card-body p').exists()).toBe(true)
      expect(wrapper.findAll('.card-footer button')).toHaveLength(2)
    })
  })

  describe('Accessibility', () => {
    it('maintains semantic structure', () => {
      const wrapper = mount(Card, {
        slots: {
          header: '<h3>Accessible Title</h3>',
          default: '<p>Accessible content</p>',
        },
      })

      expect(wrapper.find('h3').exists()).toBe(true)
      expect(wrapper.find('p').exists()).toBe(true)
    })
  })
})
