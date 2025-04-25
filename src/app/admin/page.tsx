"use client"

import { Toaster } from "sonner"
import { GameControlDashboard } from "@/components/game-control-dashboard"

export default function AdminPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-xl">
        <GameControlDashboard />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </div>
  )
} 