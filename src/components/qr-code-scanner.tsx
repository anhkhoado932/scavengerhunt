"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import jsQR from "jsqr";

interface QRCodeScannerProps {
  onScan?: (data: string) => void;
}

export function QRCodeScanner({ onScan }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isCorrectQR, setIsCorrectQR] = useState<boolean | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Start camera when component mounts
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for the video to be ready
          await new Promise((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = resolve;
            }
          });
          // Start playing the video
          await videoRef.current.play();
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive]);

  // QR Code detection
  useEffect(() => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current || scanResult) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      console.error("Failed to get canvas context");
      return;
    }

    function scanQRCode() {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context?.getImageData(0, 0, canvas.width, canvas.height);

        if (imageData) {
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            // Process QR code data
            const qrData = code.data;
            setScanResult(qrData);
            
            // Check if it's the correct QR code - case sensitive exact match
            const expectedText = "This is the final checkpoint";
            const isCorrect = qrData === expectedText;
            setIsCorrectQR(isCorrect);
            
            // Only call onScan for the correct QR code
            if (isCorrect && onScan) {
              onScan(qrData);
            }
            
            // Stop the camera after successful scan
            setIsCameraActive(false);
            return;
          }
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
    }

    animationFrameRef.current = requestAnimationFrame(scanQRCode);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive, onScan, scanResult]);

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
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });
        await videoRef.current.play();
      }
    } catch (error) {
      console.error("Error switching camera:", error);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setIsCorrectQR(null);
    setIsCameraActive(true);
  };

  return (
    <div className="flex flex-col items-center w-full space-y-4">
      {/* Camera display or result */}
      <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
        {scanResult ? (
          <div className={`text-center p-6 ${isCorrectQR ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            <h3 className="text-xl font-semibold mb-2">
              {isCorrectQR ? "Congratulations!" : "Wrong QR Code"}
            </h3>
            <p className="mb-4">
              {isCorrectQR ? "This is the final checkpoint." : "You have found the wrong QR."}
            </p>
            <p className="text-xs mb-4 text-gray-500">
              Detected content: "{scanResult}"
            </p>
            <Button onClick={resetScanner}>Scan Again</Button>
          </div>
        ) : isCameraActive ? (
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
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-4 border-red-500 rounded-lg animate-pulse" />
              </div>
            </>
          )
        ) : (
          <div className="text-center p-4">
            <p className="text-muted-foreground">
              Camera preview will appear here
            </p>
          </div>
        )}
      </div>

      {/* Hidden canvas for QR code detection */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex w-full gap-2">
        {!isCameraActive && !scanResult && (
          <Button 
            type="button" 
            className="w-full" 
            onClick={() => setIsCameraActive(true)}
          >
            Start Camera
          </Button>
        )}

        {isCameraActive && !cameraError && (
          <Button
            type="button"
            variant="outline"
            className="w-12 flex-none"
            onClick={switchCamera}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12 A9 9 0 0 0 3 9"></path><path d="M3 9l6 0l0 -6"></path><path d="M21 12 A9 9 0 0 1 3 15"></path><path d="M3 15l0 -6"></path></svg>
          </Button>
        )}
      </div>
    </div>
  );
}