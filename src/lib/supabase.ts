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
  user1_question: number | null;
  user2_question: number | null;
  user3_question: number | null;
  user4_question: number | null;
  photo_url?: string | null;
  found: boolean;
  location_is_solved: boolean;
}

export interface GameLocation {
  building: string;
  floor: number;
  aisle: number;
  section: string;
}

export interface TeamMember {
  id: string;
  name: string;
}

export interface CompletedHint {
  userId: string;
  completed: boolean;
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

  return data;
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

export async function updateGroupFoundStatus(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .update({ found: true })
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId},user_id_3.eq.${userId},user_id_4.eq.${userId}`)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating group found status:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating group found status:', error);
    return false;
  }
}

export async function getGameLocation(): Promise<GameLocation | null> {
  try {
    const { data, error } = await supabase
      .from('globals')
      .select('location')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.error('Error getting game location:', error);
      return null;
    }
    
    return data?.location || null;
  } catch (error) {
    console.error('Error getting game location:', error);
    return null;
  }
}

export async function setGameLocation(location: GameLocation): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('globals')
      .update({ location })
      .eq('id', 1);
    
    if (error) {
      console.error('Error setting game location:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error setting game location:', error);
    return false;
  }
}

export async function getTeamMembers(userId: string): Promise<TeamMember[]> {
  try {
    // First, find the group that contains this user
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId},user_id_3.eq.${userId},user_id_4.eq.${userId}`)
      .single();
    
    if (groupError || !group) {
      console.error('Error finding group:', groupError);
      return [];
    }

    // Get all user IDs from the group
    const userIds = [
      group.user_id_1,
      group.user_id_2,
      group.user_id_3,
      group.user_id_4
    ].filter(id => id !== null);

    // Get user details for all team members
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);
    
    if (usersError || !users) {
      console.error('Error getting team members:', usersError);
      return [];
    }

    return users.map(user => ({
      id: user.id,
      name: user.name
    }));
  } catch (error) {
    console.error('Error getting team members:', error);
    return [];
  }
}

// Removed createUser and updateUser functions as we're directly accessing the table 