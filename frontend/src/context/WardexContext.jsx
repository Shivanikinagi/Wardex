import { createContext, useContext } from 'react'
import { useBlinkProxyDemo } from '../hooks/useBlinkProxyDemo'

const wardexContext = createContext(null)

export function wardexProvider({ children }) {
  const value = useBlinkProxyDemo()
  return <wardexContext.Provider value={value}>{children}</wardexContext.Provider>
}

export function usewardex() {
  const context = useContext(wardexContext)
  if (!context) {
    throw new Error('usewardex must be used within a wardexProvider')
  }
  return context
}
