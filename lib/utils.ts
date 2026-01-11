import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

// Format weight based on user preference
export function formatWeight(weightLbs: number, units: 'imperial' | 'metric' = 'imperial'): string {
  if (units === 'metric') {
    const kg = weightLbs * 0.453592;
    return `${kg.toFixed(1)} kg`;
  }
  return `${weightLbs} lbs`;
}

// Convert weight between units
export function convertWeight(
  value: number,
  from: 'imperial' | 'metric',
  to: 'imperial' | 'metric'
): number {
  if (from === to) return value;
  if (from === 'imperial' && to === 'metric') {
    return value * 0.453592;
  }
  return value / 0.453592;
}

// Format distance based on user preference
export function formatDistance(meters: number, units: 'imperial' | 'metric' = 'imperial'): string {
  if (units === 'metric') {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters} m`;
  }
  const miles = meters * 0.000621371;
  if (miles >= 1) {
    return `${miles.toFixed(2)} mi`;
  }
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

// Format duration in seconds to human readable
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format duration in minutes
export function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${minutes} min`;
}

// Format pace (min/km or min/mile)
export function formatPace(
  metersPerSecond: number,
  units: 'imperial' | 'metric' = 'imperial'
): string {
  if (metersPerSecond <= 0) return '--:--';

  const secondsPerMeter = 1 / metersPerSecond;
  let secondsPerUnit: number;

  if (units === 'metric') {
    secondsPerUnit = secondsPerMeter * 1000; // seconds per km
  } else {
    secondsPerUnit = secondsPerMeter * 1609.34; // seconds per mile
  }

  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}/${units === 'metric' ? 'km' : 'mi'}`;
}

// Format watts per kg
export function formatWattsPerKg(watts: number, weightKg: number): string {
  if (!weightKg || weightKg <= 0) return `${watts}W`;
  const wpk = watts / weightKg;
  return `${wpk.toFixed(2)} W/kg`;
}

// Format large numbers (e.g., volume)
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

// Format date for display
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;

  if (isToday(d)) {
    return 'Today';
  }
  if (isYesterday(d)) {
    return 'Yesterday';
  }
  return format(d, 'MMM d, yyyy');
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

// Calculate Epley E1RM
export function calculateE1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

// Calculate total volume (for multiple sets)
export function calculateVolume(weight: number, reps: number, sets: number = 1): number {
  return weight * reps * sets;
}

// Calculate volume for a single set (handles null values)
export function calculateSetVolume(weight: number | null | undefined, reps: number | null | undefined): number {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  return weight * reps;
}

// Calculate percentage of 1RM
export function calculatePercentage1RM(weight: number, oneRepMax: number): number {
  if (!oneRepMax || oneRepMax <= 0) return 0;
  return Math.round((weight / oneRepMax) * 100);
}

// Get weight for target percentage of 1RM
export function getWeightForPercentage(oneRepMax: number, percentage: number): number {
  return Math.round((oneRepMax * percentage) / 100);
}

// Parse tempo string (e.g., "3-0-1-0" = 3 sec eccentric, 0 pause, 1 sec concentric, 0 pause)
export function parseTempo(tempo: string): {
  eccentric: number;
  pause1: number;
  concentric: number;
  pause2: number;
} {
  const parts = tempo.split('-').map(Number);
  return {
    eccentric: parts[0] || 0,
    pause1: parts[1] || 0,
    concentric: parts[2] || 0,
    pause2: parts[3] || 0,
  };
}

// Calculate time under tension from tempo and reps
export function calculateTUT(tempo: string, reps: number): number {
  const { eccentric, pause1, concentric, pause2 } = parseTempo(tempo);
  return (eccentric + pause1 + concentric + pause2) * reps;
}

// Generate RPE description
export function getRPEDescription(rpe: number): string {
  const descriptions: Record<number, string> = {
    6: 'Very light, could do many more reps',
    7: 'Light, 3+ reps in reserve',
    8: 'Moderate, 2 reps in reserve',
    9: 'Hard, 1 rep in reserve',
    10: 'Maximum effort, could not do another rep',
  };
  return descriptions[Math.round(rpe)] || '';
}

// Validate RPE value
export function isValidRPE(rpe: number): boolean {
  return rpe >= 1 && rpe <= 10;
}

// Get heart rate zone (based on percentage of max HR)
export function getHRZone(hr: number, maxHR: number): number {
  if (!maxHR || maxHR <= 0) return 0;
  const percentage = (hr / maxHR) * 100;

  if (percentage < 60) return 1; // Recovery
  if (percentage < 70) return 2; // Aerobic base
  if (percentage < 80) return 3; // Aerobic development
  if (percentage < 90) return 4; // Threshold
  return 5; // VO2 max
}

// Get HR zone name
export function getHRZoneName(zone: number): string {
  const names: Record<number, string> = {
    1: 'Recovery',
    2: 'Zone 2 (Aerobic)',
    3: 'Zone 3 (Tempo)',
    4: 'Zone 4 (Threshold)',
    5: 'Zone 5 (VO2 Max)',
  };
  return names[zone] || 'Unknown';
}

// Calculate Watts/kg
export function calculateWattsPerKg(watts: number, weightKg: number): number {
  if (!weightKg || weightKg <= 0) return 0;
  return Number((watts / weightKg).toFixed(2));
}

// Generate UUID (for offline scenarios)
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
