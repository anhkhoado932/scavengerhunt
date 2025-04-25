"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, getTeamMembers, getUserGroup, UserGroup } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"

interface CheckpointLocationHintsProps {
  user: User
  onComplete: () => void
}

interface Hint {
  id: number;
  data: {
    question: string;
    answer: string;
  };
}

type QuestionColumn = 'user1_question' | 'user2_question' | 'user3_question' | 'user4_question';

export function CheckpointLocationHints({ user, onComplete }: CheckpointLocationHintsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [hint, setHint] = useState<Hint | null>(null)
  const [userAnswer, setUserAnswer] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [teamMembers, setTeamMembers] = useState<{id: string, name: string}[]>([])
  const [allCompleted, setAllCompleted] = useState(false)

  useEffect(() => {
    loadHint()
  }, [])

  const loadHint = async () => {
    setIsLoading(true)
    try {
      if (!user.id) {
        throw new Error("User ID is required")
      }

      // Get team members
      const members = await getTeamMembers(user.id)
      setTeamMembers(members)

      // Get the user's group
      const userGroup = await getUserGroup(user.id)
      if (!userGroup) {
        throw new Error("User is not in a group")
      }

      // Determine which user question column to use based on user's position in group
      let questionColumn: QuestionColumn | null = null
      if (userGroup.user_id_1 === user.id) questionColumn = 'user1_question'
      else if (userGroup.user_id_2 === user.id) questionColumn = 'user2_question'
      else if (userGroup.user_id_3 === user.id) questionColumn = 'user3_question'
      else if (userGroup.user_id_4 === user.id) questionColumn = 'user4_question'

      if (!questionColumn) {
        throw new Error("User position not found in group")
      }

      // Get the hint for this user
      const { data: hintData, error: hintError } = await supabase
        .from('hints')
        .select('*')
        .eq('id', userGroup[questionColumn])
        .single()

      if (hintError || !hintData) {
        throw new Error("Failed to load hint")
      }

      setHint(hintData)

      // Check if all questions in the group are completed
      const allQuestionsCompleted = [
        userGroup.user1_question,
        userGroup.user2_question,
        userGroup.user3_question,
        userGroup.user4_question
      ].every(questionId => questionId === null)

      setAllCompleted(allQuestionsCompleted)

    } catch (error) {
      console.error("Error loading hint:", error)
      setError("Failed to load hint. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hint || !user.id) return;

    if (userAnswer.toLowerCase() === hint.data.answer.toLowerCase()) {
      // Get the user's group
      const group = await getUserGroup(user.id);
      if (!group) return;

      // Update the group to mark location as solved
      const { error } = await supabase
        .from('groups')
        .update({ location_is_solved: true })
        .eq('id', group.id);

      if (error) {
        console.error('Error updating group:', error);
        return;
      }

      setUserAnswer('');
      setSuccess(true);
      onComplete?.();
    } else {
      setError("Incorrect answer. Try again!");
    }
  };

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
              {allCompleted ? (
                <div className="mt-2">
                  <p className="text-lg font-bold">Congratulations! You've found the location!</p>
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
              <p>{hint.data.question}</p>
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