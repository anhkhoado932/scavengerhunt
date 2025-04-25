"use client";

import { useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getGameStatus, GameStatus, getUserGroup, UserGroup } from "@/lib/supabase";
import { CheckpointFacematch } from "@/components/checkpoint-facematch";
import { CheckpointLocationHints } from "@/components/checkpoint-location-hints";

export default function Dashboard() {
  const { user, isLoading, logout } = useUser();
  const router = useRouter();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [userGroup, setUserGroup] = useState<UserGroup | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(true);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<number>(1);

  // Protect this route - redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  // Fetch game status and user group
  useEffect(() => {
    async function fetchData() {
      if (user) {
        setIsLoadingGame(true);
        try {
          // Fetch game status
          const status = await getGameStatus();
          setGameStatus(status);
          
          // Fetch user's group if user has an ID
          if (user.id) {
            const group = await getUserGroup(user.id);
            setUserGroup(group);
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setIsLoadingGame(false);
        }
      }
    }

    fetchData();
  }, [user]);

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

  // Determine what to show based on game state and user group
  const renderContent = () => {
    if (!gameStatus?.game_has_started) {
      return (
        <p className="text-muted-foreground mb-8 text-center">
          Waiting for game to start...
        </p>
      );
    }
    
    // If user is in a group and item hasn't been found yet
    if (userGroup && !userGroup.found) {
      return (
        <div className="space-y-6 mb-8">
          <p className="text-muted-foreground text-center">
            Game in progress!
          </p>
          <div className="mt-8">
            <CheckpointFacematch user={user} onComplete={async () => {
              // Refresh user group data after completion
              if (user.id) {
                const group = await getUserGroup(user.id);
                setUserGroup(group);
              }
            }} />
          </div>
        </div>
      );
    }
    
    // Default state - waiting for next challenge or no group assigned
    return (
      <div className="space-y-6 mb-8">
        <p className="text-muted-foreground text-center">
          Game in progress!
        </p>
        <div className="mt-8">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded text-center">
            <p className="text-lg font-semibold">Waiting for next challenge...</p>
            <p className="text-muted-foreground">Please wait for further instructions.</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold mb-4 text-center">
          Welcome, {user.name}!
        </h1>
        
        {renderContent()}
        
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