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
  const [isCurrentUser, setIsCurrentUser] = useState(0)
  const [hints, setHints] = useState<Hint[]>([])
  const [currentHintIndex, setCurrentHintIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [hasSolvedQuestion, setHasSolvedQuestion] = useState(false)
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
    loadHints()
    loadTeamAnswers()
  }, [])

  const allocateHintsToGroup = async (groupId: number) => {
    try {
      // Get the group information
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()

      if (groupError || !groupData) {
        throw new Error("Failed to load group data")
      }

      // Count number of members in the group
      const memberIds = [
        groupData.user_id_1,
        groupData.user_id_2,
        groupData.user_id_3,
        groupData.user_id_4
      ].filter(id => id !== null)

      const groupSize = memberIds.length

      // Get all available hints (assuming the first 4 hints are used for all groups)
      const { data: availableHints, error: hintsError } = await supabase
        .from('hints')
        .select('id')
        .order('id', { ascending: true })
        .limit(4)

      if (hintsError || !availableHints) {
        throw new Error("Failed to load available hints")
      }

      // Prepare update object and distribute hints based on group size
      const updateObj: Record<string, any> = {}

      if (groupSize === 2) {
        // For 2 users: First user gets questions 0,1 and second user gets questions 2,3
        updateObj.user1_question = availableHints[0].id
        updateObj.user2_question = availableHints[2].id
        updateObj.user3_question = availableHints[1].id
        updateObj.user4_question = availableHints[3].id
      } else if (groupSize === 3) {
        // For 3 users: First user gets questions 0,1 and others get one each
        updateObj.user1_question = availableHints[0].id
        updateObj.user2_question = availableHints[2].id
        updateObj.user3_question = availableHints[3].id
        updateObj.user4_question = availableHints[1].id
      } else if (groupSize === 4) {
        // Each member gets 1 question
        updateObj.user1_question = availableHints[0].id
        updateObj.user2_question = availableHints[1].id
        updateObj.user3_question = availableHints[2].id
        updateObj.user4_question = availableHints[3].id
      }

      // Update the group with allocated questions
      const { error: updateError } = await supabase
        .from('groups')
        .update(updateObj)
        .eq('id', groupId)

      if (updateError) {
        throw new Error("Failed to update group with allocated hints")
      }

      return true
    } catch (error) {
      console.error("Error allocating hints:", error)
      return false
    }
  }

  const getUserHintIds = (userGroup: UserGroup, userId: string) => {
    // Determine which questions this user should see based on group size and user position
    const hintIds: number[] = []
    const groupSize = [userGroup.user_id_1, userGroup.user_id_2, userGroup.user_id_3, userGroup.user_id_4]
      .filter(id => id !== null).length

    if (userGroup.user_id_1 === userId) {
      if (userGroup.user1_question !== null) {
        hintIds.push(userGroup.user1_question)
      }
      if ((groupSize === 2 || groupSize === 3) && userGroup.user4_question !== null) {
        // First user in 2 or 3-person groups gets 2 questions
        hintIds.push(userGroup.user4_question)
      }
    } else if (userGroup.user_id_2 === userId) {
      if (userGroup.user2_question !== null) {
        hintIds.push(userGroup.user2_question)
      }
      if (groupSize === 2 && userGroup.user3_question !== null) {
        // Second user in 2-person group gets 2 questions
        hintIds.push(userGroup.user3_question)
      }
    } else if (userGroup.user_id_3 === userId) {
      if (userGroup.user3_question !== null) {
        hintIds.push(userGroup.user3_question)
      }
    } else if (userGroup.user_id_4 === userId) {
      if (userGroup.user4_question !== null) {
        hintIds.push(userGroup.user4_question)
      }
    }

    return hintIds
  }

  const loadHints = async () => {
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

      if (userGroup) { 
        if (userGroup.user_id_1 == user.id) {
          setIsCurrentUser(1)
        }
        else if (userGroup.user_id_2 == user.id) {
          setIsCurrentUser(2)
        }
        else if (userGroup?.user_id_3 == user.id) {
          setIsCurrentUser(3)
        }
        else if (userGroup.user_id_4 == user.id) {
          setIsCurrentUser(4)
        }
      }
      if (userGroup?.user_id_1 == user.id && userGroup.Q1_solved === true) {
        setHasSolvedQuestion(true)
      } else if (userGroup?.user_id_2 == user.id && userGroup.Q2_solved === true) {
        setHasSolvedQuestion(true)
      } else if (userGroup?.user_id_3 == user.id && userGroup.Q3_solved === true) {
        setHasSolvedQuestion(true)
      } else if (userGroup?.user_id_4 == user.id && userGroup.Q4_solved === true) {
        setHasSolvedQuestion(true)
      }


      // Check if hints have been allocated to the group
      const hintsAllocated = userGroup.user1_question !== null || 
                            userGroup.user2_question !== null || 
                            userGroup.user3_question !== null || 
                            userGroup.user4_question !== null

      // If hints have not been allocated, allocate them now
      if (!hintsAllocated) {
        await allocateHintsToGroup(userGroup.id)
        
        // Refresh user group data after allocation
        const updatedGroup = await getUserGroup(user.id)
        if (!updatedGroup) {
          throw new Error("Failed to get updated group data")
        }
        
        // Update userGroup reference with the new data
        Object.assign(userGroup, updatedGroup)
      }

      // Check if location is already solved
      if (userGroup.location_is_solved) {
        setLocationSolved(true)
        return
      }

      // Get the hint IDs for this user based on their position in the group
      const hintIds = getUserHintIds(userGroup, user.id)
      
      if (hintIds.length === 0) {
        throw new Error("No hints assigned to this user")
      }

      // Fetch all hints for this user
      const { data: hintsData, error: hintsError } = await supabase
        .from('hints')
        .select('*')
        .in('id', hintIds)

      if (hintsError || !hintsData) {
        throw new Error("Failed to load hints")
      }

      setHints(hintsData)

      // Check if all questions in the group are completed
      const allQuestionsCompleted = [
        userGroup.user1_question,
        userGroup.user2_question,
        userGroup.user3_question,
        userGroup.user4_question
      ].every(questionId => questionId === null)

      setAllCompleted(allQuestionsCompleted)

    } catch (error) {
      console.error("Error loading hints:", error)
      setError("Failed to load hints. Please try again.")
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
      const { data: hintsData, error } = await supabase
        .from('hints')
        .select('id, data')
        .in('id', questionIds)

      if (error) throw error

      // Extract answers from hints
      const answers = hintsData.map(hint => ({
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
    const currentHint = hints[currentHintIndex];
    if (!currentHint || !user.id) return;

    if (userAnswer.toLowerCase() === currentHint.data.answer.toLowerCase()) {
      setUserAnswer('');
      
      if (currentHintIndex < hints.length - 1) {
        // If there are more hints for this user, move to the next one
        setCurrentHintIndex(currentHintIndex + 1);
        setError(null);
      } else {
        // All hints for this user have been answered
        // Get the user's group
        const group = await getUserGroup(user.id);
        if (!group) return;

        // Determine which question flag to update based on user position
        let updateField = '';
        
        if (group.user_id_1 === user.id && group.user1_question !== null) {
          updateField = 'Q1_solved';
          setIsCurrentUser(1);
          setHasSolvedQuestion(true)
        } else if (group.user_id_2 === user.id && group.user2_question !== null) {
          updateField = 'Q2_solved';
          setIsCurrentUser(2);
          setHasSolvedQuestion(true)
        } else if (group.user_id_3 === user.id && group.user3_question !== null) {
          updateField = 'Q3_solved';
          setIsCurrentUser(3);
          setHasSolvedQuestion(true)
        } else if (group.user_id_4 === user.id && group.user4_question !== null) {
          updateField = 'Q4_solved';
          setIsCurrentUser(4);
          setHasSolvedQuestion(true)
        }

        if (updateField) {
          // Mark this user's question as solved by setting the flag to true
          const updateObj: Record<string, any> = {};
          updateObj[updateField] = true;
          
          const { error: updateError } = await supabase
            .from('groups')
            .update(updateObj)
            .eq('id', group.id);

          if (updateError) {
            console.error('Error updating group:', updateError);
            return;
          }
        }

        // Fetch the updated group to check if all questions are now solved
        const { data: updatedGroup, error: fetchError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', group.id)
          .single();

        if (fetchError || !updatedGroup) {
          console.error('Error fetching updated group:', fetchError);
          return;
        }

        // Check if all questions are now solved (all solved flags are true)
        const allQuestionsSolved = 
          updatedGroup.Q1_solved === true &&
          updatedGroup.Q2_solved === true &&
          updatedGroup.Q3_solved === true &&
          updatedGroup.Q4_solved === true;
        // Only set location_is_solved if all 4 questions are solved
        if (allQuestionsSolved) {
          const { error } = await supabase
            .from('groups')
            .update({ location_is_solved: true })
            .eq('id', group.id);

          if (error) {
            console.error('Error updating group:', error);
            return;
          }
          
          setLocationSolved(true);
        } else if (updatedGroup.Q1_solved && isCurrentUser == 1 ||
          updatedGroup.Q2_solved && isCurrentUser == 2 ||
          updatedGroup.Q3_solved && isCurrentUser == 3 ||
          updatedGroup.Q4_solved && isCurrentUser == 4 
        ) {
          // Just show success for this user's part
          setHasSolvedQuestion(true);
        }

        onComplete?.();
      }
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

  const getCurrentHint = () => {
    return hints.length > 0 ? hints[currentHintIndex] : null;
  }

  return (
    <Card className="w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {!locationSolved && (
        <CardHeader className="animate-fade-in">
          <CardTitle className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
            The Hunt Begins!
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
                      You've unlocked all your hints!
                    </p>
                    <p className="text-lg mb-4 text-center text-slate-700 dark:text-slate-300">
                      Work together with your teammates and piece together the answers to complete the sentence below:
                    </p>
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xl md:text-2xl font-bold text-center text-blue-600 dark:text-blue-400">
                        <span>Book</span>
                        <div 
                          className="min-w-16 h-10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center px-2"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'book')}
                        >
                          {locationAnswers.book}
                        </div>
                        <span>, Page</span>
                        <div 
                          className="min-w-16 h-10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center px-2"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'page')}
                        >
                          {locationAnswers.page}
                        </div>
                        <span>, on Floor</span>
                        <div 
                          className="min-w-16 h-10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center px-2"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'floor')}
                        >
                          {locationAnswers.floor}
                        </div>
                        <span>, at</span>
                        <div 
                          className="min-w-16 h-10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center px-2"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, 'location')}
                        >
                          {locationAnswers.location}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl">
                      <p className="text-lg font-semibold text-center mb-4">Drag answers to fill in the blanks:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {teamAnswers.map((answer) => (
                          <div 
                            key={answer.id}
                            className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow-md cursor-move transform hover:scale-105 transition-transform duration-200 text-center touch-manipulation"
                            draggable
                            onDragStart={(e) => handleDragStart(e, answer.answer)}
                            onDragEnd={handleDragEnd}
                          >
                            <p className="text-lg font-medium">{answer.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-center mt-6">
                    <Button
                      onClick={() => {
                        const isCorrect = 
                          locationAnswers.book.toLowerCase() === "Hamlet".toLowerCase() &&
                          locationAnswers.page.toLowerCase() === "99".toLowerCase() &&
                          locationAnswers.floor.toLowerCase() === "2".toLowerCase() &&
                          locationAnswers.location.toLowerCase() === "Library".toLowerCase();

                        if (isCorrect) {
                          setShowFinalMessage(true);
                        } else {
                          alert("Oops! Try again.");
                        }
                      }}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-lg px-6 py-3 rounded-xl transition-all duration-300"
                    >
                      CHECK LOCATION
                    </Button>
                  </div>
                  <div className="space-y-4 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl">
                    <h3 className="text-xl text-center font-bold text-blue-600 dark:text-blue-400 mb-4">
                      What's Next?
                    </h3>
                    <ol className="list-decimal list-inside space-y-4 text-lg max-w-md mx-auto">
                      <li className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold animate-pulse">
                        TIME TO RUN!!!!!
                      </li>
                      <li className="p-3 rounded-lg bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                        Find a QR Code
                      </li>
                      <li className="p-3 rounded-lg bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                        Scan it (only one of you needs to do this)
                      </li>
                      <li className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold animate-pulse">
                        Claim your prize – a $50 AUD voucher at Restaurant ABC
                      </li>
                    </ol>
                  </div>
                </div>
                {showScanner ? (
                  <div className="mt-8">
                    <QRCodeScanner 
                      onScan={(data: string) => {
                        console.log("QR Code scanned:", data);
                        setShowScanner(false);
                        setShowFinalMessage(true);
                      }} 
                    />
                  </div>
                ) : (
                  <div className="flex justify-center mt-8">
                    <button 
                      className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300 flex items-center gap-2"
                      onClick={() => setShowScanner(true)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="5" y="5" rx="1"></rect><path d="M9 9h1v1H9z"></path><path d="M14 9h1v1h-1z"></path><path d="M9 14h1v1H9z"></path><path d="M14 14h1v1h-1z"></path></svg>
                      SCAN QR CODE
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : hasSolvedQuestion ? (
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
        ) : hints.length > 0 ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-slate-500">
                Question {currentHintIndex + 1} of {hints.length}
              </div>
            </div>
            
            <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl shadow-md">
              <p className="font-semibold mb-2 text-blue-600 dark:text-blue-400">Your riddle:</p>
              <p className="text-lg text-slate-700 dark:text-slate-300">{getCurrentHint()?.data.question}</p>
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
          <p className="text-center text-slate-500 dark:text-slate-400">No riddles available. Please try again.</p>
        )}
      </CardContent>
    </Card>
  )
} 