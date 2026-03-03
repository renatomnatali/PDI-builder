'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { isStructuredPhaseOutput } from '@/lib/pdi/structured-output'
import { MarkdownContent } from './MarkdownContent'

interface ChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
}

interface UserProfile {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
}

interface PhaseChatRailProps {
  pdiId: string
  phase:
    | 'PHASE_1_DIAGNOSTICO'
    | 'PHASE_2_ADAPTATIVO'
    | 'PHASE_3_DIRECAO'
    | 'PHASE_5_FINAL'
    | 'PHASE_REVISAO'
  title: string
  phaseLabel: string
  progress: number
  progressText: string
  placeholder: string
  ctaPrimary: string
  ctaSecondary?: string
  promoteStructuredAssistantOutputToWorkspace?: boolean
  initialMessages?: ChatMessage[]
  userProfile: UserProfile
}

const EMPTY_MESSAGES: ChatMessage[] = []

export function PhaseChatRail({
  pdiId,
  phase,
  title,
  phaseLabel,
  progress,
  progressText,
  placeholder,
  ctaPrimary,
  ctaSecondary,
  promoteStructuredAssistantOutputToWorkspace = false,
  initialMessages = EMPTY_MESSAGES,
  userProfile,
}: PhaseChatRailProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const streamEndRef = useRef<HTMLDivElement | null>(null)
  const initialMessagesSignature = useMemo(
    () => initialMessages.map((message) => `${message.id}:${message.role}:${message.content}`).join('|'),
    [initialMessages]
  )

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages, initialMessagesSignature])

  useEffect(() => {
    const endNode = streamEndRef.current
    if (!endNode || typeof endNode.scrollIntoView !== 'function') return
    endNode.scrollIntoView({ block: 'end' })
  }, [messages, isLoading])

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading])
  const visibleMessages = useMemo(
    () =>
      messages.filter((message) => {
        if (!promoteStructuredAssistantOutputToWorkspace) return true
        if (message.role !== 'ASSISTANT') return true
        return !isStructuredPhaseOutput(message.content)
      }),
    [messages, promoteStructuredAssistantOutputToWorkspace]
  )

  async function sendMessage() {
    if (!canSend) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'USER',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`/api/pdi/${pdiId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phase,
          message: userMessage.content,
        }),
      })

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const raw = await response.text()
        const rawTrimmed = raw.trim()
        const looksLikeSignIn =
          rawTrimmed.includes('/sign-in') ||
          rawTrimmed.toLowerCase().includes('sign in') ||
          rawTrimmed.toLowerCase().includes('clerk')
        const isAuthError = response.status === 401 || response.status === 403 || looksLikeSignIn

        throw new Error(
          isAuthError
            ? 'Sessão expirada ou resposta inválida do servidor. Faça login novamente.'
            : `Erro do servidor (${response.status}). Tente novamente.`
        )
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao processar mensagem.')
      }

      const assistantMessage: ChatMessage = {
        id: data.assistantMessage.id,
        role: 'ASSISTANT',
        content: data.assistantMessage.content,
      }

      const shouldPromoteToWorkspace =
        promoteStructuredAssistantOutputToWorkspace &&
        isStructuredPhaseOutput(assistantMessage.content)

      setMessages((prev) => (shouldPromoteToWorkspace ? prev : [...prev, assistantMessage]))

      if (typeof data.nextScreen === 'string' && data.nextScreen.trim().length > 0) {
        router.push(`/pdi/${pdiId}/${data.nextScreen}`)
        router.refresh()
        return
      }

      if (shouldPromoteToWorkspace) {
        router.refresh()
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'ASSISTANT',
          content:
            error instanceof Error
              ? error.message
              : 'Erro inesperado ao enviar mensagem.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return
    if (event.shiftKey) return
    if (event.nativeEvent.isComposing) return

    event.preventDefault()
    void sendMessage()
  }

  const initials = useMemo(() => {
    const base = userProfile.name?.trim() || userProfile.email?.trim() || 'Usuário'
    const tokens = base.split(/\s+/).filter(Boolean)
    if (tokens.length === 1) {
      return tokens[0].slice(0, 2).toUpperCase()
    }
    return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase()
  }, [userProfile.name, userProfile.email])

  return (
    <aside className="panel chat">
      <header className="chat-header">
        <div className="chat-title-row">
          <div className="chat-title">{title}</div>
          <span className="phase-pill">{phaseLabel}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <span className="progress-text">{progressText}</span>
      </header>
      <section className="chat-stream">
        {visibleMessages.map((message) => (
          <article className="chat-message" key={message.id}>
            <div className={`chat-avatar ${message.role === 'USER' ? 'user' : 'ai'}`}>
              {message.role === 'USER' ? (
                userProfile.avatarUrl ? (
                  <div
                    aria-label={userProfile.name || 'Usuário'}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '999px',
                      backgroundImage: `url(${userProfile.avatarUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  ></div>
                ) : (
                  initials
                )
              ) : (
                'AI'
              )}
            </div>
            <div className={`chat-bubble ${message.role === 'USER' ? 'user' : ''}`} style={message.role === 'USER' ? { whiteSpace: 'pre-line' } : undefined}>
              <span className="chat-author">
                {message.role === 'USER' ? userProfile.name || 'Você' : 'Mentor Executivo'}
              </span>
              {message.role === 'USER' ? message.content : <MarkdownContent content={message.content} />}
            </div>
          </article>
        ))}
        <div ref={streamEndRef} />
      </section>
      <footer className="chat-composer">
        <textarea
          autoFocus
          className="chat-input"
          placeholder={placeholder}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onInputKeyDown}
        ></textarea>
        <div className="chat-cta">
          {ctaSecondary ? <button className="btn secondary">{ctaSecondary}</button> : null}
          <button className="btn primary" onClick={sendMessage} disabled={!canSend}>
            {isLoading ? 'Enviando...' : ctaPrimary}
          </button>
        </div>
      </footer>
    </aside>
  )
}
