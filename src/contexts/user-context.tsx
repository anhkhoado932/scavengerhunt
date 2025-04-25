"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/lib/supabase";
import { 
  getStoredUser, 
  isUserLoggedIn, 
  logoutUser, 
  storeUser, 
  StoredUser 
} from "@/lib/user-storage";

interface UserContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export const useUser = () => useContext(UserContext);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from storage on initial render
  useEffect(() => {
    const loadUser = () => {
      setIsLoading(true);
      try {
        if (isUserLoggedIn()) {
          const storedUser = getStoredUser();
          if (storedUser) {
            // Extract user data without the timestamp
            const { loginTimestamp, ...userData } = storedUser;
            setUser(userData);
          }
        }
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = (userData: User) => {
    storeUser(userData);
    setUser(userData);
  };

  const logout = () => {
    logoutUser();
    setUser(null);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
} 