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
  const [draggedAnswer, setDraggedAnswer] = useState<string | null>(null)
  const [locationAnswers, setLocationAnswers] = useState({
    book: '',
    page: '',
    floor: '',
    location: ''
  })
  const [teamAnswers, setTeamAnswers] = useState<{id: number, answer: string}[]>([])

  useEffect(() => {
    loadHint()
    loadTeamAnswers()
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

  const loadTeamAnswers = async () => {
    try {
      if (!user.id) return

      const userGroup = await getUserGroup(user.id)
      if (!userGroup) return

      // Get all question IDs from the group
      const questionIds = [
        userGroup.user1_question,
        userGroup.user2_question,
        userGroup.user3_question,
        userGroup.user4_question
      ].filter(id => id !== null)

      // Fetch all hints for these questions
      const { data: hints, error } = await supabase
        .from('hints')
        .select('id, data')
        .in('id', questionIds)

      if (error) throw error

      // Extract answers from hints
      const answers = hints.map(hint => ({
        id: hint.id,
        answer: hint.data.answer
      }))

      setTeamAnswers(answers)
    } catch (error) {
      console.error('Error loading team answers:', error)
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

  const handleDragStart = (e: React.DragEvent, answer: string) => {
    setDraggedAnswer(answer)
    e.dataTransfer.setData('text/plain', answer)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, field: keyof typeof locationAnswers) => {
    e.preventDefault()
    if (draggedAnswer) {
      setLocationAnswers(prev => ({
        ...prev,
        [field]: draggedAnswer
      }))
      setDraggedAnswer(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedAnswer(null)
  }

  return (
    <Card className="w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {!locationSolved && (
        <CardHeader className="animate-fade-in">
          <CardTitle className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
            Checkpoint 2: The Hunt for Your Next Location!
          </CardTitle>
          <CardDescription className="text-lg text-slate-600 dark:text-slate-300">
            Unlock the next clue to discover where you're headed! 
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : locationSolved ? (
          <div className="space-y-6 animate-fade-in">
            {showFinalMessage ? (
              <div className="p-8 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
                <h2 className="text-3xl font-bold mb-4 text-center animate-bounce">
                  This is the final checkpoint
                </h2>
                <p className="text-xl text-center">
                  Congratulations! You have completed all the challenges!
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  <div className="mb-6">
                    <p className="text-lg mb-4 text-center text-green-500 font-bold animate-pulse">
                      You've unlocked the hint: {hint?.data.answer}
                    </p>
                    <p className="text-lg mb-4 text-center text-slate-700 dark:text-slate-300">
                      Work together with your teammate and piece together the answers to complete the sentence below:
                    </p>
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-center space-x-2 text-2xl font-bold text-center text-blue-600 dark:text-blue-400">
                        <span>Book</span>
                        <div 
                          className="w-16 h-10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'book')}
                        >
                          {locationAnswers.book}
                        </div>
                        <span>, Page</span>
                        <div 
                          className="w-16 h-10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'page')}
                        >
                          {locationAnswers.page}
                        </div>
                        <span>, on Floor</span>
                        <div 
                          className="w-16 h-10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'floor')}
                        >
                          {locationAnswers.floor}
                        </div>
                        <span>, at</span>
                        <div 
                          className="w-16 h-10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'location')}
                        >
                          {locationAnswers.location}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl">
                      <p className="text-lg font-semibold text-center mb-4">Drag answers to fill in the blanks:</p>
                      <div className="grid grid-cols-2 gap-4">
                        {teamAnswers.map((answer) => (
                          <div 
                            key={answer.id}
                            className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-md cursor-move transform hover:scale-105 transition-transform duration-200"
                            draggable
                            onDragStart={(e) => handleDragStart(e, answer.answer)}
                            onDragEnd={handleDragEnd}
                          >
                            <p className="text-lg text-center">{answer.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl">
                    <p className="text-lg text-center text-slate-700 dark:text-slate-300">
                      Once you've got all the answers, you're one step closer to your destination!
                    </p>
                    <p className="text-xl text-center font-bold text-blue-600 dark:text-blue-400">
                      So... What's next?
                    </p>
                    <ol className="list-decimal list-inside space-y-3 text-lg">
                      <li className="animate-[pulse_1s_ease-in-out_infinite] text-red-500 font-bold transform hover:scale-105 transition-transform">
                        TIME TO RUN!!!!!
                      </li>
                      <li className="text-slate-700 dark:text-slate-300">Find a QR Code</li>
                      <li className="text-slate-700 dark:text-slate-300">Scan it (only one of you needs to do this)</li>
                      <li className="animate-[pulse_1s_ease-in-out_infinite] text-green-500 font-bold transform hover:scale-105 transition-transform">
                        Claim your prize – a $50 AUD voucher at Restaurant ABC
                      </li>
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
                      className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300"
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
          <div className="space-y-4 animate-fade-in">
            <div className="p-6 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl shadow-lg">
              <p className="text-xl font-semibold">You've cracked it!</p>
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
          <div className="space-y-4 animate-fade-in">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl shadow-md">
              <p className="font-semibold mb-2 text-blue-600 dark:text-blue-400">Your riddle:</p>
              <p className="text-lg text-slate-700 dark:text-slate-300">{hint.data.question}</p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Enter your answer"
                className="w-full p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <Button 
                className="w-full py-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                Submit Answer
              </Button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-xl">
                {error}
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-slate-500 dark:text-slate-400">No riddle available. Please try again.</p>
        )}
      </CardContent>
    </Card>
  )
} 