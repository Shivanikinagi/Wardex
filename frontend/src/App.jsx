import { useState } from 'react'
import './index.css'
import Dashboard from './pages/Dashboard'
import Proposer from './pages/Proposer'
import { useContracts } from './hooks/useContracts'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Protocol Activity' },
  { id: 'propose', label: 'Simulate Elsa Execution' },
]

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const { connected, connectMetaMask, account, isLive } = useContracts()

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />
      case 'propose': return <Proposer />
      default: return <Dashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div 
                className="flex-shrink-0 flex items-center cursor-pointer" 
                onClick={() => setActivePage('dashboard')}
              >
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                  DarkAgent Core
                </span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`${
                      activePage === item.id
                        ? 'border-indigo-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {connected ? (
                <div className="flex items-center space-x-2">
                  <span className={`h-3 w-3 rounded-full ${isLive ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                  <span className="text-sm text-gray-700 font-mono">
                    {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connected'}
                  </span>
                </div>
              ) : (
                <button 
                  onClick={connectMetaMask}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1">
        {renderPage()}
      </main>
    </div>
  )
}
