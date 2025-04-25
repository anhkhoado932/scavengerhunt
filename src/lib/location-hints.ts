import { getGameLocation, setGameLocation, GameLocation } from './supabase';
import { supabase } from './supabase';

export interface Location {
  building: string;
  floor: number;
  aisle: number;
  section: string;
}

const commonBuildings = [
  'Library',
  // 'Science Building',
  // 'Engineering Hall',
  // 'Arts Center',
  // 'Business School',
  // 'Student Center',
  // 'Dormitory',
  // 'Cafeteria',
  // 'Gymnasium',
  // 'Administration Building'
];

export async function generateRandomLocation(): Promise<Location> {
  // First try to get existing location from database
  const existingLocation = await getGameLocation();
  if (existingLocation) {
    return existingLocation;
  }

  // If no location exists, generate a new one and store it
  const building = commonBuildings[Math.floor(Math.random() * commonBuildings.length)];
  const floor = Math.floor(Math.random() * 3) + 1; // 1-3 floors
  const aisle = Math.floor(Math.random() * 20) + 1; // 1-20 aisles
  const section = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z

  const newLocation = {
    building,
    floor,
    aisle,
    section
  };

  // Store the new location
  await setGameLocation(newLocation);

  return newLocation;
} 