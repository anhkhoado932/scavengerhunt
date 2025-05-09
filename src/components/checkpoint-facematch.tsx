"use client"

import { useState } from "react"
import { CameraCapture } from "@/components/camera-capture"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { User, updateGroupFoundStatus, supabase } from "@/lib/supabase"

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

  // Mark the user's group as found
  const markGroupAsFound = async (): Promise<boolean> => {
    if (!user.id) {
      console.error("Cannot mark group as found: Missing user ID")
      return false
    }

    try {
      // First, find the user's group
      const { data: groups, error: findError } = await supabase
        .from('groups')
        .select('id')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id},user_id_3.eq.${user.id},user_id_4.eq.${user.id}`)
        .single()

      if (findError || !groups) {
        console.error("Error finding user's group:", findError)
        return false
      }

      // Update the group's found status
      const { error: updateError } = await supabase
        .from('groups')
        .update({ found: true })
        .eq('id', groups.id)

      if (updateError) {
        console.error("Error updating group's found status:", updateError)
        return false
      }

      return true
    } catch (error) {
      console.error("Error marking group as found:", error)
      return false
    }
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
      // First, get the user's group and all members
      const { data: groups, error: findError } = await supabase
        .from('groups')
        .select('*')
        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id},user_id_3.eq.${user.id},user_id_4.eq.${user.id}`)
        .single()

      if (findError || !groups) {
        throw new Error("Could not find your group")
      }

      // Get all user IDs in the group except the current user
      const groupUserIds = [
        groups.user_id_1,
        groups.user_id_2,
        groups.user_id_3,
        groups.user_id_4
      ].filter(id => id !== null && id !== user.id)

      // Get selfie URLs for all group members
      const { data: groupMembers, error: membersError } = await supabase
        .from('users')
        .select('id, selfie_url')
        .in('id', groupUserIds)

      if (membersError || !groupMembers) {
        throw new Error("Could not fetch group members")
      }

      // Convert friend's image to base64
      const friendImageBase64 = await getBase64FromUrl(friendUrl)
      
      // Check if each group member is present in the image
      let allMembersFound = true
      let missingMembers: string[] = []

      for (const member of groupMembers) {
        if (!member.selfie_url) {
          missingMembers.push(member.id)
          allMembersFound = false
          continue
        }

        // Convert member's selfie to base64
        const memberImageBase64 = await getBase64FromUrl(member.selfie_url)
        
        // Call facematch API to check if member is in the image
        const response = await fetch("/api/facematch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userImage: memberImageBase64,
            friendImage: friendImageBase64
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to process face match: ${response.statusText}`)
        }

        const result = await response.json()
        
        if (!result.success || result.similarity < 0.7) { // Using 70% as threshold
          missingMembers.push(member.id)
          allMembersFound = false
        }
      }

      if (!allMembersFound) {
        setError(`Not all group members are present in the photo. Missing members: ${missingMembers.join(', ')}`)
        return
      }

      // If all members are found, mark the group as found
      setSuccess(true)
      setSimilarity(100) // Since all members were found
      
      // Mark the group as found
      await markGroupAsFound()
      
      // Wait a moment before triggering completion
      setTimeout(() => {
        onComplete()
      }, 2000)
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
        <CardTitle>Face Match Challenge</CardTitle>
        <CardDescription>
          Take a photo with a friend to complete this challenge
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
            <p>Challenge completed. Moving to the next step...</p>
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