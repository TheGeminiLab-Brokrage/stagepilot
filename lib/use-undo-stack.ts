import { useCallback, useRef } from 'react'

const MAX_HISTORY = 50

export function useUndoStack() {
  const stackRef = useRef<Array<() => void>>([])

  const record = useCallback((undoFn: () => void) => {
    stackRef.current.push(undoFn)
    if (stackRef.current.length > MAX_HISTORY) stackRef.current.shift()
  }, [])

  const undo = useCallback(() => {
    const fn = stackRef.current.pop()
    fn?.()
  }, [])

  return { record, undo }
}

/** Records the previous value on the undo stack, then applies the next value. */
export function setWithUndo<T>(
  record: (undoFn: () => void) => void,
  setter: (v: T) => void,
  prevValue: T,
  nextValue: T,
) {
  record(() => setter(prevValue))
  setter(nextValue)
}
