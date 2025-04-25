import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Dashboard - Game Control",
  description: "Admin control panel for game state and checkpoints",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <section className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {children}
    </section>
  )
} 