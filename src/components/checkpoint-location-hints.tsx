"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, getTeamMembers, getUserGroup, UserGroup } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { QRCodeScanner } from "./qr-code-scanner"

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
  const [locationSolved, setLocationSolved] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showFinalMessage, setShowFinalMessage] = useState(false)

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

      // Check if location is already solved
      if (userGroup.location_is_solved) {
        setLocationSolved(true)
        return
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
      setIsScanning(true)
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Could not access camera. Please make sure you have granted camera permissions.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }

  return (
    <Card className="w-full">
      {!locationSolved && (
        <CardHeader>
          <CardTitle>Checkpoint 2: The Hunt for Your Next Location!</CardTitle>
          <CardDescription>
          Unlock the next clue to discover where you’re headed! 
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {isLoading ? (
          <p>Loading your riddle...</p>
        ) : locationSolved ? (
          <div className="space-y-6">
            {showFinalMessage ? (
              <div className="p-6 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
                <h2 className="text-2xl font-bold mb-4 text-center">
                  This is the final checkpoint
                </h2>
                <p className="text-lg text-center">
                  Congratulations! You have completed all the challenges!
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  <div className="mb-6">
                    <p className="text-lg mb-4 text-center text-green-500 font-bold">
                      You’ve unlocked the hint: {hint?.data.answer}
                    </p>
                    <p className="text-lg mb-4 text-center">
                    Work together with your teammate and piece together the answers to complete the sentence below:
                    </p>
                    <p className="text-xl font-bold text-center">
                      Book __ , Page __ , on Floor __, at __
                    </p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-lg text-center">
                    Once you've got all the answers, you're one step closer to your destination!
                    </p>
                    <p className="text-lg text-center font-bold">
                    So... What’s next?
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-lg">
                      <li className="animate-[pulse_1s_ease-in-out_infinite] text-red-500 font-bold">
                      TIME TO RUN!!!!!
                      </li>
                      <li>Find a QR Code</li>
                      <li>Scan it (only one of you needs to do this)</li>
                      <li className="animate-[pulse_1s_ease-in-out_infinite] text-green-500 font-bold">Claim your prize – a $50 AUD voucher at Restaurant ABC </li>
                    </ol>
                  </div>
                </div>
                {showScanner ? (
                  <QRCodeScanner 
                    onScan={(data: string) => {
                      console.log("QR Code scanned:", data);
                      setShowScanner(false);
                      setShowFinalMessage(true);
                    }} 
                  />
                ) : (
                  <div className="flex justify-center">
                    <button 
                      className="px-6 py-3 bg-white text-yellow-600 font-bold rounded-lg shadow-md hover:bg-yellow-100 transition-colors duration-300"
                      onClick={() => setShowScanner(true)}
                    >
                      SCAN QR CODE
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
              <p className="font-semibold">You've cracked it!</p>
              {allCompleted ? (
                <div className="mt-2">
                  <p className="text-lg font-bold">Congratulations! You've found the location!</p>
                </div>
              ) : (
                <div className="mt-2">
                  <p>Get ready — you're moving on to the next step!</p>
                </div>
              )}
            </div>
          </div>
        ) : hint ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded">
              <p className="font-semibold mb-2">Your riddle:</p>
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