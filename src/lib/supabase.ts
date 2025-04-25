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
    .select('game_has_started, checkpoint1_has_completed, checkpoint2_has_completed, checkpoint3_has_completed')
    .single();
  
  if (error || !data) {
    console.error('Error fetching game status:', error);
    return null;
  }
  
  return data as GameStatus;
}

export async function updateCheckpointStatus(checkpointNum: 1 | 2 | 3): Promise<boolean> {
  const field = `checkpoint${checkpointNum}_has_completed`;
  
  try {
    const { error } = await supabase
      .from('globals')
      .update({ [field]: true })
      .eq('id', 1);  // Assuming we have a single row with id 1 for global state
    
    if (error) {
      console.error('Error updating checkpoint status:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating checkpoint status:', error);
    return false;
  }
}

// Removed createUser and updateUser functions as we're directly accessing the table 