"use client";

import { useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getGameStatus, GameStatus, getUserGroup, UserGroup } from "@/lib/supabase";
import { CheckpointFacematch } from "@/components/checkpoint-facematch";
import { CheckpointLocationHints } from "@/components/checkpoint-location-hints";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

export default function Dashboard() {
  const { user, isLoading, logout } = useUser();
  const router = useRouter();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [userGroup, setUserGroup] = useState<UserGroup | null>(null);
  const [isLoadingGame, setIsLoadingGame] = useState(true);
  const [currentCheckpoint, setCurrentCheckpoint] = useState<number>(1);
  const [showFaceMatch, setShowFaceMatch] = useState(false);

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

    // If show face match is true, show the face match component
    if (showFaceMatch) {
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
                setShowFaceMatch(false);
              }
            }} />
          </div>
        </div>
      );
    }
    
    // If user is in a group, it has a photo_url, and item hasn't been found yet
    if (userGroup && userGroup.photo_url && !userGroup.found) {
      // Count the number of members in the group (non-null user IDs)
      const groupMemberCount = [
        userGroup.user_id_1,
        userGroup.user_id_2,
        userGroup.user_id_3,
        userGroup.user_id_4
      ].filter(id => id !== null).length;
      
      return (
        <div className="space-y-6 mb-8">
          <p className="text-muted-foreground text-center">
            Game in progress!
          </p>
          <div className="mt-8">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Your Group Assignment</CardTitle>
                <CardDescription>
                  This is your group's assigned image
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                  <img 
                    src={userGroup.photo_url} 
                    alt="Group assignment" 
                    className="w-full h-full object-contain"
                  />
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300 text-sm">
                  <p className="font-medium mb-1">Group Information:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Your group has {groupMemberCount} members (including you)</li>
                    <li>All members in your group have been assigned the same image</li>
                    <li>Your goal is to find your group members</li>
                    <li>Once found, click continue to proceed</li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => setShowFaceMatch(true)}
                >
                  Continue
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      );
    }
    
    // If user is in a group and item has been found, show location hints
    if (userGroup && userGroup.found) {
      return (
        <div className="space-y-6 mb-8">
          <p className="text-muted-foreground text-center">
            Game in progress!
          </p>
          <div className="mt-8">
            <CheckpointLocationHints user={user} onComplete={async () => {
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