import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { TutorialStep } from './tutorialGuide'

interface TutorialOverlayProps {
  step: TutorialStep | null
  onNext: () => void
  onSkip: () => void
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface CardPosition {
  top: number
  left: number
}

const SPOTLIGHT_PADDING = 10
const CARD_WIDTH = 360
const CARD_ESTIMATED_HEIGHT = 150
const CARD_MARGIN = 24
const CARD_GAP = 18
const ARROW_GAP = 16
const DEFAULT_SPOTLIGHT: SpotlightRect = {
  top: 120,
  left: 120,
  width: 320,
  height: 180,
}

function getSpotlightRect(step: TutorialStep | null): SpotlightRect {
  if (!step || typeof document === 'undefined') {
    return DEFAULT_SPOTLIGHT
  }

  const target = document.querySelector(step.target)
  const rect = target?.getBoundingClientRect()

  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return DEFAULT_SPOTLIGHT
  }

  return {
    top: Math.max(8, rect.top - SPOTLIGHT_PADDING),
    left: Math.max(8, rect.left - SPOTLIGHT_PADDING),
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getViewportSize() {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 720,
    }
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function getCardPosition(step: TutorialStep | null, spotlight: SpotlightRect): CardPosition {
  const viewport = getViewportSize()
  const maxLeft = Math.max(CARD_MARGIN, viewport.width - CARD_WIDTH - CARD_MARGIN)
  const maxTop = Math.max(CARD_MARGIN, viewport.height - CARD_ESTIMATED_HEIGHT - CARD_MARGIN)
  const centeredLeft = spotlight.left + spotlight.width / 2 - CARD_WIDTH / 2
  const centeredTop = spotlight.top + spotlight.height / 2 - CARD_ESTIMATED_HEIGHT / 2
  const preferredPlacement = step?.placement ?? 'right'

  if (preferredPlacement === 'left') {
    return {
      left: clamp(spotlight.left - CARD_WIDTH - CARD_GAP, CARD_MARGIN, maxLeft),
      top: clamp(centeredTop, CARD_MARGIN, maxTop),
    }
  }

  if (preferredPlacement === 'top') {
    return {
      left: clamp(centeredLeft, CARD_MARGIN, maxLeft),
      top: clamp(spotlight.top - CARD_ESTIMATED_HEIGHT - CARD_GAP, CARD_MARGIN, maxTop),
    }
  }

  if (preferredPlacement === 'bottom') {
    return {
      left: clamp(centeredLeft, CARD_MARGIN, maxLeft),
      top: clamp(spotlight.top + spotlight.height + CARD_GAP, CARD_MARGIN, maxTop),
    }
  }

  if (preferredPlacement === 'center') {
    return {
      left: clamp(centeredLeft, CARD_MARGIN, maxLeft),
      top: clamp(centeredTop, CARD_MARGIN, maxTop),
    }
  }

  return {
    left: clamp(spotlight.left + spotlight.width + CARD_GAP, CARD_MARGIN, maxLeft),
    top: clamp(centeredTop, CARD_MARGIN, maxTop),
  }
}

function getArrowPosition(spotlight: SpotlightRect, cardPosition: CardPosition) {
  const spotlightCenterX = spotlight.left + spotlight.width / 2
  const spotlightCenterY = spotlight.top + spotlight.height / 2
  const cardCenterX = cardPosition.left + CARD_WIDTH / 2
  const cardCenterY = cardPosition.top + CARD_ESTIMATED_HEIGHT / 2

  return {
    left: clamp((spotlightCenterX + cardCenterX) / 2 - ARROW_GAP, CARD_MARGIN, Math.max(CARD_MARGIN, getViewportSize().width - CARD_MARGIN - 32)),
    top: clamp((spotlightCenterY + cardCenterY) / 2 - ARROW_GAP, CARD_MARGIN, Math.max(CARD_MARGIN, getViewportSize().height - CARD_MARGIN - 32)),
  }
}

function getCardClassName(step: TutorialStep) {
  return ['tutorial-overlay__card', `tutorial-overlay__card--${step.placement}`].join(' ')
}

export function TutorialOverlay({ step, onNext, onSkip }: TutorialOverlayProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect>(() => getSpotlightRect(step))

  useEffect(() => {
    if (!step || typeof window === 'undefined') {
      return undefined
    }

    function syncSpotlight() {
      setSpotlight(getSpotlightRect(step))
    }

    syncSpotlight()
    window.addEventListener('resize', syncSpotlight)
    window.addEventListener('scroll', syncSpotlight, true)

    return () => {
      window.removeEventListener('resize', syncSpotlight)
      window.removeEventListener('scroll', syncSpotlight, true)
    }
  }, [step])

  const style = useMemo(
    () => ({
      '--tutorial-spotlight-top': `${spotlight.top}px`,
      '--tutorial-spotlight-left': `${spotlight.left}px`,
      '--tutorial-spotlight-width': `${spotlight.width}px`,
      '--tutorial-spotlight-height': `${spotlight.height}px`,
    }) as CSSProperties,
    [spotlight],
  )
  const cardPosition = useMemo(() => getCardPosition(step, spotlight), [spotlight, step])
  const cardStyle = useMemo(
    () => ({
      left: `${cardPosition.left}px`,
      top: `${cardPosition.top}px`,
    }) as CSSProperties,
    [cardPosition],
  )
  const arrowPosition = useMemo(() => getArrowPosition(spotlight, cardPosition), [cardPosition, spotlight])
  const arrowStyle = useMemo(
    () => ({
      left: `${arrowPosition.left}px`,
      top: `${arrowPosition.top}px`,
    }) as CSSProperties,
    [arrowPosition],
  )

  if (!step) {
    return null
  }

  return (
    <div className="tutorial-overlay" style={style} role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="tutorial-overlay__veil tutorial-overlay__veil--top" />
      <div className="tutorial-overlay__veil tutorial-overlay__veil--left" />
      <div className="tutorial-overlay__veil tutorial-overlay__veil--right" />
      <div className="tutorial-overlay__veil tutorial-overlay__veil--bottom" />
      <div className="tutorial-overlay__spotlight" aria-hidden="true" />
      <div className="tutorial-overlay__arrow" style={arrowStyle} aria-hidden="true" />

      <section className={getCardClassName(step)} style={cardStyle}>
        <p className="tutorial-overlay__kicker">教学</p>
        <h2 id="tutorial-title" className="tutorial-overlay__title">{step.title}</h2>
        <p className="tutorial-overlay__body">{step.body}</p>
        <div className="tutorial-overlay__actions">
          <button type="button" className="tutorial-overlay__skip" onClick={onSkip}>
            跳过本关教学
          </button>
          <button type="button" className="tutorial-overlay__next" onClick={onNext}>
            下一步
          </button>
        </div>
      </section>
    </div>
  )
}
