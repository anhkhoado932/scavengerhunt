"use client"

import { useState } from "react"
import { CameraCapture } from "@/components/camera-capture"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, updateGroupFoundStatus } from "@/lib/supabase"

interface CheckpointFacematchProps {
  user: User
  onComplete: () => void
}

export function CheckpointFacematch({ user, onComplete }: CheckpointFacematchProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [friendImageUrl, setFriendImageUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [similarity, setSimilarity] = useState<number | null>(null)

  // Convert image URL to base64
  const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error("Error converting image to base64:", error)
      throw error
    }
  }

  // Handle camera capture result for friend's photo
  const handleFriendCapture = async (url: string) => {
    setFriendImageUrl(url)
    setShowCamera(false)
    
    // After capturing friend's image, start facematch process
    await processMatch(url)
  }

  // Process the facematch between user's selfie and friend's image
  const processMatch = async (friendUrl: string) => {
    if (!user.selfie_url) {
      setError("Your profile doesn't have a selfie. Please contact support.")
      return
    }

    setIsLoading(true)
    setError(null)
    setSimilarity(null)

    try {
      // Convert both images to base64
      const userImageBase64 = await getBase64FromUrl(user.selfie_url)
      const friendImageBase64 = await getBase64FromUrl(friendUrl)
      
      // Call facematch API with base64 encoded images
      const response = await fetch("/api/facematch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userImage: userImageBase64,
          friendImage: friendImageBase64
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to process face match: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setSuccess(true)
        setSimilarity(result.similarity)
        
        // Update group found status
        if (user.id) {
          await updateGroupFoundStatus(user.id)
        }
        
        // Wait a moment before triggering completion
        setTimeout(() => {
          onComplete()
        }, 2000)
      } else {
        setError(result.message || "Face matching failed. Please try again.")
      }
    } catch (err) {
      console.error("Error in face matching:", err)
      setError("An error occurred during face matching. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Checkpoint 1: Face Match</CardTitle>
        <CardDescription>
          Take a photo with a friend to complete this checkpoint
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCamera ? (
          <CameraCapture onCapture={handleFriendCapture} />
        ) : success ? (
          <div className="p-4 bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300 rounded">
            <p className="font-semibold">Face match successful!</p>
            {similarity && (
              <p className="text-sm">Similarity: {similarity.toFixed(2)}%</p>
            )}
            <p>Moving to the next challenge...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {friendImageUrl && (
              <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                <img 
                  src={friendImageUrl} 
                  alt="You and your friend" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {error && (
              <div className="p-4 bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
                {error}
              </div>
            )}
            
            <Button 
              className="w-full" 
              onClick={() => setShowCamera(true)} 
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : friendImageUrl ? "Retake Photo" : "Take Photo with Friend"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 