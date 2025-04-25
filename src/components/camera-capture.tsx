"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface CameraCaptureProps {
  onCapture: (url: string) => void;
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Start camera when component mounts
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        setCameraError("Could not access your camera. Please ensure you've given permission.");
      }
    }

    if (isCameraActive) {
      setupCamera();
    }

    // Cleanup function to stop camera when component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraActive]);

  // Function to capture the current frame
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to data URL
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(imageDataUrl);

      // Stop camera after capturing
      if (video.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
      setIsCameraActive(false);
    }
  };

  // Function to upload the captured image to Supabase Storage
  const uploadSelfie = async () => {
    if (!capturedImage) return;

    setIsUploading(true);
    try {
      // Convert data URL to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      // Generate a unique filename using timestamp and random string
      const fileName = `selfie_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.jpg`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from("selfies")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
        });

      if (error) {
        throw error;
      }

      // Get public URL for the uploaded image
      const { data: publicUrlData } = supabase.storage
        .from("selfies")
        .getPublicUrl(fileName);

      // Call the onCapture callback with the URL
      onCapture(publicUrlData.publicUrl);
    } catch (error) {
      console.error("Error uploading selfie:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Function to retry (reset and start over)
  const retryCapture = () => {
    setCapturedImage(null);
    setIsCameraActive(true);
  };

  // Try to use a different camera (for mobile)
  const switchCamera = async () => {
    if (videoRef.current?.srcObject instanceof MediaStream) {
      // Stop current camera stream
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    
    try {
      const currentFacingMode = isCameraActive ? "user" : "environment";
      const newFacingMode = currentFacingMode === "user" ? "environment" : "user";
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error switching camera:", error);
    }
  };

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      {/* Camera or captured image display */}
      <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
        {isCameraActive ? (
          cameraError ? (
            <div className="text-center p-4 text-red-500">
              <p>{cameraError}</p>
              <Button 
                type="button" 
                className="mt-4" 
                onClick={() => setIsCameraActive(true)}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )
        ) : capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured selfie"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-4">
            <p className="text-muted-foreground">
              Camera preview will appear here
            </p>
          </div>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex w-full gap-2 flex-wrap">
        {!isCameraActive && !capturedImage && (
          <Button 
            type="button" 
            className="w-full" 
            onClick={() => setIsCameraActive(true)}
          >
            Start Camera
          </Button>
        )}

        {isCameraActive && !cameraError && (
          <>
            <Button 
              type="button" 
              className="flex-1" 
              onClick={capturePhoto}
            >
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-12 flex-none"
              onClick={switchCamera}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12 A9 9 0 0 0 3 9"></path><path d="M3 9l6 0l0 -6"></path><path d="M21 12 A9 9 0 0 1 3 15"></path><path d="M3 15l0 -6"></path></svg>
            </Button>
          </>
        )}

        {capturedImage && (
          <>
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1" 
              onClick={retryCapture}
              disabled={isUploading}
            >
              Retake
            </Button>
            <Button 
              type="button" 
              className="flex-1" 
              onClick={uploadSelfie}
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Use Photo"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
} 