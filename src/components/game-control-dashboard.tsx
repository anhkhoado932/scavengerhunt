"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { supabase, type GlobalsData } from "@/lib/supabase"
import { AlertCircle, Loader2, Play, RefreshCcw, Square } from "lucide-react"

interface User {
  id: string;
  name: string;
  email: string;
}

interface Group {
  id?: number;
  user_id_1: string | null;
  user_id_2: string | null;
  user_id_3: string | null;
  user_id_4: string | null;
  photo_url?: string | null;
}

// Track allocated images during a game session
let allocatedImages: string[] = [];

export function GameControlDashboard() {
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [globals, setGlobals] = useState<GlobalsData | null>(null)

  const fetchGlobals = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('globals')
        .select('*')
        .limit(1)
        .single()

      if (error) {
        // If the error is because no rows were found, create a new globals entry
        if (error.code === 'PGRST116') {
          await createGlobalsEntry()
          return
        }
        throw error
      }
      
      setGlobals(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching globals:', err)
      setError('Failed to load game state')
    } finally {
      setLoading(false)
    }
  }

  const createGlobalsEntry = async () => {
    try {
      const newGlobals = {
        game_has_started: false
      }
      
      const { data, error } = await supabase
        .from('globals')
        .insert(newGlobals)
        .select()
        .single()
        
      if (error) throw error
      
      setGlobals(data)
      toast.success('Game state initialized successfully')
    } catch (err) {
      console.error('Error creating globals entry:', err)
      setError('Failed to initialize game state')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGlobals()

    // Set up realtime subscription
    const channel = supabase
      .channel('globals-changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'globals' 
      }, (payload) => {
        setGlobals(payload.new as GlobalsData)
        
        // Reset allocated images when game stops
        if (!(payload.new as GlobalsData).game_has_started) {
          allocatedImages = []
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Get all available images from the bucket
  const getAvailableImages = async () => {
    try {
      const { data, error } = await supabase
        .storage
        .from('group-photos')
        .list('auto', {
          sortBy: { column: 'name', order: 'asc' }
        })

      if (error) throw error
      
      // Filter out any folders and get only files
      const imageFiles = data?.filter(item => !item.id.endsWith('/')) || []
      
      if (imageFiles.length === 0) {
        toast.error('No images found in the group-photos/auto bucket')
        return []
      }
      
      return imageFiles.map(file => file.name)
    } catch (err) {
      console.error('Error fetching images from bucket:', err)
      toast.error('Failed to fetch images from storage')
      return []
    }
  }

  // Allocate images to groups
  const allocateImagesToGroups = async (groups: Group[]) => {
    try {
      // Get all available images
      const allImages = await getAvailableImages()
      if (allImages.length === 0) return false
      
      // Filter out already allocated images
      const availableImages = allImages.filter(img => !allocatedImages.includes(img))
      
      if (availableImages.length < groups.length) {
        toast.error(`Not enough images (${availableImages.length}) for all groups (${groups.length})`)
        return false
      }
      
      // Shuffle available images for random allocation
      const shuffledImages = [...availableImages].sort(() => Math.random() - 0.5)
      
      // Assign images to groups
      const groupUpdates = groups.map((group, index) => {
        const imageName = shuffledImages[index]
        const imageUrl = supabase.storage.from('group-photos').getPublicUrl(`auto/${imageName}`).data.publicUrl
        
        // Track this image as allocated
        allocatedImages.push(imageName)
        
        return {
          id: group.id,
          photo_url: imageUrl
        }
      })
      
      // Update groups with the assigned images
      const { error } = await supabase
        .from('groups')
        .upsert(groupUpdates, { onConflict: 'id' })
      
      if (error) throw error
      
      toast.success(`Successfully allocated images to ${groups.length} groups`)
      return true
    } catch (err) {
      console.error('Error allocating images to groups:', err)
      toast.error('Failed to allocate images to groups')
      return false
    }
  }

  const distributeTeams = async () => {
    try {
      // 1. Fetch all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
      
      if (usersError) throw usersError
      if (!users || users.length === 0) {
        toast.error('No users found to distribute into teams')
        return false
      }

      // 2. Clear existing groups
      const { error: clearError } = await supabase
        .from('groups')
        .delete()
        .not('id', 'is', null)
      
      if (clearError) throw clearError

      // 3. Determine optimal group size
      const totalUsers = users.length
      let groupSize = 3 // default preference

      // First priority: Divisible by 3 or 4
      if (totalUsers % 3 === 0) {
        groupSize = 3
      } else if (totalUsers % 4 === 0) {
        groupSize = 4
      } else {
        // Second priority: Find the most balanced distribution
        // Try to minimize having groups of 2
        const groups3 = Math.floor(totalUsers / 3)
        const remainder3 = totalUsers % 3
        const groups4 = Math.floor(totalUsers / 4)
        const remainder4 = totalUsers % 4
        
        // If remainder4 would create fewer small groups than remainder3
        if (remainder4 <= remainder3 && groups4 > 0) {
          groupSize = 4
        } else {
          groupSize = 3
        }
      }

      // 4. Shuffle users for random distribution
      const shuffledUsers = [...users].sort(() => Math.random() - 0.5)
      
      // 5. Distribute users into groups
      const groups: Group[] = []
      let userIndex = 0
      
      while (userIndex < shuffledUsers.length) {
        // Determine current group size (adjust for last group if needed)
        const currentGroupSize = Math.min(
          groupSize, 
          shuffledUsers.length - userIndex
        )
        
        // Create a new group with up to 4 users (null for empty slots)
        const group: Group = {
          user_id_1: userIndex < shuffledUsers.length ? shuffledUsers[userIndex].id : null,
          user_id_2: userIndex + 1 < shuffledUsers.length ? shuffledUsers[userIndex + 1].id : null,
          user_id_3: userIndex + 2 < shuffledUsers.length ? shuffledUsers[userIndex + 2].id : null,
          user_id_4: userIndex + 3 < shuffledUsers.length ? shuffledUsers[userIndex + 3].id : null,
        }
        
        groups.push(group)
        userIndex += currentGroupSize
      }

      // 6. Insert groups into the database
      const { data: createdGroups, error: insertError } = await supabase
        .from('groups')
        .insert(groups)
        .select()
      
      if (insertError) throw insertError
      
      // 7. Allocate images to groups
      if (!createdGroups || createdGroups.length === 0) {
        throw new Error('Failed to create groups')
      }
      
      const imagesAllocated = await allocateImagesToGroups(createdGroups)
      if (!imagesAllocated) {
        console.warn('Teams were created but image allocation failed')
      }
      
      const groupCounts = groups.map(group => {
        return [group.user_id_1, group.user_id_2, group.user_id_3, group.user_id_4]
          .filter(Boolean).length
      })
      
      toast.success(`Successfully created ${groups.length} teams: ${groupCounts.join(', ')} members per team`)
      return true
    } catch (err) {
      console.error('Error distributing teams:', err)
      toast.error('Failed to distribute users into teams')
      return false
    }
  }

  const updateGameState = async () => {
    if (!globals) return
    
    setUpdating(true)
    try {
      const newState = !globals.game_has_started
      
      // If starting the game, distribute users into teams first
      if (newState) {
        const teamsCreated = await distributeTeams()
        if (!teamsCreated) {
          throw new Error('Failed to create teams')
        }
      } else {
        // Reset allocated images when game stops
        allocatedImages = []
      }
      
      const { error } = await supabase
        .from('globals')
        .update({ game_has_started: newState })
        .eq('id', globals.id)
      
      if (error) throw error
      
      toast.success(`Game ${newState ? 'started' : 'stopped'} successfully`)
    } catch (err) {
      console.error('Error updating game state:', err)
      toast.error('Failed to update game state')
      // Refresh to get current state
      fetchGlobals()
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <Card className="shadow-lg border-2 border-secondary">
        <CardHeader className="bg-muted/30 border-b pb-8 text-center">
          <CardTitle className="text-2xl font-bold">Game Control Dashboard</CardTitle>
          <CardDescription className="text-base mt-2">Loading game state...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="shadow-lg text-center">
        <AlertCircle className="h-5 w-5 mx-auto mb-2" />
        <AlertTitle className="text-lg font-bold">Error</AlertTitle>
        <AlertDescription className="mt-2">
          {error}
          <Button 
            className="mt-4 w-full" 
            onClick={fetchGlobals}
          >
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Try Again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!globals) {
    return (
      <Alert className="shadow-lg text-center">
        <AlertCircle className="h-5 w-5 mx-auto mb-2" />
        <AlertTitle className="text-lg font-bold">No Data Found</AlertTitle>
        <AlertDescription className="mt-2">
          No game state found in the database.
          <Button 
            className="mt-4 w-full"
            onClick={createGlobalsEntry}
          >
            Initialize Game State
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="shadow-lg border-2 border-secondary overflow-hidden">
      {updating && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg flex flex-col items-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">
              {globals.game_has_started ? "Stopping game..." : "Starting game and creating teams..."}
            </p>
          </div>
        </div>
      )}
      
      <CardHeader className="bg-muted/30 border-b pb-6 text-center">
        <CardTitle className="text-2xl font-bold">Game Control Dashboard</CardTitle>
        <CardDescription className="text-base mt-2">
          Start or stop the game
        </CardDescription>
        
        <div className="mt-6 flex justify-center">
          <div className={`px-4 py-2 rounded-full font-medium ${
            globals.game_has_started 
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
          }`}>
            Game is currently {globals.game_has_started ? "running" : "stopped"}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 flex justify-center">
        <Button
          onClick={updateGameState}
          disabled={updating}
          size="lg"
          className={`py-8 px-12 text-lg rounded-xl transition-colors flex gap-3 items-center ${
            globals.game_has_started 
              ? "bg-red-500 hover:bg-red-600" 
              : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {globals.game_has_started ? (
            <>
              <Square className="h-6 w-6" /> Stop Game
            </>
          ) : (
            <>
              <Play className="h-6 w-6" /> Start Game
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
} 