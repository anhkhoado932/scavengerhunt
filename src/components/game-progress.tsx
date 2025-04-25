"use client"

import { GameStatus } from "@/lib/supabase"
import { Progress } from "@/components/ui/progress"

interface GameProgressProps {
  gameStatus: GameStatus
}

export function GameProgress({ gameStatus }: GameProgressProps) {
  // Calculate progress percentage based on completed checkpoints
  const calculateProgress = () => {
    const checkpoints = [
      gameStatus.checkpoint1_has_completed,
      gameStatus.checkpoint2_has_completed,
      gameStatus.checkpoint3_has_completed
    ]
    
    // Count completed checkpoints (true values, default to false if undefined)
    const completedCount = checkpoints.filter(checkpoint => checkpoint === true).length
    
    // Each checkpoint is worth 33% (approximately)
    return completedCount * 33.33
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm text-muted-foreground mb-1">
        <span>Game Progress</span>
        <span>{Math.round(calculateProgress())}%</span>
      </div>
      <Progress value={calculateProgress()} className="h-2" />
      <div className="grid grid-cols-3 gap-1 mt-2">
        <div className={`text-xs text-center py-1 px-2 rounded ${gameStatus.checkpoint1_has_completed ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
          Checkpoint 1
        </div>
        <div className={`text-xs text-center py-1 px-2 rounded ${gameStatus.checkpoint2_has_completed ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
          Checkpoint 2
        </div>
        <div className={`text-xs text-center py-1 px-2 rounded ${gameStatus.checkpoint3_has_completed ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
          Checkpoint 3
        </div>
      </div>
    </div>
  )
} 