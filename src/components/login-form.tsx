"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { checkUserExists, User, supabase } from "@/lib/supabase";
import { useUser } from "@/contexts/user-context";
import { CameraCapture } from "@/components/camera-capture";
import { ensureSelfiesBucketExists } from "@/lib/storage-setup";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Initial schema only requires email format, not validation
const emailOnlySchema = z.object({
  email: z.string().min(1, { message: "Email is required" }),
  name: z.string().optional(),
  major: z.string().optional(),
  selfie_url: z.string().optional(),
});

// Full schema with validation for both fields
const fullSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  major: z.string().min(1, { message: "Major is required" }),
  selfie_url: z.string().min(1, { message: "A selfie is required" }),
});

type UserFormValues = z.infer<typeof emailOnlySchema>;

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [userExists, setUserExists] = useState<User | null>(null);
  const [showNameField, setShowNameField] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState("");
  const [isBucketReady, setIsBucketReady] = useState(false);
  const router = useRouter();
  const { login } = useUser();

  // Check if the selfies bucket exists
  useEffect(() => {
    async function setupBucket() {
      try {
        await ensureSelfiesBucketExists();
        setIsBucketReady(true);
      } catch (error) {
        console.error("Error setting up selfies bucket:", error);
      }
    }

    if (showNameField && !isBucketReady) {
      setupBucket();
    }
  }, [showNameField, isBucketReady]);

  // Use less strict validation for initial state
  const form = useForm<UserFormValues>({
    resolver: zodResolver(showNameField ? fullSchema : emailOnlySchema),
    defaultValues: {
      email: "",
      name: "",
      major: "",
      selfie_url: "",
    },
  });

  // Handle selfie capture
  const handleSelfieCapture = (url: string) => {
    setSelfieUrl(url);
    form.setValue("selfie_url", url);
    form.clearErrors("selfie_url");
    setShowCamera(false);
  };

  // Handle camera button click
  const handleCameraClick = async () => {
    if (!isBucketReady) {
      setIsLoading(true);
      try {
        await ensureSelfiesBucketExists();
        setIsBucketReady(true);
        setShowCamera(true);
      } catch (error) {
        console.error("Error preparing camera:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      setShowCamera(true);
    }
  };

  async function onSubmit(data: UserFormValues) {
    // For initial email check, ensure it's a valid email
    if (!showNameField) {
      const emailValue = data.email.trim();
      if (!emailValue || !emailValue.includes('@')) {
        form.setError("email", { 
          type: "manual", 
          message: "Please enter a valid email address" 
        });
        return;
      }
      
      await checkEmailAndProceed(emailValue);
    } else {
      // We're in registration mode, validate name and major
      if (!data.name || data.name.trim().length < 2) {
        form.setError("name", { 
          type: "manual", 
          message: "Name is required and must be at least 2 characters" 
        });
        return;
      }
      
      if (!data.major || data.major.trim().length < 1) {
        form.setError("major", { 
          type: "manual", 
          message: "Major is required" 
        });
        return;
      }
      
      // Validate selfie
      if (!selfieUrl) {
        form.setError("selfie_url", {
          type: "manual",
          message: "Please take a selfie before continuing"
        });
        return;
      }
      
      await registerUser(data);
    }
  }
  
  async function checkEmailAndProceed(email: string) {
    setIsLoading(true);
    setIsChecking(true);
    
    try {
      const user = await checkUserExists(email);
      if (user) {
        // User exists, proceed to dashboard
        setUserExists(user);
        login(user);
        router.push('/dashboard');
      } else {
        // User doesn't exist, show name field for registration
        setUserExists(null);
        setShowNameField(true);
      }
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setIsLoading(false);
      setIsChecking(false);
    }
  }
  
  async function registerUser(data: UserFormValues) {
    setIsLoading(true);
    
    try {
      // Direct insert into user table
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{ 
          email: data.email, 
          name: data.name as string, // We validated this is not empty above
          major: data.major,
          selfie_url: selfieUrl || data.selfie_url,
        }])
        .select()
        .single();
          
      if (error) {
        console.error('Error creating user:', error);
        throw new Error("Failed to create user");
      }
      
      if (newUser) {
        console.log("Created new user:", newUser);
        // Store new user in context
        login(newUser);
        // Navigate to dashboard
        router.push('/dashboard');
      }
    } catch (error) {
      console.error("Error in registration:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome</CardTitle>
        <CardDescription>
          {showNameField 
            ? "Please complete your profile to continue" 
            : "Enter your email to continue"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showCamera ? (
          <div className="space-y-4">
            <CameraCapture onCapture={handleSelfieCapture} />
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setShowCamera(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="you@example.com" 
                        {...field} 
                        disabled={isLoading || showNameField}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showNameField && (
                <>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your name" 
                            {...field} 
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="major"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Major</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your major" 
                            {...field} 
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="selfie_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selfie <span className="text-red-500">*</span></FormLabel>
                        <div className="flex flex-col space-y-2">
                          {selfieUrl ? (
                            <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                              <img 
                                src={selfieUrl} 
                                alt="Your selfie" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                              <p className="text-muted-foreground text-center px-4">
                                A selfie is required to complete registration
                              </p>
                            </div>
                          )}
                          <Button
                            type="button"
                            variant={selfieUrl ? "outline" : "default"}
                            className="w-full"
                            onClick={handleCameraClick}
                            disabled={isLoading}
                          >
                            {selfieUrl ? "Change Selfie" : "Add Selfie"}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <Button 
                className="w-full" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading 
                  ? isChecking 
                    ? "Checking..." 
                    : "Processing..." 
                  : "Continue"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
} 