"use client";

import { User } from "./supabase";

const USER_STORAGE_KEY = "app_user";

export interface StoredUser extends User {
  loginTimestamp: number;
}

/**
 * Store user data in localStorage
 */
export function storeUser(user: User): void {
  if (typeof window === "undefined") return;
  
  const storedUser: StoredUser = {
    ...user,
    loginTimestamp: Date.now()
  };
  
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(storedUser));
}

/**
 * Retrieve user data from localStorage
 */
export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  
  const userData = localStorage.getItem(USER_STORAGE_KEY);
  if (!userData) return null;
  
  try {
    return JSON.parse(userData) as StoredUser;
  } catch (error) {
    console.error("Error parsing stored user data:", error);
    return null;
  }
}

/**
 * Check if the user is logged in and if the session is still valid
 * @param maxAgeMs Maximum session age in milliseconds (default: 30 days)
 */
export function isUserLoggedIn(maxAgeMs = 30 * 24 * 60 * 60 * 1000): boolean {
  const user = getStoredUser();
  if (!user) return false;
  
  const now = Date.now();
  const sessionAge = now - user.loginTimestamp;
  
  return sessionAge < maxAgeMs;
}

/**
 * Remove user data from localStorage
 */
export function logoutUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_STORAGE_KEY);
} 