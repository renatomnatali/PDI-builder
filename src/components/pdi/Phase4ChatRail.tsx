interface Phase4ChatRailProps {
  progress: number
  text: string
}

export function Phase4ChatRail({ progress, text }: Phase4ChatRailProps) {
  return (
    <aside className="panel chat">
      <header className="chat-header">
        <div className="chat-title-row">
          <div className="chat-title">Mentoria de Carreira</div>
          <span className="phase-pill">Fase 4/5</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <span className="progress-text">{text}</span>
      </header>
      <section className="chat-stream">
        <article className="chat-message">
          <div className="chat-avatar ai">AI</div>
          <div className="chat-bubble">
            <span className="chat-author">Sistema</span>
            A geração incremental está ativa. Cada seção será exibida assim que ficar pronta.
          </div>
        </article>
        <article className="chat-message">
          <div className="chat-avatar ai">AI</div>
          <div className="chat-bubble">
            <span className="chat-author">Sistema</span>
            Se ocorrer falha em uma seção, o status será marcado como erro com ação de retry.
          </div>
        </article>
      </section>
      <footer className="chat-composer">
        <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
          O chat ficará disponível após a conclusão de todas as seções.
        </p>
      </footer>
    </aside>
  )
}
