import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Trash2, Copy, Check, AlertCircle, MessageCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { useStore } from '../store'
import { api } from '../hooks/api'
import { useTranslation } from '../i18n/useTranslation'
import { useIsMobile } from '../hooks/useMediaQuery'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  tokensPerSecond?: number
}

export default function Chat() {
  const { instances } = useStore()
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Get running instances
  const runningInstances = instances.filter(i => i.status === 'running')

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-select first running instance if none selected
  useEffect(() => {
    if (!selectedInstanceId && runningInstances.length > 0) {
      setSelectedInstanceId(runningInstances[0].id)
    }
  }, [runningInstances, selectedInstanceId])

  const handleClearHistory = () => {
    setMessages([])
    setError(null)
  }

  const handleCopyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedInstanceId || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    // Build conversation history
    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content,
    }))
    conversationHistory.push({ role: 'user', content: userMessage.content })

    // Create placeholder for assistant message
    const assistantMessageId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }])

    let fullContent = ''
    const startTime = Date.now()
    let tokens = 0

    try {
      for await (const chunk of api.sendChatMessage(selectedInstanceId, conversationHistory)) {
        if (chunk.done) {
          tokens = chunk.tokens || 0
          break
        }
        fullContent += chunk.content
        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: fullContent }
            : m
        ))
      }

      // Calculate tokens per second
      const elapsedSeconds = (Date.now() - startTime) / 1000
      const tokensPerSecond = tokens > 0 ? Math.round(tokens / elapsedSeconds) : undefined

      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? { ...m, tokensPerSecond }
          : m
      ))
    } catch (e: any) {
      setError(e.message || t('connectionError'))
      // Remove the placeholder message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId))
    } finally {
      setIsLoading(false)
    }
  }, [input, selectedInstanceId, messages, isLoading, t])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Render message content with markdown and code blocks
  const renderContent = (content: string, messageId: string) => {
    return (
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '')
            const codeId = `${messageId}-${codeString.slice(0, 20)}`

            if (!match) {
              return (
                <code className="chat-inline-code" {...props}>
                  {children}
                </code>
              )
            }

            return (
              <div style={{ position: 'relative', marginTop: 8, marginBottom: 8 }}>
                <button
                  onClick={() => handleCopyCode(codeString, codeId)}
                  className="btn"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {copiedId === codeId ? (
                    <>
                      <Check size={10} />
                      {t('copied')}
                    </>
                  ) : (
                    <>
                      <Copy size={10} />
                      {t('copyCode')}
                    </>
                  )}
                </button>
                <SyntaxHighlighter
                  customStyle={{
                    background: '#c0c0c0',
                    border: '2px solid',
                    borderColor: '#808080 #fff #fff #808080',
                    fontSize: 11,
                    padding: '24px 8px 8px',
                    margin: 0,
                  }}
                  language={match[1]}
                  PreTag="div"
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 12, flexShrink: 0 }}>
        <h2 style={{ fontSize: 14, fontWeight: 'bold' }}>{t('chatTitle')}</h2>
        <div className="flex items-center gap-2">
          {/* Instance Selector */}
          <select
            className="input"
            style={{
              minWidth: isMobile ? 120 : 200,
              fontSize: 11,
              padding: '4px 8px',
            }}
            value={selectedInstanceId}
            onChange={e => setSelectedInstanceId(e.target.value)}
          >
            <option value="">{t('chatSelectInstance')}</option>
            {runningInstances.map(inst => (
              <option key={inst.id} value={inst.id}>
                {inst.name} (:{inst.port})
              </option>
            ))}
          </select>

          {/* Clear History */}
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="btn"
              style={{
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
              }}
            >
              <Trash2 size={12} />
              {!isMobile && t('clearHistory')}
            </button>
          )}
        </div>
      </div>

      {/* No instance warning */}
      {!selectedInstanceId && (
        <div
          className="panel"
          style={{
            padding: 24,
            textAlign: 'center',
            marginBottom: 12,
            background: '#ffffd0',
            border: '2px solid',
            borderColor: '#808080 #fff #fff #808080',
          }}
        >
          <AlertCircle size={32} style={{ color: '#808000', marginBottom: 8 }} />
          <div style={{ fontSize: 12 }}>{t('noRunningInstance')}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{t('selectInstanceHint')}</div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            background: '#ffcccc',
            border: '2px solid',
            borderColor: '#808080 #fff #fff #808080',
            fontSize: 11,
            color: '#cc0000',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={14} />
          {error}
          <button
            onClick={() => setError(null)}
            className="btn"
            style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 10 }}
          >
            {t('tryAgain')}
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        className="panel"
        style={{
          flex: 1,
          minHeight: 200,
          overflow: 'auto',
          padding: 12,
          marginBottom: 12,
          background: '#fff',
          border: '2px solid',
          borderColor: '#808080 #fff #fff #808080',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#808080',
              fontSize: 12,
            }}
          >
            <MessageCircle size={48} style={{ marginBottom: 12, opacity: 0.5 }} />
            <div>{t('noMessages')}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>{t('startConversation')}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`chat-message chat-message-${msg.role}`}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
                <div
                  style={{
                    padding: msg.role === 'user' ? '8px 12px' : '8px 12px',
                    background: msg.role === 'user' ? '#000080' : '#c0c0c0',
                    color: msg.role === 'user' ? '#fff' : '#000',
                    fontSize: 12,
                    borderRadius: msg.role === 'user' ? '8px 8px 0 8px' : '8px 8px 8px 0',
                    border: msg.role === 'assistant' ? '2px solid' : 'none',
                    borderColor: '#808080 #fff #fff #808080',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                  }}
                >
                  {msg.role === 'assistant' && !msg.content && isLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="thinking-dots">
                        <span>.</span><span>.</span><span>.</span>
                      </span>
                      {t('thinking')}
                    </span>
                  ) : (
                    renderContent(msg.content, msg.id)
                  )}
                </div>
                {msg.role === 'assistant' && msg.tokensPerSecond && (
                  <div
                    style={{
                      fontSize: 10,
                      color: '#666',
                      marginTop: 4,
                      marginLeft: 4,
                    }}
                  >
                    {msg.tokensPerSecond} {t('tokensPerSecond')}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexShrink: 0,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={inputRef}
          className="input"
          style={{
            flex: 1,
            resize: 'none',
            minHeight: isMobile ? 36 : 44,
            maxHeight: 120,
            fontSize: 12,
            padding: '8px 12px',
          }}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('typeMessage')}
          disabled={!selectedInstanceId || isLoading}
          rows={1}
        />
        <button
          onClick={handleSend}
          className="btn btn-primary"
          style={{
            padding: isMobile ? '8px 12px' : '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: isMobile ? 'auto' : 80,
          }}
          disabled={!selectedInstanceId || !input.trim() || isLoading}
        >
          <Send size={14} />
          {!isMobile && t('sendMessage')}
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            bottom: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--win-blue)',
            color: 'white',
            padding: '4px 12px',
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          {t('thinking')}
        </div>
      )}

      <style>{`
        .chat-inline-code {
          background: #e0e0e0;
          padding: 1px 4px;
          border-radius: 3px;
          font-family: monospace;
          font-size: 0.9em;
        }
        .chat-message-assistant .chat-inline-code {
          background: #d0d0d0;
        }
        .thinking-dots span {
          animation: blink 1.4s infinite both;
        }
        .thinking-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .thinking-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
