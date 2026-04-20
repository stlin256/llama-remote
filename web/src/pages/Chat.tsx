import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Trash2, Copy, Check, AlertCircle, MessageCircle, Plus, X, FolderOpen, Upload, Image as ImageIcon, Brain, ChevronDown, ChevronRight } from 'lucide-react'
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
  totalTokens?: number
  promptTokens?: number
  isError?: boolean
}

interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

// localStorage keys
const STORAGE_KEY = 'llama-remote-chat-sessions'

// Load sessions from localStorage
function loadSessions(): Record<string, ChatSession[]> {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

// Save sessions to localStorage
function saveSessions(sessions: Record<string, ChatSession[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.error('Failed to save chat sessions:', e)
  }
}

// Thinking/Reasoning block component (like llama.cpp)
function ThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(true)

  // Skip if thinking content is too short (likely not real thinking)
  if (!thinking || thinking.length < 5) {
    return null
  }

  return (
    <div style={{
      marginBottom: 8,
      maxWidth: '70%',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          fontSize: 11,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          marginBottom: 6,
          fontWeight: 500,
          boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)',
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Brain size={14} />
        <span>思考中</span>
        <span style={{ opacity: 0.7, fontSize: 10 }}>({thinking.length} chars)</span>
      </button>
      {expanded && (
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
          border: '1px solid rgba(102, 126, 234, 0.25)',
          borderRadius: 8,
          fontSize: 12,
          color: '#1a1a2e',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          maxHeight: 300,
          overflow: 'auto',
          fontFamily: 'monospace',
        }}>
          {thinking}
        </div>
      )}
    </div>
  )
}

export default function Chat() {
  const { instances } = useStore()
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('')
  const [sessions, setSessions] = useState<Record<string, ChatSession[]>>({})
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showSessionList, setShowSessionList] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Settings for generation
  const [chatMode, setChatMode] = useState<'chat' | 'completion'>('chat')
  const [params, setParams] = useState(() => {
    const saved = localStorage.getItem('llama-remote-chat-params')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Reset 400 to -1 (infinite) for users who cached the old default
        if (parsed.n_predict === 400) {
          parsed.n_predict = -1
        }
        return parsed
      } catch (e) {
        // ignore parse error
      }
    }
    return {
      temperature: 0.7,
      top_k: 40,
      top_p: 0.95,
      repeat_penalty: 1.18,
      n_predict: -1,
      grammar: '',
      n_probs: 0
    }
  })

  // Autosave params
  useEffect(() => {
    localStorage.setItem('llama-remote-chat-params', JSON.stringify(params))
  }, [params])

  const [showSettings, setShowSettings] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Get current selected instance
  const selectedInstance = instances.find(i => i.id === selectedInstanceId)
  const hasMmproj = !!selectedInstance?.mmproj

  // Get running instances
  const runningInstances = instances.filter(i => i.status === 'running')

  // Load sessions on mount
  useEffect(() => {
    const loaded = loadSessions()
    setSessions(loaded)
  }, [])

  // Save sessions when they change
  useEffect(() => {
    if (Object.keys(sessions).length > 0) {
      saveSessions(sessions)
    }
  }, [sessions])

  // Load messages when instance or session changes
  useEffect(() => {
    if (selectedInstanceId && sessions[selectedInstanceId]) {
      const instanceSessions = sessions[selectedInstanceId]
      if (currentSessionId) {
        const session = instanceSessions.find(s => s.id === currentSessionId)
        if (session) {
          setMessages(session.messages)
          return
        }
      }
      // Load most recent session or empty
      if (instanceSessions.length > 0) {
        const sorted = [...instanceSessions].sort((a, b) => b.updatedAt - a.updatedAt)
        const latest = sorted[0]
        setCurrentSessionId(latest.id)
        setMessages(latest.messages)
      } else {
        setMessages([])
        setCurrentSessionId('')
      }
    } else {
      setMessages([])
      setCurrentSessionId('')
    }
  }, [selectedInstanceId, sessions, currentSessionId])

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

  // Create new session
  const handleNewSession = useCallback(() => {
    if (!selectedInstanceId) return

    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      name: `会话 ${Object.keys(sessions[selectedInstanceId] || []).length + 1}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setSessions(prev => {
      const instanceSessions = prev[selectedInstanceId] || []
      return {
        ...prev,
        [selectedInstanceId]: [newSession, ...instanceSessions],
      }
    })
    setCurrentSessionId(newSession.id)
    setMessages([])
  }, [selectedInstanceId])

  // Handle instance change
  const handleInstanceChange = (instanceId: string) => {
    setSelectedInstanceId(instanceId)
    setError(null)
  }

  // Handle session change
  const handleSessionChange = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setShowSessionList(false)
  }

  // Handle clear history
  const handleClearHistory = () => {
    setMessages([])
    // Update session in storage
    if (selectedInstanceId && currentSessionId) {
      setSessions(prev => {
        const instanceSessions = prev[selectedInstanceId] || []
        return {
          ...prev,
          [selectedInstanceId]: instanceSessions.map(s =>
            s.id === currentSessionId
              ? { ...s, messages: [], updatedAt: Date.now() }
              : s
          ),
        }
      })
    }
    setError(null)
  }

  // Handle delete session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectedInstanceId) return

    setSessions(prev => {
      const instanceSessions = (prev[selectedInstanceId] || []).filter(s => s.id !== sessionId)
      const newSessions = { ...prev, [selectedInstanceId]: instanceSessions }

      // If deleted current session, switch to another or clear
      if (sessionId === currentSessionId) {
        if (instanceSessions.length > 0) {
          setCurrentSessionId(instanceSessions[0].id)
          setMessages(instanceSessions[0].messages)
        } else {
          setCurrentSessionId('')
          setMessages([])
        }
      }

      return newSessions
    })
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

  // Handle text file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedInstanceId) return

    setUploading(true)
    try {
      const content = await file.text()
      // Add file content as a message
      const fileMessage: ChatMessage = {
        id: `file-${Date.now()}`,
        role: 'user',
        content: `[上传文件: ${file.name}]\n\`\`\`\n${content}\n\`\`\``,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, fileMessage])
    } catch (err) {
      setError(`文件读取失败: ${err}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Handle image upload (for multimodal models)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedInstanceId || !hasMmproj) return

    setUploading(true)
    try {
      // Convert image to base64
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        // For multimodal, we send the image URL
        const imageMessage: ChatMessage = {
          id: `image-${Date.now()}`,
          role: 'user',
          content: `[图片: ${file.name}]\n${base64}`,
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, imageMessage])
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setError(`图片读取失败: ${err}`)
    } finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  // Save user message to localStorage immediately
  const saveUserMessageToStorage = useCallback((userMsg: ChatMessage) => {
    if (!selectedInstanceId) return

    setSessions(prev => {
      const instanceSessions = prev[selectedInstanceId] || []
      let updatedSessions: ChatSession[]

      if (currentSessionId) {
        // Append user message to existing session
        updatedSessions = instanceSessions.map(s =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() }
            : s
        )
      } else {
        // Create new session with user message
        const newSession: ChatSession = {
          id: `session-${Date.now()}`,
          name: userMsg.content.slice(0, 30) + (userMsg.content.length > 30 ? '...' : ''),
          messages: [userMsg],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        setCurrentSessionId(newSession.id)
        updatedSessions = [newSession, ...instanceSessions]
      }

      return { ...prev, [selectedInstanceId]: updatedSessions }
    })
  }, [selectedInstanceId, currentSessionId])

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedInstanceId || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    setError(null)

    // Save user message to localStorage immediately (before AI response)
    saveUserMessageToStorage(userMessage)

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
    let tokenCount = 0
    let promptTokenCount = 0

    try {
      const fullPrompt = chatMode === 'completion'
        ? conversationHistory.map(m => m.content).join('\n\n')
        : '';
      const generator = chatMode === 'completion'
        ? api.sendCompletion(selectedInstanceId, fullPrompt, params)
        : api.sendChatMessage(selectedInstanceId, conversationHistory, params);

      for await (const chunk of generator) {
        if (chunk.done) {
          // Use accurate token count from API
          if (chunk.tokens) {
            tokenCount = chunk.tokens
          }
          if (chunk.promptTokens) {
            promptTokenCount = chunk.promptTokens
          }
          break
        }
        if (chunk.content) {
          fullContent += chunk.content
          // Use token count from API response if available
          if (chunk.tokens) {
            tokenCount = chunk.tokens
          }
          if (chunk.promptTokens) {
            promptTokenCount = chunk.promptTokens
          }
        }
        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId
            ? { ...m, content: fullContent }
            : m
        ))
      }

      // Calculate tokens per second
      const elapsedSeconds = (Date.now() - startTime) / 1000
      const tokensPerSecond = tokenCount > 0 && elapsedSeconds > 0
        ? Math.round(tokenCount / elapsedSeconds)
        : undefined

      const assistantMsg: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
        tokensPerSecond,
        totalTokens: tokenCount,
        promptTokens: promptTokenCount,
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? assistantMsg
          : m
      ))

      // Save to localStorage with assistant response
      if (selectedInstanceId) {
        setSessions(prev => {
          const instanceSessions = prev[selectedInstanceId] || []
          let updatedSessions: ChatSession[]

          if (currentSessionId) {
            updatedSessions = instanceSessions.map(s =>
              s.id === currentSessionId
                ? { ...s, messages: [...newMessages, assistantMsg], updatedAt: Date.now() }
                : s
            )
          } else {
            // Create new session
            const newSession: ChatSession = {
              id: `session-${Date.now()}`,
              name: fullContent.slice(0, 30) + (fullContent.length > 30 ? '...' : ''),
              messages: [...newMessages, assistantMsg],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
            setCurrentSessionId(newSession.id)
            updatedSessions = [newSession, ...instanceSessions]
          }

          return { ...prev, [selectedInstanceId]: updatedSessions }
        })
      }
    } catch (e: any) {
      setError(e.message || t('connectionError'))
      // Keep user message in the chat but remove placeholder
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId))

      // Also save error state to session
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${e.message || t('connectionError')}`,
        timestamp: Date.now(),
        isError: true,
      }
      setSessions(prev => {
        const instanceSessions = prev[selectedInstanceId] || []
        return {
          ...prev,
          [selectedInstanceId]: instanceSessions.map(s =>
            s.id === currentSessionId
              ? { ...s, messages: [...newMessages, errorMsg], updatedAt: Date.now() }
              : s
          )
        }
      })
    } finally {
      setIsLoading(false)
    }
  }, [input, selectedInstanceId, messages, currentSessionId, isLoading, t, saveUserMessageToStorage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Get current instance sessions
  const currentInstanceSessions = sessions[selectedInstanceId] || []

  // Extract thinking/reasoning content - support multiple tag formats and streaming (unclosed tags)
  const extractThinking = (content: string): { thinking: string | null, content: string } => {
    // Try different tag formats
    const tagVariants = [
      { start: '<<<reasoning_content_start>>>', end: '<<<reasoning_content_end>>>' },
      { start: '<<<reasoning>>>', end: '<<<reasoning>>>' },
      { start: '<thinking>', end: '</thinking>' },
      { start: '<think>', end: '</think>' },
    ]

    for (const { start, end } of tagVariants) {
      const startIdx = content.indexOf(start)
      
      if (startIdx !== -1) {
        const endIdx = content.indexOf(end, startIdx + start.length)
        if (endIdx !== -1) {
          // Closed tag
          const thinking = content.substring(startIdx + start.length, endIdx).trim()
          const newContent = content.substring(0, startIdx) + content.substring(endIdx + end.length)
          if (thinking) {
            return { thinking, content: newContent.trim() }
          }
        } else {
          // Unclosed tag (streaming)
          const thinking = content.substring(startIdx + start.length).trim()
          const newContent = content.substring(0, startIdx)
          if (thinking) {
            return { thinking, content: newContent.trim() }
          }
        }
      }
    }

    return { thinking: null, content }
  }

  // Extract images from message content (for multimodal)
  const extractImages = (content: string): { images: string[], text: string } => {
    const imageRegex = /data:image\/[^;]+;base64,[^\n]+/g
    const images: string[] = []
    const text = content.replace(imageRegex, (match) => {
      images.push(match)
      return ''
    }).trim()
    return { images, text }
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
          // Table support
          table({ children }) {
            return (
              <div style={{ overflowX: 'auto', marginTop: 8, marginBottom: 8 }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 11,
                  border: '1px solid var(--win-gray-dark)',
                }}>
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th style={{
                padding: '4px 8px',
                border: '1px solid var(--win-gray-dark)',
                background: 'var(--win-gray)',
                textAlign: 'left',
                fontWeight: 'bold',
              }}>
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td style={{
                padding: '4px 8px',
                border: '1px solid var(--win-gray-dark)',
              }}>
                {children}
              </td>
            )
          },
          // Image support (for multimodal)
          img({ src, alt }) {
            if (src && src.startsWith('data:image')) {
              return (
                <img
                  src={src}
                  alt={alt || 'uploaded image'}
                  style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 4, marginTop: 8 }}
                />
              )
            }
            return null
          },
        }}
      >
        {content}
      </ReactMarkdown>
    )
  }

  return (
    <div className="flex" style={{ height: '100%', minHeight: 0, gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
      {/* Left panel: Settings */}
      {showSettings && (
        <div className="panel" style={{ width: isMobile ? '100%' : '300px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8, paddingBottom: 4, borderBottom: '2px solid var(--win-gray-dark)' }}>
            {t('generationSettings')}
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>{t('chatMode')}:</label>
            <select className="input" style={{ width: '100%' }} value={chatMode} onChange={e => setChatMode(e.target.value as 'chat' | 'completion')}>
              <option value="chat">{t('modeChat')}</option>
              <option value="completion">{t('modeCompletion')}</option>
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('temperature')}</span>
              <span>{params.temperature}</span>
            </label>
            <input type="range" className="input" min="0" max="2" step="0.01" value={params.temperature} onChange={e => setParams({...params, temperature: parseFloat(e.target.value)})} style={{ width: '100%', padding: 0 }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('topK')}</span>
              <span>{params.top_k}</span>
            </label>
            <input type="range" className="input" min="-1" max="100" step="1" value={params.top_k} onChange={e => setParams({...params, top_k: parseInt(e.target.value)})} style={{ width: '100%', padding: 0 }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('topP')}</span>
              <span>{params.top_p}</span>
            </label>
            <input type="range" className="input" min="0" max="1" step="0.01" value={params.top_p} onChange={e => setParams({...params, top_p: parseFloat(e.target.value)})} style={{ width: '100%', padding: 0 }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('repeatPenalty')}</span>
              <span>{params.repeat_penalty}</span>
            </label>
            <input type="range" className="input" min="0" max="2" step="0.01" value={params.repeat_penalty} onChange={e => setParams({...params, repeat_penalty: parseFloat(e.target.value)})} style={{ width: '100%', padding: 0 }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('predictions')}</span>
              <span>{params.n_predict}</span>
            </label>
            <input type="range" className="input" min="-1" max="2048" step="1" value={params.n_predict} onChange={e => setParams({...params, n_predict: parseInt(e.target.value)})} style={{ width: '100%', padding: 0 }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('showProbabilities')}</span>
              <span>{params.n_probs}</span>
            </label>
            <input type="range" className="input" min="0" max="10" step="1" value={params.n_probs || 0} onChange={e => setParams({...params, n_probs: parseInt(e.target.value)})} style={{ width: '100%', padding: 0 }} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>{t('grammarGBNF')}</label>
            <textarea 
              className="input" 
              style={{ width: '100%', height: 80, resize: 'vertical' }} 
              placeholder="e.g. root ::= [a-z]+"
              value={params.grammar}
              onChange={e => setParams({...params, grammar: e.target.value})}
            />
          </div>
        </div>
      )}

      {/* Right panel: Chat area */}
      <div className="flex flex-col" style={{ flex: 1, height: '100%', minHeight: 0 }}>
        {/* Header with instance selector and session controls */}
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
          <button onClick={() => setShowSettings(!showSettings)} className={`btn ${showSettings ? 'active' : ''}`} style={{ fontWeight: 'bold' }}>
            {showSettings ? t('hideSettings') : t('showSettings')}
          </button>

        {/* Instance selector */}
        <select
          className="input"
          style={{ minWidth: isMobile ? '100%' : 200 }}
          value={selectedInstanceId}
          onChange={e => handleInstanceChange(e.target.value)}
        >
          <option value="">{t('chatSelectInstance')}</option>
          {runningInstances.map(inst => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>

        {/* Session selector */}
        {selectedInstanceId && currentInstanceSessions.length > 0 && (
          <button
            onClick={() => setShowSessionList(!showSessionList)}
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <FolderOpen size={12} />
            {isMobile ? '' : (currentInstanceSessions.find(s => s.id === currentSessionId)?.name || t('selectInstance'))}
          </button>
        )}

        {/* New session button */}
        {selectedInstanceId && (
          <button
            onClick={handleNewSession}
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            title={t('startConversation') || 'New Session'}
          >
            <Plus size={12} />
            {isMobile ? '' : '+'}
          </button>
        )}

        {/* Clear history */}
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
          >
            <Trash2 size={12} />
            {isMobile ? '' : t('clearHistory')}
          </button>
        )}
      </div>

      {/* Session list dropdown */}
      {showSessionList && currentInstanceSessions.length > 0 && (
        <div className="panel" style={{ padding: 4, marginBottom: 8, maxHeight: 150, overflow: 'auto' }}>
          {[...currentInstanceSessions].sort((a, b) => b.updatedAt - a.updatedAt).map(session => (
            <div
              key={session.id}
              onClick={() => handleSessionChange(session.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                cursor: 'pointer',
                background: session.id === currentSessionId ? 'var(--win-blue)' : 'transparent',
                color: session.id === currentSessionId ? 'white' : 'inherit',
                borderRadius: 2,
              }}
            >
              <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                {session.name}
              </span>
              <button
                onClick={(e) => handleDeleteSession(session.id, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="panel" style={{ padding: 8, marginBottom: 8, background: '#ffcccc', borderColor: '#aa0000' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aa0000' }}>
            <AlertCircle size={14} />
            <span style={{ fontSize: 11 }}>{error}</span>
          </div>
        </div>
      )}

      {/* No instance selected */}
      {!selectedInstanceId && (
        <div className="panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--win-gray-dark)' }}>
            <MessageCircle size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <div>{t('selectInstanceHint')}</div>
          </div>
        </div>
      )}

      {/* Messages */}
      {selectedInstanceId && messages.length === 0 && !isLoading && (
        <div className="panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--win-gray-dark)' }}>
            <MessageCircle size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <div>{t('startConversation')}</div>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="panel" style={{ flex: 1, overflow: 'auto', padding: isMobile ? 8 : 12 }}>
          <div className="flex flex-col gap-3">
            {messages.map((message) => {
              // Extract thinking first, then images
              const { thinking, content: contentWithoutThinking } = extractThinking(message.content)
              const { images, text } = extractImages(contentWithoutThinking)
              const isError = (message as any).isError

              return (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Thinking/Reasoning section (collapsible, like llama.cpp) */}
                {thinking && message.role === 'assistant' && (
                  <ThinkingBlock thinking={thinking} />
                )}

                {/* Image attachments - show before text content (like llama.cpp) */}
                {images.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: text ? 8 : 0,
                    maxWidth: isMobile ? '85%' : '70%',
                  }}>
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          borderRadius: 8,
                          overflow: 'hidden',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      >
                        <img
                          src={img}
                          alt="attachment"
                          style={{
                            maxWidth: isMobile ? 150 : 200,
                            maxHeight: isMobile ? 150 : 200,
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Message content */}
                {(text || !images.length) && (
                  <div
                    style={{
                      maxWidth: isMobile ? '85%' : '70%',
                      padding: isMobile ? '8px 12px' : '8px 16px',
                      fontSize: isMobile ? 12 : 13,
                      background: message.role === 'user' ? 'var(--win-blue)' : 'var(--win-gray)',
                      color: message.role === 'user' ? 'white' : isError ? '#cc0000' : 'black',
                      borderRadius: message.role === 'user' ? 18 : 4,
                      border: message.role === 'user' ? 'none' : '2px solid',
                      borderColor: '#808080 #fff #fff #808080',
                    }}
                  >
                    {renderContent(text || message.content, message.id)}
                  </div>
                )}

                {/* Statistics bar (like llama.cpp) */}
                <div style={{
                  fontSize: 10,
                  color: 'var(--win-gray-dark)',
                  marginTop: 4,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}>
                  <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                  {message.role === 'assistant' && (
                    <>
                      {message.promptTokens !== undefined && message.promptTokens > 0 && (
                        <span style={{ color: '#0066cc' }}>{message.promptTokens} prompt</span>
                      )}
                      {message.totalTokens !== undefined && message.totalTokens > 0 && (
                        <span>{message.totalTokens} tokens</span>
                      )}
                      {message.tokensPerSecond !== undefined && message.tokensPerSecond > 0 && (
                        <span style={{ color: '#008800' }}>{message.tokensPerSecond} t/s</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            )})}
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--win-gray-dark)', fontSize: 11 }}>
                <div className="loading-dots">{t('thinking')}</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input area */}
      {selectedInstanceId && (
        <div className="flex gap-2" style={{ marginTop: 8, flexDirection: isMobile ? 'column' : 'row' }}>
          {/* Upload buttons row */}
          <div className="flex gap-2" style={{ marginBottom: isMobile ? 4 : 0 }}>
            {/* Hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.json,.md,.csv,.log,.xml,.yaml,.yml"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />

            {/* Upload text file button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn"
              disabled={uploading || isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              title="上传文本文件"
            >
              <Upload size={12} />
              {!isMobile && '文件'}
            </button>

            {/* Upload image button (only if mmproj is available) */}
            {hasMmproj && (
              <button
                onClick={() => imageInputRef.current?.click()}
                className="btn"
                disabled={uploading || isLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                title="上传图片 (需要多模态模型)"
              >
                <ImageIcon size={12} />
                {!isMobile && '图片'}
              </button>
            )}
          </div>

          {/* Text input row */}
          <div className="flex gap-2" style={{ flex: 1 }}>
          <textarea
            ref={inputRef}
            className="input"
            style={{
              flex: 1,
              minHeight: isMobile ? 40 : 60,
              maxHeight: 120,
              resize: 'none',
              fontSize: isMobile ? 12 : 13,
            }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('typeMessage')}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            className="btn btn-primary"
            disabled={!input.trim() || isLoading}
            style={{
              minWidth: isMobile ? 60 : 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <Send size={isMobile ? 14 : 16} />
            {!isMobile && t('sendMessage')}
          </button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
