import { NextRequest, NextResponse } from 'next/server';
import AWS from 'aws-sdk';
require('dotenv').config();
// Configure AWS Rekognition
const rekognition = new AWS.Rekognition({
  accessKeyId: process.env.AMAZON_DEV_ACCESS_KEY_ID,
  secretAccessKey: process.env.AMAZON_DEV_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

// Helper function to extract base64 data regardless of format
function extractBase64FromString(dataString: string): Buffer {
  // Check if the string is already just base64 data without a data URI prefix
  if (!dataString.includes(',') && !dataString.includes(';base64,')) {
    return Buffer.from(dataString, 'base64');
  }
  
  // If it has a data URI prefix (e.g., data:image/jpeg;base64,)
  const base64Data = dataString.split(';base64,').pop() || '';
  return Buffer.from(base64Data, 'base64');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userImage, friendImage } = body;

    // Validate request body
    if (!userImage || !friendImage) {
      return NextResponse.json({ 
        success: false, 
        message: 'Both userImage and friendImage are required' 
      }, { status: 400 });
    }

    // Extract base64 data properly
    const userImageBuffer = extractBase64FromString(userImage);
    const friendImageBuffer = extractBase64FromString(friendImage);
    
    // Validate that buffers have content
    if (userImageBuffer.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'User image is empty or invalid'
      }, { status: 400 });
    }
    
    if (friendImageBuffer.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Friend image is empty or invalid'
      }, { status: 400 });
    }

    console.log(`User image buffer size: ${userImageBuffer.length} bytes`);
    console.log(`Friend image buffer size: ${friendImageBuffer.length} bytes`);

    // Set up the parameters for face comparison
    const params = {
      SimilarityThreshold: 70, // Lower threshold for more flexibility
      SourceImage: {
        Bytes: userImageBuffer
      },
      TargetImage: {
        Bytes: friendImageBuffer
      }
    };

    // Call Rekognition to compare the faces
    const result = await rekognition.compareFaces(params).promise();
    
    // Check if faces match
    if (result.FaceMatches && result.FaceMatches.length > 0) {
      // Get the highest confidence match
      const bestMatch = result.FaceMatches.reduce(
        (prev, current) => ((prev.Similarity || 0) > (current.Similarity || 0)) ? prev : current
      );
      
      const similarity = bestMatch.Similarity || 0;
      
      return NextResponse.json({
        success: true,
        similarity: similarity,
        message: `Face match found with ${similarity.toFixed(2)}% confidence`
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'No matching faces found'
      });
    }
  } catch (error: any) {
    console.error('Error in face comparison:', error);
    return NextResponse.json({
      success: false,
      message: 'An error occurred during face comparison',
      error: error.message
    }, { status: 500 });
  }
} 