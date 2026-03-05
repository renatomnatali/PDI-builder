import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'

export const metadata: Metadata = {
  title: 'PDI Builder',
  description: 'Geração de PDI com orquestração por seções',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  )
}
