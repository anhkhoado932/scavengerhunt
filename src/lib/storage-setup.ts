"use client";

import { supabase } from "./supabase";

/**
 * Ensures that the 'selfies' storage bucket exists and is configured correctly
 */
export async function ensureSelfiesBucketExists(): Promise<void> {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error checking for selfies bucket:", listError);
      return;
    }
    
    const selfiesBucket = buckets?.find(bucket => bucket.name === "selfies");
    
    // If bucket doesn't exist, create it
    if (!selfiesBucket) {
      const { error: createError } = await supabase.storage.createBucket("selfies", {
        public: true, // Allow public access
        fileSizeLimit: 1024 * 1024 * 2, // 2MB limit
      });
      
      if (createError) {
        console.error("Error creating selfies bucket:", createError);
        return;
      }
      
      console.log("Created selfies bucket");
    }
    
    // Update bucket to be public if it exists but isn't already
    if (selfiesBucket && !selfiesBucket.public) {
      const { error: updateError } = await supabase.storage.updateBucket("selfies", {
        public: true,
      });
      
      if (updateError) {
        console.error("Error updating selfies bucket to public:", updateError);
      }
    }
  } catch (error) {
    console.error("Unexpected error setting up selfies bucket:", error);
  }
} 