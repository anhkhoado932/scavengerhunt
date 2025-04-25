"use client";

import { useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getGameStatus, GameStatus, updateCheckpointStatus } from "@/lib/supabase";
import { GameProgress } from "@/components/game-progress";
import { CheckpointFacematch } from "@/components/checkpoint-facematch";
import { CheckpointLocationHints } from "@/components/checkpoint-location-hints";

export default function Dashboard() {
  const { user, isLoading, logout } = useUser();
  const router = useRouter();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(true);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<number>(1);

  // Protect this route - redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Fetch game status
  useEffect(() => {
    async function fetchGameStatus() {
      if (user) {
        setIsLoadingGame(true);
        try {
          const status = await getGameStatus();
          setGameStatus(status);
          // If game has started, set current checkpoint to 2 (location hints)
          if (status?.game_has_started) {
            setCurrentCheckpoint(2);
          }
        } catch (error) {
          console.error("Error fetching game status:", error);
        } finally {
          setIsLoadingGame(false);
        }
      }
    }

    fetchGameStatus();
  }, [user]);

  // Handle checkpoint completion
  const handleCheckpoint1Completed = async () => {
    if (await updateCheckpointStatus(1)) {
      // Refresh game status after updating checkpoint
      const status = await getGameStatus();
      setGameStatus(status);
      // Move to checkpoint 2
      setCurrentCheckpoint(2);
    }
  };

  const handleCheckpoint2Completed = async () => {
    if (await updateCheckpointStatus(2)) {
      // Refresh game status after updating checkpoint
      const status = await getGameStatus();
      setGameStatus(status);
      setCurrentCheckpoint(3);
    }
  };

  // Show loading state while checking authentication
  if (isLoading || isLoadingGame) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Don't render anything if not logged in (will redirect via useEffect)
  if (!user) {
    return null;
  }

  // Determine which checkpoint component to show
  const renderCurrentCheckpoint = () => {
    if (!gameStatus) return null;
    
    switch (currentCheckpoint) {
      case 1:
        return <CheckpointFacematch user={user} onComplete={handleCheckpoint1Completed} />;
      case 2:
        return <CheckpointLocationHints user={user} onComplete={handleCheckpoint2Completed} />;
      default:
        return (
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded text-center">
            <p className="text-lg font-semibold">Waiting for next challenge...</p>
            <p className="text-muted-foreground">Please wait for further instructions.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold mb-4 text-center">
          Welcome, {user.name}!
        </h1>
        
        {gameStatus && !gameStatus.game_has_started ? (
          <p className="text-muted-foreground mb-8 text-center">
            Waiting for game to start...
          </p>
        ) : gameStatus?.game_has_started ? (
          <div className="space-y-6 mb-8">
            <p className="text-muted-foreground text-center">
              Game in progress!
            </p>
            <GameProgress gameStatus={gameStatus} />
            <div className="mt-8">
              {renderCurrentCheckpoint()}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground mb-8 text-center">
            You have successfully signed in!
          </p>
        )}
        
        {/* Sign Out button commented out for now
        <button 
          onClick={logout}
          className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
        >
          Sign Out
        </button>
        */}
      </div>
    </div>
  );
} 