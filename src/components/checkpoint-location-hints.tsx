"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, getTeamMembers, markHintCompleted, areAllHintsCompleted } from "@/lib/supabase"
import { generateRandomLocation, generateHints, Hint } from "@/lib/location-hints"
import { getHintAssignment, setHintAssignments } from "@/lib/supabase"
import { getGameLocation, getGameHints } from "@/lib/supabase"

interface CheckpointLocationHintsProps {
  user: User
  onComplete: () => void
}

export function CheckpointLocationHints({ user, onComplete }: CheckpointLocationHintsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [hint, setHint] = useState<Hint | null>(null)
  const [userAnswer, setUserAnswer] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [allHints, setAllHints] = useState<Hint[]>([])
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string}[]>([])
  const [allCompleted, setAllCompleted] = useState(false)
  const [location, setLocation] = useState<{building: string, floor: number, aisle: number, section: string} | null>(null)

  useEffect(() => {
    loadHint()
  }, [])

  const loadHint = async () => {
    setIsLoading(true)
    try {
      if (!user.id) {
        throw new Error("User ID is required")
      }

      console.log("Loading hint for user:", user.id)

      // Get team members
      const members = await getTeamMembers(user.id)
      console.log("Team members:", members)
      setTeamMembers(members)

      // Get the user's assigned hint index
      const hintIndex = await getHintAssignment(user.id)
      console.log("Hint index:", hintIndex)
      
      // Get existing location and hints
      const existingLocation = await getGameLocation()
      const existingHints = await getGameHints()
      
      if (hintIndex === null) {
        console.log("No hint assignment found, generating new hints")
        // If no assignment exists, generate new hints and assign them
        const newLocation = existingLocation || await generateRandomLocation()
        console.log("Using location:", newLocation)
        setLocation(newLocation)
        const hints = existingHints || await generateHints(newLocation)
        console.log("Using hints:", hints)
        setAllHints(hints)
        
        // Randomly assign hints to team members
        const assignments = members.map(member => ({
          userId: member.id,
          hintIndex: Math.floor(Math.random() * hints.length)
        }))
        console.log("New hint assignments:", assignments)
        await setHintAssignments(assignments)
        
        // Set the user's assigned hint
        const userAssignment = assignments.find(a => a.userId === user.id)
        if (userAssignment) {
          console.log("Setting user's hint:", hints[userAssignment.hintIndex])
          setHint(hints[userAssignment.hintIndex])
        }
      } else {
        console.log("Using existing hint assignment")
        // If assignment exists, use existing location and hints
        const location = existingLocation || await generateRandomLocation()
        console.log("Using location:", location)
        setLocation(location)
        const hints = existingHints || await generateHints(location)
        console.log("Using hints:", hints)
        setAllHints(hints)
        setHint(hints[hintIndex])
      }

      // Check if all hints are completed
      const completed = await areAllHintsCompleted(members)
      console.log("All hints completed:", completed)
      setAllCompleted(completed)
    } catch (error) {
      console.error("Error loading hint:", error)
      setError("Failed to load hint. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!hint) return

    // Convert both answers to lowercase and remove hyphens/spaces for comparison
    const normalizedUserAnswer = userAnswer.toLowerCase().replace(/[-\s]/g, '')
    const normalizedCorrectAnswer = hint.answer.toLowerCase().replace(/[-\s]/g, '')
    
    // Try to convert the user's answer to a number
    const userAnswerAsNumber = parseInt(userAnswer)
    
    // Try to convert the correct answer to a number
    const correctAnswerAsNumber = parseInt(hint.answer)
    
    // Check if either the word forms match or the numbers match
    const isWordMatch = normalizedUserAnswer === normalizedCorrectAnswer
    const isNumericMatch = !isNaN(userAnswerAsNumber) && !isNaN(correctAnswerAsNumber) && 
      userAnswerAsNumber === correctAnswerAsNumber

    if (isWordMatch || isNumericMatch) {
      setSuccess(true)
      // Mark this user's hint as completed
      if (user.id) {
        await markHintCompleted(user.id)
      }
      
      // Check if all hints are completed
      const completed = await areAllHintsCompleted(teamMembers)
      setAllCompleted(completed)
      
      if (completed) {
        // Wait a bit before showing the final message
        setTimeout(() => {
          onComplete()
        }, 3000)
      } else {
        setTimeout(() => {
          onComplete()
        }, 2000)
      }
    } else {
      setError("Incorrect answer. Try again!")
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Checkpoint 2: Location Hints</CardTitle>
        <CardDescription>
          Solve the hint to find your next location
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p>Loading your hint...</p>
        ) : success ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
              <p className="font-semibold">Correct answer!</p>
              {allCompleted && location ? (
                <div className="mt-2">
                  <p className="text-lg font-bold">Congratulations! You've found the location!</p>
                  <p className="mt-2">
                    I am a place made from all of your answers, Aisle {location.aisle} / Section {location.section} on level {location.floor} of the {location.building}.
                  </p>
                </div>
              ) : (
                <div className="mt-2">
                  <p>Moving to the next step...</p>
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Waiting for these team members to answer:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {teamMembers.map(member => {
                        const isCompleted = member.id === user.id;
                        return !isCompleted && (
                          <div 
                            key={member.id}
                            className="p-2 bg-yellow-50 dark:bg-yellow-900 rounded"
                          >
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">Not answered yet</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : hint ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded">
              <p className="font-semibold mb-2">Question:</p>
              <p className="mb-4">I am made by all of your team answers. What am I?</p>
              <p className="font-semibold mb-2">Your Hint:</p>
              <p>{hint.content}</p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Enter your answer"
                className="w-full p-2 border rounded"
              />
              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={isLoading}
              >
                Submit Answer
              </Button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
                {error}
              </div>
            )}

            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Your Team:</p>
              <div className="grid grid-cols-2 gap-2">
                {teamMembers.map(member => (
                  <div 
                    key={member.id}
                    className={`p-2 rounded ${
                      member.id === user.id 
                        ? 'bg-blue-100 dark:bg-blue-900' 
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.id === user.id ? 'You' : 'Team Member'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p>No hint available. Please try again.</p>
        )}
      </CardContent>
    </Card>
  )
} 