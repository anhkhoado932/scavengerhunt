import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id?: string;
  email: string;
  name: string;
  major?: string;
  selfie_url?: string;
  created_at?: string;
}

export interface GameStatus {
  game_has_started: boolean;
}

export interface GlobalsData {
  id: number;
  game_has_started: boolean;
}

// New interface for user group
export interface UserGroup {
  id: number;
  user_id_1: string | null;
  user_id_2: string | null;
  user_id_3: string | null;
  user_id_4: string | null;
  photo_url?: string | null;
  found: boolean;
}

export async function checkUserExists(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as User;
}

export async function getGameStatus(): Promise<GameStatus | null> {
  const { data, error } = await supabase
    .from('globals')
    .select('game_has_started')
    .single();
  
  if (error || !data) {
    console.error('Error fetching game status:', error);
    return null;
  }
  
  return data as GameStatus;
}

// New function to fetch user's group
export async function getUserGroup(userId: string): Promise<UserGroup | null> {
  try {
    // Check if user is in any group (any of the user_id fields)
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId},user_id_3.eq.${userId},user_id_4.eq.${userId}`)
      .single();
    
    if (error || !data) {
      console.error('Error fetching user group:', error);
      return null;
    }
    
    return data as UserGroup;
  } catch (error) {
    console.error('Error fetching user group:', error);
    return null;
  }
}

// Removed createUser and updateUser functions as we're directly accessing the table 