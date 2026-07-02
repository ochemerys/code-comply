import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  contrastRatio,
  meetsWcagAaContrast,
  parseHexColor,
  probeDomAccessibility,
  relativeLuminance,
  meetsAccessibilityAcceptance,
  snapshotToAcceptanceCriteria,
} from './accessibility-probes'

describe('accessibility-probes (M11-S18)', () => {
  describe('contrast math', () => {
    it('computes maximum contrast for black on white', () => {
      const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
      expect(ratio).toBeCloseTo(21, 0)
      expect(meetsWcagAaContrast(ratio)).toBe(true)
    })

    it('fails WCAG AA for low-contrast gray on gray', () => {
      const fg = { r: 150, g: 150, b: 150 }
      const bg = { r: 180, g: 180, b: 180 }
      const ratio = contrastRatio(fg, bg)
      expect(meetsWcagAaContrast(ratio)).toBe(false)
    })

    it('applies large-text threshold at 3:1', () => {
      expect(meetsWcagAaContrast(3.2, { largeText: true })).toBe(true)
      expect(meetsWcagAaContrast(2.9, { largeText: true })).toBe(false)
    })

    it('parses hex colors', () => {
      expect(parseHexColor('#111827')).toEqual({ r: 17, g: 24, b: 39 })
      expect(parseHexColor('invalid')).toBeNull()
    })

    it('relativeLuminance is symmetric for channels', () => {
      expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2)
      expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 2)
    })
  })

  describe('DOM probes', () => {
    beforeEach(() => {
      document.documentElement.setAttribute('lang', 'en')
      document.body.innerHTML = `
        <h1>Sign in</h1>
        <form>
          <label for="email">Email</label>
          <input id="email" type="email" />
          <label for="password">Password</label>
          <input id="password" type="password" />
          <button type="submit" class="focus-visible:ring-2">Sign in</button>
        </form>
        <a href="/manual" class="focus-visible:ring-2">Manual</a>
      `
    })

    afterEach(() => {
      document.body.innerHTML = ''
      document.documentElement.removeAttribute('lang')
    })

    it('probeDomAccessibility passes when labels, lang, and contrast are OK', () => {
      const snapshot = probeDomAccessibility(true)
      expect(snapshot).toEqual({
        wcagAa: true,
        screenReader: true,
        keyboardNav: true,
        colorContrast: true,
        focusIndicators: true,
      })
      expect(snapshotToAcceptanceCriteria(snapshot)).toHaveLength(5)
      expect(meetsAccessibilityAcceptance(snapshot)).toBe(true)
    })

    it('flags missing labels as screen reader failure', () => {
      document.body.innerHTML = '<input id="orphan" /><button>OK</button>'
      const snapshot = probeDomAccessibility(true)
      expect(snapshot.screenReader).toBe(false)
      expect(snapshot.wcagAa).toBe(false)
    })

    it('flags poor contrast', () => {
      const snapshot = probeDomAccessibility(false)
      expect(snapshot.colorContrast).toBe(false)
      expect(snapshot.wcagAa).toBe(false)
    })

    it('accepts focus:ring and focus-visible:outline classes', () => {
      document.body.innerHTML = `
        <h1>Sign in</h1>
        <button type="button" class="focus:ring-2" aria-label="Menu">☰</button>
        <a href="/help" class="focus-visible:outline">Help</a>
      `
      const snapshot = probeDomAccessibility(true)
      expect(snapshot.focusIndicators).toBe(true)
      expect(snapshot.keyboardNav).toBe(true)
    })

    it('flags missing focus styles and unnamed buttons', () => {
      document.body.innerHTML = '<button type="button"></button>'
      const snapshot = probeDomAccessibility(true)
      expect(snapshot.focusIndicators).toBe(false)
      expect(snapshot.keyboardNav).toBe(false)
    })

    it('flags missing document lang', () => {
      document.documentElement.removeAttribute('lang')
      document.body.innerHTML = '<h1>Title</h1><button>OK</button>'
      const snapshot = probeDomAccessibility(true)
      expect(snapshot.wcagAa).toBe(false)
    })
  })
})
