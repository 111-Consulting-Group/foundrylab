/**
 * Week Allocation Logic
 *
 * Allocates different session types to days of the week
 * respecting running schedule constraints for hybrid athletes.
 *
 * Rules:
 * 1. No heavy legs on the day before or after hard runs (tempo/intervals)
 * 2. Zone 2 can stack with upper body lifting
 * 3. Rest days are sacred
 * 4. Hard runs need 48h recovery buffer
 */

import type {
  DayOfWeek,
  SessionType,
  WeeklyTargets,
  PlannedDay,
  RunningSchedule,
  RunType,
} from '@/types/coach';

// Day number mapping (Monday = 1, Sunday = 7)
export const DAY_NUMBERS: Record<DayOfWeek, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

export const DAY_NAMES: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

// Mapping run types to session types
const RUN_TYPE_TO_SESSION: Record<RunType, SessionType> = {
  easy_run: 'easy_run',
  tempo: 'tempo',
  intervals: 'intervals',
  long_run: 'long_run',
  recovery: 'easy_run',
};

// Which run types are considered "hard" (need recovery buffer)
const HARD_RUN_TYPES: RunType[] = ['tempo', 'intervals', 'long_run'];

interface AllocationResult {
  days: PlannedDay[];
  rationale: string;
  warnings: string[];
}

interface DaySlot {
  dayNumber: number;
  dayName: DayOfWeek;
  isAvailable: boolean;
  isRestDay: boolean;
  runSession?: SessionType;
  liftSession?: SessionType;
  isNearHardRun: boolean; // Day before or after a hard run
  focus?: string;
}

/**
 * Allocate sessions to days based on targets and running schedule
 */
export function allocateWeekSessions(
  targets: WeeklyTargets,
  runningSchedule?: RunningSchedule
): AllocationResult {
  const warnings: string[] = [];
  const rationale: string[] = [];

  // Initialize day slots
  const slots: DaySlot[] = DAY_NAMES.map((dayName, idx) => ({
    dayNumber: idx + 1,
    dayName,
    isAvailable: targets.availableDays.includes(dayName),
    isRestDay: false,
    isNearHardRun: false,
  }));

  // Step 1: Place running sessions from schedule
  if (runningSchedule && runningSchedule.days.length > 0) {
    runningSchedule.days.forEach((day, idx) => {
      const slot = slots.find((s) => s.dayName === day);
      if (slot) {
        const runType = runningSchedule.types[idx] || runningSchedule.types[0] || 'easy_run';
        slot.runSession = RUN_TYPE_TO_SESSION[runType];

        // Mark adjacent days if this is a hard run
        if (HARD_RUN_TYPES.includes(runType)) {
          const dayIndex = slots.indexOf(slot);
          if (dayIndex > 0) slots[dayIndex - 1].isNearHardRun = true;
          if (dayIndex < 6) slots[dayIndex + 1].isNearHardRun = true;
        }
      }
    });
    rationale.push(`Placed ${runningSchedule.days.length} running sessions from your schedule`);
  }

  // Step 2: Place rest days (prefer Sunday, then user preference)
  let restDaysPlaced = 0;
  const preferredRestDays: DayOfWeek[] = ['sunday', 'saturday', 'monday'];

  for (const restDay of preferredRestDays) {
    if (restDaysPlaced >= targets.restDays) break;
    const slot = slots.find((s) => s.dayName === restDay && !s.runSession);
    if (slot) {
      slot.isRestDay = true;
      restDaysPlaced++;
    }
  }

  // If we still need rest days, find any available slot
  if (restDaysPlaced < targets.restDays) {
    for (const slot of slots) {
      if (restDaysPlaced >= targets.restDays) break;
      if (!slot.runSession && !slot.isRestDay) {
        slot.isRestDay = true;
        restDaysPlaced++;
      }
    }
  }

  if (restDaysPlaced > 0) {
    rationale.push(`Scheduled ${restDaysPlaced} rest day${restDaysPlaced > 1 ? 's' : ''}`);
  }

  // Step 3: Place tempo/interval cardio sessions (need buffer from legs)
  const tempoCount = targets.tempoSessions || 0;
  const intervalCount = targets.intervalSessions || 0;

  // Find slots for hard cardio (not near other hard runs, not rest days)
  let tempoPlaced = 0;
  let intervalsPlaced = 0;

  for (const slot of slots) {
    if (tempoPlaced >= tempoCount) break;
    if (!slot.runSession && !slot.isRestDay && slot.isAvailable) {
      slot.runSession = 'tempo';
      // Mark adjacent days
      const idx = slots.indexOf(slot);
      if (idx > 0) slots[idx - 1].isNearHardRun = true;
      if (idx < 6) slots[idx + 1].isNearHardRun = true;
      tempoPlaced++;
    }
  }

  for (const slot of slots) {
    if (intervalsPlaced >= intervalCount) break;
    if (!slot.runSession && !slot.isRestDay && slot.isAvailable && !slot.isNearHardRun) {
      slot.runSession = 'intervals';
      const idx = slots.indexOf(slot);
      if (idx > 0) slots[idx - 1].isNearHardRun = true;
      if (idx < 6) slots[idx + 1].isNearHardRun = true;
      intervalsPlaced++;
    }
  }

  // Step 4: Place zone 2 cardio (flexible, can pair with upper body)
  const zone2Min = targets.zone2Sessions.min;
  const zone2Max = targets.zone2Sessions.max;
  const zone2Target = Math.ceil((zone2Min + zone2Max) / 2);
  let zone2Placed = 0;

  for (const slot of slots) {
    if (zone2Placed >= zone2Target) break;
    if (!slot.runSession && !slot.isRestDay && slot.isAvailable) {
      slot.runSession = 'zone2';
      zone2Placed++;
    }
  }

  if (zone2Placed > 0) {
    rationale.push(`Added ${zone2Placed} zone 2 cardio session${zone2Placed > 1 ? 's' : ''}`);
  }

  // Step 5: Place lifting sessions
  const hypertrophyMin = targets.hypertrophySessions.min;
  const hypertrophyMax = targets.hypertrophySessions.max;
  const hypertrophyTarget = Math.ceil((hypertrophyMin + hypertrophyMax) / 2);

  // Determine lift split based on available days
  const liftableDays = slots.filter(
    (s) => !s.isRestDay && s.isAvailable && (s.runSession !== 'tempo' && s.runSession !== 'intervals')
  );

  // Assign lifting sessions with muscle group rotation
  const liftFocusRotation = getLiftingRotation(hypertrophyTarget, liftableDays, slots);
  let liftsPlaced = 0;

  for (let i = 0; i < Math.min(hypertrophyTarget, liftableDays.length); i++) {
    const slot = liftableDays[i];
    const focus = liftFocusRotation[i];

    // Skip legs on days near hard runs
    if (focus.isLegDay && slot.isNearHardRun) {
      // Try to swap with another day
      const swapCandidate = liftableDays.find(
        (s) => !s.isNearHardRun && !s.liftSession && s !== slot
      );
      if (swapCandidate) {
        swapCandidate.liftSession = 'hypertrophy';
        swapCandidate.focus = focus.focus;
        liftsPlaced++;
        continue;
      } else {
        warnings.push(`${DAY_NAMES[slot.dayNumber - 1]}: Leg day scheduled near hard run - consider swapping`);
      }
    }

    slot.liftSession = 'hypertrophy';
    slot.focus = focus.focus;
    liftsPlaced++;
  }

  if (liftsPlaced > 0) {
    rationale.push(`Scheduled ${liftsPlaced} lifting session${liftsPlaced > 1 ? 's' : ''}`);
  }

  // Check if we met targets
  if (liftsPlaced < hypertrophyMin) {
    warnings.push(`Only ${liftsPlaced}/${hypertrophyMin} minimum lifting sessions could be scheduled`);
  }

  // Convert slots to PlannedDay format
  const days: PlannedDay[] = slots.map((slot) => ({
    dayNumber: slot.dayNumber,
    dayName: capitalize(slot.dayName),
    isRestDay: slot.isRestDay,
    sessionType: determineSessionType(slot),
    focus: slot.focus || determineFocus(slot),
    notes: generateDayNotes(slot),
    estimatedDuration: estimateDuration(slot, targets),
  }));

  return {
    days,
    rationale: rationale.join('. ') + '.',
    warnings,
  };
}

/**
 * Get lifting rotation based on number of days
 */
function getLiftingRotation(
  daysCount: number,
  liftableDays: DaySlot[],
  allSlots: DaySlot[]
): { focus: string; isLegDay: boolean }[] {
  // Classic splits based on days per week
  if (daysCount <= 2) {
    return [
      { focus: 'Full Body A', isLegDay: true },
      { focus: 'Full Body B', isLegDay: true },
    ];
  }

  if (daysCount === 3) {
    return [
      { focus: 'Push', isLegDay: false },
      { focus: 'Pull', isLegDay: false },
      { focus: 'Legs', isLegDay: true },
    ];
  }

  if (daysCount === 4) {
    return [
      { focus: 'Upper A', isLegDay: false },
      { focus: 'Lower A', isLegDay: true },
      { focus: 'Upper B', isLegDay: false },
      { focus: 'Lower B', isLegDay: true },
    ];
  }

  // 5+ days: Push/Pull/Legs with extra upper focus
  return [
    { focus: 'Push', isLegDay: false },
    { focus: 'Pull', isLegDay: false },
    { focus: 'Legs', isLegDay: true },
    { focus: 'Upper', isLegDay: false },
    { focus: 'Arms & Shoulders', isLegDay: false },
    { focus: 'Full Body', isLegDay: true },
  ].slice(0, daysCount);
}

/**
 * Determine the primary session type for display
 */
function determineSessionType(slot: DaySlot): SessionType {
  if (slot.isRestDay) return 'rest';

  // If both lift and cardio, lift takes precedence for type
  if (slot.liftSession) return slot.liftSession;
  if (slot.runSession) return slot.runSession;

  return 'rest';
}

/**
 * Generate focus string for a day
 */
function determineFocus(slot: DaySlot): string {
  if (slot.isRestDay) return 'Rest & Recovery';
  if (slot.focus) return slot.focus;

  if (slot.runSession === 'zone2') return 'Zone 2 Cardio';
  if (slot.runSession === 'tempo') return 'Tempo Run';
  if (slot.runSession === 'intervals') return 'Intervals';
  if (slot.runSession === 'long_run') return 'Long Run';
  if (slot.runSession === 'easy_run') return 'Easy Run';

  return 'Training';
}

/**
 * Generate notes for a day
 */
function generateDayNotes(slot: DaySlot): string {
  const notes: string[] = [];

  if (slot.liftSession && slot.runSession) {
    if (slot.runSession === 'zone2') {
      notes.push('Can combine lifting + zone 2 or split AM/PM');
    } else {
      notes.push('Prioritize the harder session based on your goals');
    }
  }

  if (slot.isNearHardRun && slot.focus?.toLowerCase().includes('leg')) {
    notes.push('Consider lighter leg volume due to nearby hard run');
  }

  return notes.join('. ');
}

/**
 * Estimate duration for a session
 */
function estimateDuration(slot: DaySlot, targets: WeeklyTargets): number {
  if (slot.isRestDay) return 0;

  let duration = 0;

  if (slot.liftSession) {
    duration += 60; // Base lifting session
  }

  if (slot.runSession) {
    switch (slot.runSession) {
      case 'zone2':
        duration += targets.zone2Sessions.durationMinutes;
        break;
      case 'tempo':
        duration += 45;
        break;
      case 'intervals':
        duration += 40;
        break;
      case 'long_run':
        duration += 90;
        break;
      case 'easy_run':
        duration += 30;
        break;
    }
  }

  return duration;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Check if a day swap is valid (for user-initiated swaps)
 */
export function canSwapDays(
  day1: PlannedDay,
  day2: PlannedDay,
  runningSchedule?: RunningSchedule
): { canSwap: boolean; warning?: string } {
  // Can't swap rest days with training days
  if (day1.isRestDay !== day2.isRestDay) {
    return { canSwap: true }; // Allow, user knows what they're doing
  }

  // Check if swapping would put legs near a hard run
  if (runningSchedule) {
    const hardRunDays = runningSchedule.days.filter((_, idx) =>
      HARD_RUN_TYPES.includes(runningSchedule.types[idx])
    );

    const isLegDay1 = day1.focus?.toLowerCase().includes('leg') || day1.focus?.toLowerCase().includes('lower');
    const isLegDay2 = day2.focus?.toLowerCase().includes('leg') || day2.focus?.toLowerCase().includes('lower');

    for (const hardRunDay of hardRunDays) {
      const hardRunDayNum = DAY_NUMBERS[hardRunDay];

      // Check day1's new position (day2's position)
      if (isLegDay1 && Math.abs(day2.dayNumber - hardRunDayNum) <= 1) {
        return {
          canSwap: true,
          warning: 'Moving legs to this day puts it near a hard run. Consider adjusting intensity.',
        };
      }

      // Check day2's new position (day1's position)
      if (isLegDay2 && Math.abs(day1.dayNumber - hardRunDayNum) <= 1) {
        return {
          canSwap: true,
          warning: 'Moving legs to this day puts it near a hard run. Consider adjusting intensity.',
        };
      }
    }
  }

  return { canSwap: true };
}

/**
 * Get session type display info (color, icon, label)
 */
export function getSessionTypeDisplay(sessionType: SessionType): {
  label: string;
  color: string;
  icon: string;
  bgColor: string;
} {
  switch (sessionType) {
    case 'hypertrophy':
      return {
        label: 'Hypertrophy',
        color: '#3B82F6', // signal blue
        icon: 'barbell',
        bgColor: 'rgba(59, 130, 246, 0.15)',
      };
    case 'strength':
      return {
        label: 'Strength',
        color: '#F59E0B', // amber
        icon: 'fitness',
        bgColor: 'rgba(245, 158, 11, 0.15)',
      };
    case 'zone2':
      return {
        label: 'Zone 2',
        color: '#10B981', // emerald
        icon: 'heart',
        bgColor: 'rgba(16, 185, 129, 0.15)',
      };
    case 'tempo':
      return {
        label: 'Tempo',
        color: '#EF4444', // red
        icon: 'speedometer',
        bgColor: 'rgba(239, 68, 68, 0.15)',
      };
    case 'intervals':
      return {
        label: 'Intervals',
        color: '#EF4444', // red
        icon: 'flash',
        bgColor: 'rgba(239, 68, 68, 0.15)',
      };
    case 'long_run':
      return {
        label: 'Long Run',
        color: '#8B5CF6', // purple
        icon: 'walk',
        bgColor: 'rgba(139, 92, 246, 0.15)',
      };
    case 'easy_run':
      return {
        label: 'Easy Run',
        color: '#6B7280', // gray
        icon: 'walk-outline',
        bgColor: 'rgba(107, 114, 128, 0.15)',
      };
    case 'rest':
    default:
      return {
        label: 'Rest',
        color: '#6B7280', // gray
        icon: 'bed',
        bgColor: 'rgba(107, 114, 128, 0.1)',
      };
  }
}
