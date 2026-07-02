/**
 * M11-S18 — Runtime accessibility probes (contrast, focus, keyboard, screen reader).
 */

import {
  WCAG_AA_CONTRAST_RATIO_LARGE,
  WCAG_AA_CONTRAST_RATIO_NORMAL,
  type AccessibilityAcceptanceCriterion,
} from './accessibility-audit-config'

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface AccessibilitySnapshot {
  wcagAa: boolean
  screenReader: boolean
  keyboardNav: boolean
  colorContrast: boolean
  focusIndicators: boolean
}

export interface ContrastProbeOptions {
  largeText?: boolean
}

/** Relative luminance per WCAG 2.1 (sRGB). */
export function relativeLuminance({ r, g, b }: RgbColor): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsWcagAaContrast(ratio: number, options: ContrastProbeOptions = {}): boolean {
  const min = options.largeText ? WCAG_AA_CONTRAST_RATIO_LARGE : WCAG_AA_CONTRAST_RATIO_NORMAL
  return ratio >= min
}

export function parseHexColor(hex: string): RgbColor | null {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function hasDocumentLang(): boolean {
  if (typeof document === 'undefined') return false
  return Boolean(document.documentElement.getAttribute('lang'))
}

function formInputsHaveLabels(): boolean {
  if (typeof document === 'undefined') return false
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[id]:not([type="hidden"])'),
  )
  if (inputs.length === 0) return true
  return inputs.every((input) => {
    const id = input.id
    if (!id) return false
    const label = document.querySelector(`label[for="${id}"]`)
    return label !== null && label.textContent?.trim().length
  })
}

function interactiveElementsHaveAccessibleNames(): boolean {
  if (typeof document === 'undefined') return false
  const buttons = Array.from(document.querySelectorAll('button'))
  return buttons.every((btn) => {
    const text = btn.textContent?.trim()
    const aria = btn.getAttribute('aria-label')?.trim()
    return Boolean(text || aria)
  })
}

function hasVisibleFocusStyles(): boolean {
  if (typeof document === 'undefined') return false
  const focusable = document.querySelector(
    'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )
  if (!focusable) return false
  const className = focusable.className
  return (
    className.includes('focus-visible:ring') ||
    className.includes('focus:ring') ||
    className.includes('focus-visible:outline')
  )
}

function hasMainLandmarkOrHeading(): boolean {
  if (typeof document === 'undefined') return false
  const main = document.querySelector('main, [role="main"]')
  const h1 = document.querySelector('h1')
  return main !== null || h1 !== null
}

export function probeDomAccessibility(contrastOk = true): AccessibilitySnapshot {
  return {
    wcagAa: hasDocumentLang() && formInputsHaveLabels() && contrastOk,
    screenReader: hasMainLandmarkOrHeading() && formInputsHaveLabels(),
    keyboardNav: interactiveElementsHaveAccessibleNames(),
    colorContrast: contrastOk,
    focusIndicators: hasVisibleFocusStyles(),
  }
}

export function snapshotToAcceptanceCriteria(
  snapshot: AccessibilitySnapshot,
): AccessibilityAcceptanceCriterion[] {
  const covered: AccessibilityAcceptanceCriterion[] = []
  if (snapshot.wcagAa) covered.push('wcag-aa')
  if (snapshot.screenReader) covered.push('screen-reader')
  if (snapshot.keyboardNav) covered.push('keyboard-nav')
  if (snapshot.colorContrast) covered.push('color-contrast')
  if (snapshot.focusIndicators) covered.push('focus-indicators')
  return covered
}

export function meetsAccessibilityAcceptance(snapshot: AccessibilitySnapshot): boolean {
  return (
    snapshot.wcagAa &&
    snapshot.screenReader &&
    snapshot.keyboardNav &&
    snapshot.colorContrast &&
    snapshot.focusIndicators
  )
}
