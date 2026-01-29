"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Zod validation schema
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Helper function to translate Supabase errors to user-friendly messages
function getErrorMessage(error: string): string {
  const errorLower = error.toLowerCase();

  if (errorLower.includes("invalid login credentials") || errorLower.includes("invalid email or password")) {
    return "Invalid email or password. Please try again.";
  }
  if (errorLower.includes("email not confirmed")) {
    return "Please confirm your email address before logging in.";
  }
  if (errorLower.includes("too many requests")) {
    return "Too many login attempts. Please wait a few minutes and try again.";
  }
  if (errorLower.includes("network") || errorLower.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }

  return "An error occurred during login. Please try again.";
}

function LoginForm() {
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Check for error query parameter (e.g., from middleware)
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "invalid_session") {
      setError("Your session is invalid. Please log in again.");
    }
  }, [searchParams]);

  const onSubmit = async (formData: LoginFormData) => {
    setError("");

    console.log("=== LOGIN ATTEMPT ===");
    console.log("Email:", formData.email);
    console.log("Password length:", formData.password.length);

    try {
      const supabase = createClient();
      console.log("Supabase client created");
      console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log("Anon key exists:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      console.log("SignIn response received");
      console.log("Error:", signInError);
      console.log("Data:", data);

      if (signInError) {
        console.error("SignIn error:", signInError);
        setError(getErrorMessage(signInError.message));
        return;
      }

      if (data.user) {
        console.log("User logged in:", data.user.id);
        console.log("User metadata:", data.user.user_metadata);
        // Get user role and redirect to appropriate dashboard
        const role = data.user.user_metadata?.role || "employee";
        console.log("Redirecting to:", `/${role}/dashboard`);
        router.push(`/${role}/dashboard`);
        router.refresh();
      }
    } catch (err) {
      console.error("Unexpected error during login:", err);
      setError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with logo */}
      <header className="bg-primary text-primary-foreground py-4 px-4 text-center border-b-[5px] border-accent flex items-center justify-center">
        <Image
          src="/albus-logo.png?v=1"
          alt="ALBUS Time and Attendance System"
          width={316}
          height={57}
          priority
          unoptimized
          style={{ width: '80%', height: 'auto', maxWidth: '320px' }}
        />
      </header>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-2xl text-primary font-medium">
              User Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-primary font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                  className="h-11"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-primary font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  disabled={isSubmitting}
                  className="h-11"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-base font-bold bg-accent hover:bg-accent/90"
              >
                {isSubmitting ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
