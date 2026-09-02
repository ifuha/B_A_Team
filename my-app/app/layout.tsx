import type { Metadata } from 'next'

import "./globals.css";

export const metadata: Metadata = {
  title: 'SANSUN学園 成績管理',
  description: 'SANSUN学園 成績管理システム'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
