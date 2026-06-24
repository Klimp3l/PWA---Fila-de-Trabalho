import { useEffect, useRef, useState, type RefObject } from 'react'

export const useStickyHeader = (
  ref: RefObject<HTMLElement | null>,
  onStickWhileScrolling?: () => void,
) => {
  const [isStuck, setIsStuck] = useState(false)
  const onStickRef = useRef(onStickWhileScrolling)

  useEffect(() => {
    onStickRef.current = onStickWhileScrolling
  }, [onStickWhileScrolling])

  useEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

    let animationFrameId: number | null = null

    const updateStickyState = () => {
      const { top } = element.getBoundingClientRect()
      setIsStuck(top <= 0)
    }

    const handleScroll = () => {
      if (animationFrameId !== null) {
        return
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null
        const { top } = element.getBoundingClientRect()
        if (top <= 0) {
          onStickRef.current?.()
        }
        updateStickyState()
      })
    }

    updateStickyState()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [ref])

  return isStuck
}
