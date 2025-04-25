import { getGameLocation, setGameLocation, getGameHints, setGameHints, GameLocation } from './supabase';

export interface Location {
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

export async function generateHints(location: Location): Promise<Hint[]> {
  // First try to get existing hints from database
  const existingHints = await getGameHints();
  if (existingHints) {
    return existingHints;
  }

  const hints: Hint[] = [];

  // Add introductory hint
  hints.push({
    type: 'riddle',
    content: "I am made by all of your team answers. What am I?",
    answer: "The final location"
  });

  // Generate aisle hint (scramble)
  const aisleHint = generateScrambleHint(location.aisle.toString());
  const aisleWord = numberToWords(location.aisle);
  hints.push({
    type: 'scramble',
    content: `Unscramble these letters to find the aisle number: ${aisleHint}`,
    answer: aisleWord
  });

  // Generate section hint (multiple choice)
  const sectionHint = generateMultipleChoiceHint(location.section);
  hints.push({
    type: 'multiple-choice',
    content: sectionHint,
    answer: location.section
  });

  // Generate floor hint (riddle)
  const floorHint = generateFloorHint(location.floor);
  hints.push({
    type: 'riddle',
    content: floorHint,
    answer: location.floor.toString()
  });

  // Generate building hint (riddle)
  const buildingHint = generateBuildingHint(location.building);
  hints.push({
    type: 'riddle',
    content: buildingHint,
    answer: location.building
  });

  // Store the hints
  await setGameHints(hints);

  return hints;
}

function numberToWords(num: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

  if (num === 0) return 'zero';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one ? '-' + ones[one] : '');
  }
  return num.toString(); // Fallback for numbers >= 100
}

function generateScrambleHint(number: string): string {
  // Convert number to words
  const num = parseInt(number);
  const word = numberToWords(num);
  
  // Split into letters and remove hyphens
  const letters = word.replace(/-/g, '').split('');
  
  // Shuffle the letters
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  
  return letters.join('');
}

function generateMultipleChoiceHint(section: string): string {
  const options = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  
  // Remove the correct answer from options
  const otherOptions = options.filter(letter => letter !== section);
  
  // Shuffle and take 3 random options
  for (let i = otherOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherOptions[i], otherOptions[j]] = [otherOptions[j], otherOptions[i]];
  }
  const wrongOptions = otherOptions.slice(0, 3);
  
  // Add the correct answer and shuffle all options
  const allOptions = [...wrongOptions, section];
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
  }
  
  return `Which letter comes after ${String.fromCharCode(section.charCodeAt(0) - 1)} in the alphabet?\n` +
         `a) ${allOptions[0]}\n` +
         `b) ${allOptions[1]}\n` +
         `c) ${allOptions[2]}\n` +
         `d) ${allOptions[3]}`;
}

function generateFloorHint(floor: number): string {
  const riddles = [
    `I am the number that comes after ${floor - 1} but before ${floor + 1}. What am I?`,
    `If you add ${floor} to 0, you get me. What am I?`,
    `I am the number of floors you need to climb to reach floor ${floor}. What am I?`,
    `I am the number of times you need to press the elevator button to reach floor ${floor}. What am I?`
  ];
  
  return riddles[Math.floor(Math.random() * riddles.length)];
}

function generateBuildingHint(building: string): string {
  const riddles = [
    `I am a place where ${building.toLowerCase().includes('library') ? 'books are kept and knowledge is shared' : 
      building.toLowerCase().includes('science') ? 'experiments happen and discoveries are made' :
      building.toLowerCase().includes('engineering') ? 'machines are built and problems are solved' :
      building.toLowerCase().includes('arts') ? 'creativity flows and masterpieces are made' :
      building.toLowerCase().includes('business') ? 'future leaders are trained and ideas are born' :
      building.toLowerCase().includes('student') ? 'students gather and memories are made' :
      building.toLowerCase().includes('dormitory') ? 'students live and friendships grow' :
      building.toLowerCase().includes('cafeteria') ? 'food is served and conversations happen' :
      building.toLowerCase().includes('gymnasium') ? 'sports are played and fitness is achieved' :
      'important decisions are made and administration happens'}. What am I?`,
    `Find the ${building}.`,
    `Look for the building that ${building.toLowerCase().includes('library') ? 'contains thousands of books' :
      building.toLowerCase().includes('science') ? 'has laboratories' :
      building.toLowerCase().includes('engineering') ? 'has workshops' :
      building.toLowerCase().includes('arts') ? 'has studios' :
      building.toLowerCase().includes('business') ? 'has lecture halls' :
      building.toLowerCase().includes('student') ? 'has common areas' :
      building.toLowerCase().includes('dormitory') ? 'has student rooms' :
      building.toLowerCase().includes('cafeteria') ? 'serves food' :
      building.toLowerCase().includes('gymnasium') ? 'has sports facilities' :
      'has offices'}.`
  ];
  
  return riddles[Math.floor(Math.random() * riddles.length)];
} 