import { createContext, useContext } from 'react'
import { useBlinkProxyDemo } from '../hooks/useBlinkProxyDemo'

const WardexContext = createContext(null)

export function WardexProvider({ children }) {
  const value = useBlinkProxyDemo()
  return <WardexContext.Provider value={value}>{children}</WardexContext.Provider>
}

export function useWardex() {
  const context = useContext(WardexContext)
  if (!context) {
    throw new Error('useWardex must be used within a WardexProvider')
  }
  return context
}
