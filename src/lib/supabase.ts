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
  checkpoint1_has_completed?: boolean;
  checkpoint2_has_completed?: boolean;
  checkpoint3_has_completed?: boolean;
}

export interface GameLocation {
  building: string;
  floor: number;
  aisle: number;
  section: string;
}

export interface Hint {
  type: 'scramble' | 'multiple-choice' | 'picture' | 'riddle';
  content: string;
  answer: string;
}

export interface HintAssignment {
  userId: string;
  hintIndex: number;
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
  try {
    // Verify Supabase client is initialized
    if (!supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    // First try to get the existing game status for id = 2
    const { data, error } = await supabase
      .from('globals')
      .select('game_has_started')
      .eq('id', 2)
      .single();
    
    // If we get a "no rows" error, create the initial row
    if (error?.code === 'PGRST116') {
      console.log('No game status found for id 2, creating initial row...');
      
      const defaultStatus = {
        id: 2,
        game_has_started: false
      };

      const { error: insertError } = await supabase
        .from('globals')
        .insert([defaultStatus]);
      
      if (insertError) {
        console.error('Error creating initial game status:', JSON.stringify(insertError, null, 2));
        return null;
      }

      // Return the default status
      return {
        game_has_started: false
      };
    }
    
    // If we get any other error, log it and return null
    if (error) {
      console.error('Error fetching game status:', JSON.stringify(error, null, 2));
      return null;
    }
    
    // If we have data, return it with proper boolean conversion
    if (data) {
      return {
        game_has_started: Boolean(data.game_has_started)
      };
    }
    
    // This should never happen, but just in case
    console.error('Unexpected state: no error but no data either');
    return null;
  } catch (error) {
    console.error('Unexpected error in getGameStatus:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return null;
  }
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

export async function getGameHints(): Promise<Hint[] | null> {
  try {
    const { data, error } = await supabase
      .from('globals')
      .select('hints')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.error('Error getting game hints:', error);
      return null;
    }
    
    return data?.hints || null;
  } catch (error) {
    console.error('Error getting game hints:', error);
    return null;
  }
}

export async function setGameHints(hints: Hint[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('globals')
      .update({ hints })
      .eq('id', 1);
    
    if (error) {
      console.error('Error setting game hints:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error setting game hints:', error);
    return false;
  }
}

export async function getHintAssignment(userId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('globals')
      .select('hint_assignments')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.error('Error getting hint assignments:', error);
      return null;
    }
    
    const assignments: HintAssignment[] = data?.hint_assignments || [];
    const assignment = assignments.find(a => a.userId === userId);
    return assignment?.hintIndex ?? null;
  } catch (error) {
    console.error('Error getting hint assignments:', error);
    return null;
  }
}

export async function setHintAssignments(assignments: HintAssignment[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('globals')
      .update({ hint_assignments: assignments })
      .eq('id', 1);
    
    if (error) {
      console.error('Error setting hint assignments:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error setting hint assignments:', error);
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

export async function markHintCompleted(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('globals')
      .select('completed_hints')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.error('Error getting completed hints:', error);
      return false;
    }

    const completedHints: CompletedHint[] = data?.completed_hints || [];
    const existingIndex = completedHints.findIndex(h => h.userId === userId);
    
    if (existingIndex === -1) {
      completedHints.push({ userId, completed: true });
    } else {
      completedHints[existingIndex].completed = true;
    }

    const { error: updateError } = await supabase
      .from('globals')
      .update({ completed_hints: completedHints })
      .eq('id', 1);
    
    if (updateError) {
      console.error('Error updating completed hints:', updateError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error marking hint completed:', error);
    return false;
  }
}

export async function areAllHintsCompleted(teamMembers: TeamMember[]): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('globals')
      .select('completed_hints')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.error('Error getting completed hints:', error);
      return false;
    }

    const completedHints: CompletedHint[] = data?.completed_hints || [];
    const teamMemberIds = teamMembers.map(m => m.id);
    
    return teamMemberIds.every(id => 
      completedHints.some(h => h.userId === id && h.completed)
    );
  } catch (error) {
    console.error('Error checking completed hints:', error);
    return false;
  }
}

// Removed createUser and updateUser functions as we're directly accessing the table 