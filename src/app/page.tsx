import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const { userId } = await auth()

  if (userId) {
    redirect('/pdi/pdi-inicial/escolher-modo')
  }

  return (
    <main className="hub" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <section className="hub-section" style={{ maxWidth: 960 }}>
        <div className="logo" style={{ justifyContent: 'center', marginBottom: 16 }}>
          <div className="logo-mark">PDI</div>
          <div className="logo-text">PDI Builder</div>
        </div>
        <h1 className="hub-title" style={{ textAlign: 'center', marginBottom: 12 }}>
          Crie seu PDI com profundidade e execução real
        </h1>
        <p className="hub-subtitle" style={{ textAlign: 'center' }}>
          Plataforma para construir o Plano de Desenvolvimento Individual com diagnóstico adaptativo,
          geração estruturada de documento e revisões por chat com versionamento.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <Link className="btn primary" href="/sign-in">
            Entrar
          </Link>
          <Link className="btn secondary" href="/sign-up">
            Criar conta
          </Link>
        </div>
      </section>
    </main>
  )
}
