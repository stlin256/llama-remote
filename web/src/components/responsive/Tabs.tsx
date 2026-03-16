import { ReactNode, useState } from 'react'
import { useIsMobile } from '../../hooks/useMediaQuery'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (tabId: string) => void
}

/**
 * Responsive Tabs component
 * - Desktop: Horizontal tab bar
 * - Mobile: Horizontal scrollable tabs
 */
export default function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }

  const activeContent = tabs.find(t => t.id === activeTab)?.content

  if (isMobile) {
    return (
      <div>
        {/* Horizontal scrollable tabs */}
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          background: 'var(--win-gray)',
          borderBottom: '2px solid var(--win-gray-dark)',
          scrollbarWidth: 'none',
          gap: 2
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                flex: '0 0 auto',
                padding: '12px 16px',
                background: activeTab === tab.id ? 'var(--win-white)' : 'var(--win-gray)',
                border: 'none',
                borderBottom: activeTab === tab.id ? 'none' : '2px solid var(--win-gray-dark)',
                borderTop: '2px solid',
                borderTopColor: activeTab === tab.id ? 'var(--win-white)' : 'var(--win-gray-dark)',
                borderLeft: '2px solid',
                borderLeftColor: activeTab === tab.id ? 'var(--win-gray-dark)' : 'var(--win-gray)',
                borderRight: '2px solid',
                borderRightColor: activeTab === tab.id ? 'var(--win-gray-dark)' : 'var(--win-gray)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                color: activeTab === tab.id ? 'var(--win-blue)' : 'var(--win-black)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: 12 }}>
          {activeContent}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        background: 'var(--win-gray)',
        padding: '4px 4px 0 4px'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '4px 16px',
              background: activeTab === tab.id ? 'var(--win-white)' : 'var(--win-gray)',
              border: '2px solid',
              borderColor: activeTab === tab.id
                ? 'var(--win-gray-dark) var(--win-gray-dark) transparent var(--win-gray-dark)'
                : 'var(--win-gray) var(--win-gray) var(--win-gray) var(--win-gray)',
              borderBottom: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              color: activeTab === tab.id ? 'var(--win-black)' : 'var(--win-gray-dark)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        background: 'var(--win-white)',
        border: '2px solid var(--win-gray-dark)',
        borderTopColor: 'var(--win-white)',
        padding: 12
      }}>
        {activeContent}
      </div>
    </div>
  )
}
