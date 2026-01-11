/**
 * Periodization Utilities
 *
 * Handles annual planning calculations, block recommendations,
 * and phase transition logic for intelligent training periodization.
 */

import type {
  AnnualPlan,
  BlockRecommendation,
  BlockType,
  Competition,
  PlannedBlock,
  TrainingGoal,
  TrainingPhase,
  TrainingProfile,
  VolumeLevel,
} from '@/types/database';

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard phase sequence for different goals
 */
export const PHASE_SEQUENCES: Record<TrainingGoal, BlockType[]> = {
  strength: ['accumulation', 'intensification', 'realization', 'deload'],
  hypertrophy: ['hypertrophy', 'hypertrophy', 'strength', 'deload'],
  powerlifting: ['accumulation', 'intensification', 'realization', 'peaking', 'transition'],
  athletic: ['base_building', 'strength', 'power', 'deload'],
  general: ['hypertrophy', 'strength', 'deload'],
  bodybuilding: ['hypertrophy', 'hypertrophy', 'hypertrophy', 'deload'],
};

/**
 * Block type characteristics
 */
export const BLOCK_CHARACTERISTICS: Record<BlockType, {
  name: string;
  description: string;
  typicalDuration: number;
  volumeLevel: VolumeLevel;
  intensityLevel: VolumeLevel;
  repRanges: string;
  rpeRange: string;
}> = {
  accumulation: {
    name: 'Accumulation',
    description: 'Build work capacity and muscle with higher volume',
    typicalDuration: 4,
    volumeLevel: 'high',
    intensityLevel: 'moderate',
    repRanges: '8-12',
    rpeRange: '6-8',
  },
  intensification: {
    name: 'Intensification',
    description: 'Increase intensity while managing volume',
    typicalDuration: 4,
    volumeLevel: 'moderate',
    intensityLevel: 'high',
    repRanges: '4-6',
    rpeRange: '7-9',
  },
  realization: {
    name: 'Realization',
    description: 'Express strength gains with heavy singles/doubles',
    typicalDuration: 3,
    volumeLevel: 'low',
    intensityLevel: 'very_high',
    repRanges: '1-3',
    rpeRange: '8-10',
  },
  peaking: {
    name: 'Peaking',
    description: 'Final preparation for competition',
    typicalDuration: 2,
    volumeLevel: 'low',
    intensityLevel: 'very_high',
    repRanges: '1-2',
    rpeRange: '9-10',
  },
  deload: {
    name: 'Deload',
    description: 'Recovery week with reduced volume and intensity',
    typicalDuration: 1,
    volumeLevel: 'low',
    intensityLevel: 'low',
    repRanges: '6-10',
    rpeRange: '5-6',
  },
  transition: {
    name: 'Transition',
    description: 'Active recovery between training cycles',
    typicalDuration: 2,
    volumeLevel: 'low',
    intensityLevel: 'low',
    repRanges: '8-15',
    rpeRange: '5-7',
  },
  base_building: {
    name: 'Base Building',
    description: 'Establish movement patterns and general conditioning',
    typicalDuration: 4,
    volumeLevel: 'moderate',
    intensityLevel: 'low',
    repRanges: '10-15',
    rpeRange: '5-7',
  },
  hypertrophy: {
    name: 'Hypertrophy',
    description: 'Maximize muscle growth with moderate-high volume',
    typicalDuration: 4,
    volumeLevel: 'very_high',
    intensityLevel: 'moderate',
    repRanges: '8-15',
    rpeRange: '7-9',
  },
  strength: {
    name: 'Strength',
    description: 'Build maximal strength with heavy compounds',
    typicalDuration: 4,
    volumeLevel: 'moderate',
    intensityLevel: 'high',
    repRanges: '3-6',
    rpeRange: '7-9',
  },
  power: {
    name: 'Power',
    description: 'Develop explosive strength and speed',
    typicalDuration: 3,
    volumeLevel: 'low',
    intensityLevel: 'moderate',
    repRanges: '1-5',
    rpeRange: '7-8',
  },
};

// ============================================================================
// Block Recommendation Engine
// ============================================================================

export interface RecommendationContext {
  profile: TrainingProfile | null;
  currentPhase: TrainingPhase | null;
  weeksInPhase: number;
  nextCompetition: Competition | null;
  recentBlocks: PlannedBlock[];
  goal: TrainingGoal;
}

/**
 * Generate intelligent block recommendations based on context
 */
export function generateBlockRecommendations(
  context: RecommendationContext
): BlockRecommendation[] {
  const recommendations: BlockRecommendation[] = [];
  const { profile, currentPhase, weeksInPhase, nextCompetition, goal } = context;

  // Calculate weeks to competition if applicable
  const weeksToComp = nextCompetition
    ? Math.ceil(
        (new Date(nextCompetition.event_date).getTime() - Date.now()) /
          (7 * 24 * 60 * 60 * 1000)
      )
    : null;

  // Competition-driven recommendations
  if (weeksToComp !== null && weeksToComp > 0) {
    recommendations.push(...getCompetitionPrepRecommendations(weeksToComp, nextCompetition!));
  } else {
    // Standard phase progression
    recommendations.push(...getPhaseProgressionRecommendations(currentPhase, weeksInPhase, goal));
  }

  // Add alternative recommendations
  if (recommendations.length < 3) {
    recommendations.push(...getAlternativeRecommendations(goal, currentPhase));
  }

  // Sort by confidence and return top 3
  return recommendations
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/**
 * Get recommendations based on competition prep timeline
 */
function getCompetitionPrepRecommendations(
  weeksToComp: number,
  competition: Competition
): BlockRecommendation[] {
  const recommendations: BlockRecommendation[] = [];

  if (weeksToComp <= 2) {
    recommendations.push({
      block_type: 'peaking',
      duration_weeks: weeksToComp,
      reasoning: `Competition in ${weeksToComp} weeks - time for final peaking phase`,
      confidence: 0.95,
      volume_level: 'low',
      intensity_level: 'very_high',
      primary_focus: 'Peak strength expression',
    });
  } else if (weeksToComp <= 4) {
    recommendations.push({
      block_type: 'realization',
      duration_weeks: Math.min(3, weeksToComp - 1),
      reasoning: `${weeksToComp} weeks out - realize your strength gains`,
      confidence: 0.9,
      volume_level: 'low',
      intensity_level: 'very_high',
      primary_focus: 'Heavy singles and competition prep',
    });
  } else if (weeksToComp <= 8) {
    recommendations.push({
      block_type: 'intensification',
      duration_weeks: 4,
      reasoning: `${weeksToComp} weeks out - build intensity toward competition`,
      confidence: 0.85,
      volume_level: 'moderate',
      intensity_level: 'high',
      primary_focus: 'Increase working weights',
    });
  } else if (weeksToComp <= 12) {
    recommendations.push({
      block_type: 'accumulation',
      duration_weeks: 4,
      reasoning: `${weeksToComp} weeks out - build volume base for competition prep`,
      confidence: 0.8,
      volume_level: 'high',
      intensity_level: 'moderate',
      primary_focus: 'Build work capacity',
    });
  } else {
    // More than 12 weeks - general training
    recommendations.push({
      block_type: 'hypertrophy',
      duration_weeks: 4,
      reasoning: `${weeksToComp} weeks until competition - time to build muscle and work capacity`,
      confidence: 0.75,
      volume_level: 'high',
      intensity_level: 'moderate',
      primary_focus: 'Build muscle mass and GPP',
    });
  }

  return recommendations;
}

/**
 * Get recommendations based on standard phase progression
 */
function getPhaseProgressionRecommendations(
  currentPhase: TrainingPhase | null,
  weeksInPhase: number,
  goal: TrainingGoal
): BlockRecommendation[] {
  const recommendations: BlockRecommendation[] = [];
  const sequence = PHASE_SEQUENCES[goal] || PHASE_SEQUENCES.general;

  // Map training phase to block type
  const phaseToBlock: Record<TrainingPhase, BlockType> = {
    accumulation: 'accumulation',
    intensification: 'intensification',
    realization: 'realization',
    deload: 'deload',
    maintenance: 'base_building',
  };

  // Find current position in sequence
  const currentBlock = currentPhase ? phaseToBlock[currentPhase] : null;
  const currentIndex = currentBlock ? sequence.indexOf(currentBlock) : -1;

  // Get next block in sequence
  const nextIndex = (currentIndex + 1) % sequence.length;
  const nextBlockType = sequence[nextIndex];
  const blockInfo = BLOCK_CHARACTERISTICS[nextBlockType];

  // Check if it's time to transition
  const typicalDuration = currentBlock
    ? BLOCK_CHARACTERISTICS[currentBlock].typicalDuration
    : 4;
  const shouldTransition = weeksInPhase >= typicalDuration;

  if (shouldTransition || !currentPhase) {
    recommendations.push({
      block_type: nextBlockType,
      duration_weeks: blockInfo.typicalDuration,
      reasoning: currentPhase
        ? `After ${weeksInPhase} weeks of ${currentPhase}, progress to ${blockInfo.name}`
        : `Start with ${blockInfo.name} phase for ${goal} goal`,
      confidence: 0.85,
      volume_level: blockInfo.volumeLevel,
      intensity_level: blockInfo.intensityLevel,
      primary_focus: blockInfo.description,
    });
  } else {
    // Continue current phase
    if (currentBlock) {
      const currentInfo = BLOCK_CHARACTERISTICS[currentBlock];
      recommendations.push({
        block_type: currentBlock,
        duration_weeks: Math.max(1, typicalDuration - weeksInPhase),
        reasoning: `Continue ${currentInfo.name} - ${typicalDuration - weeksInPhase} weeks remaining`,
        confidence: 0.7,
        volume_level: currentInfo.volumeLevel,
        intensity_level: currentInfo.intensityLevel,
        primary_focus: currentInfo.description,
      });
    }
  }

  return recommendations;
}

/**
 * Get alternative block recommendations
 */
function getAlternativeRecommendations(
  goal: TrainingGoal,
  currentPhase: TrainingPhase | null
): BlockRecommendation[] {
  const alternatives: BlockRecommendation[] = [];

  // Deload is always an option
  if (currentPhase !== 'deload') {
    alternatives.push({
      block_type: 'deload',
      duration_weeks: 1,
      reasoning: 'Take a recovery week if feeling fatigued',
      confidence: 0.5,
      volume_level: 'low',
      intensity_level: 'low',
      primary_focus: 'Recovery and regeneration',
    });
  }

  // Goal-specific alternatives
  if (goal === 'strength' || goal === 'powerlifting') {
    alternatives.push({
      block_type: 'hypertrophy',
      duration_weeks: 4,
      reasoning: 'Build muscle mass to support future strength',
      confidence: 0.4,
      volume_level: 'high',
      intensity_level: 'moderate',
      primary_focus: 'Muscle growth',
    });
  }

  if (goal === 'hypertrophy' || goal === 'bodybuilding') {
    alternatives.push({
      block_type: 'strength',
      duration_weeks: 4,
      reasoning: 'Build strength to lift heavier in future hypertrophy work',
      confidence: 0.4,
      volume_level: 'moderate',
      intensity_level: 'high',
      primary_focus: 'Neural adaptations',
    });
  }

  return alternatives;
}

// ============================================================================
// Timeline Generation
// ============================================================================

export interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  goal: TrainingGoal;
  competitions: Competition[];
  deloadFrequency: number;
}

/**
 * Generate a full training timeline with blocks leading to competitions
 */
export function generateAnnualTimeline(config: TimelineConfig): PlannedBlock[] {
  const { startDate, endDate, goal, competitions, deloadFrequency } = config;
  const blocks: PlannedBlock[] = [];

  // Sort competitions by date
  const sortedComps = [...competitions]
    .filter((c) => new Date(c.event_date) >= startDate && new Date(c.event_date) <= endDate)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

  let currentDate = new Date(startDate);
  let blockOrder = 0;
  let weeksWithoutDeload = 0;

  // Generate blocks for each competition
  for (const comp of sortedComps) {
    const compDate = new Date(comp.event_date);
    const weeksToComp = Math.ceil(
      (compDate.getTime() - currentDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    if (weeksToComp > 0) {
      // Generate prep blocks leading to competition
      const prepBlocks = generateCompetitionPrep(
        currentDate,
        compDate,
        weeksToComp,
        comp,
        blockOrder,
        deloadFrequency,
        weeksWithoutDeload
      );
      blocks.push(...prepBlocks);
      blockOrder += prepBlocks.length;

      // Add transition week after competition
      const transitionStart = new Date(compDate);
      transitionStart.setDate(transitionStart.getDate() + 7);
      blocks.push(createPlannedBlock({
        name: `Post-${comp.name} Transition`,
        block_type: 'transition',
        planned_start_date: transitionStart.toISOString().split('T')[0],
        duration_weeks: 1,
        sequence_order: blockOrder++,
        depends_on_competition: comp.id,
      }));

      currentDate = new Date(transitionStart);
      currentDate.setDate(currentDate.getDate() + 7);
      weeksWithoutDeload = 0;
    }
  }

  // Fill remaining time with general training
  const remainingWeeks = Math.ceil(
    (endDate.getTime() - currentDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  if (remainingWeeks > 0) {
    const generalBlocks = generateGeneralTraining(
      currentDate,
      remainingWeeks,
      goal,
      blockOrder,
      deloadFrequency
    );
    blocks.push(...generalBlocks);
  }

  return blocks;
}

/**
 * Generate blocks for competition preparation
 */
function generateCompetitionPrep(
  startDate: Date,
  compDate: Date,
  weeksAvailable: number,
  competition: Competition,
  startOrder: number,
  deloadFrequency: number,
  currentWeeksWithoutDeload: number
): PlannedBlock[] {
  const blocks: PlannedBlock[] = [];
  let currentDate = new Date(startDate);
  let order = startOrder;
  let weeksPlanned = 0;
  let weeksWithoutDeload = currentWeeksWithoutDeload;

  // Determine prep phases based on available time
  const phases: { type: BlockType; weeks: number }[] = [];

  if (weeksAvailable >= 12) {
    phases.push({ type: 'accumulation', weeks: 4 });
    phases.push({ type: 'intensification', weeks: 4 });
    phases.push({ type: 'realization', weeks: 3 });
    phases.push({ type: 'peaking', weeks: 1 });
  } else if (weeksAvailable >= 8) {
    phases.push({ type: 'accumulation', weeks: 3 });
    phases.push({ type: 'intensification', weeks: 3 });
    phases.push({ type: 'peaking', weeks: 2 });
  } else if (weeksAvailable >= 4) {
    phases.push({ type: 'intensification', weeks: 2 });
    phases.push({ type: 'peaking', weeks: 2 });
  } else {
    phases.push({ type: 'peaking', weeks: weeksAvailable });
  }

  // Create blocks from phases
  for (const phase of phases) {
    // Check if deload needed
    if (weeksWithoutDeload >= deloadFrequency && phase.type !== 'peaking') {
      blocks.push(createPlannedBlock({
        name: 'Deload Week',
        block_type: 'deload',
        planned_start_date: currentDate.toISOString().split('T')[0],
        duration_weeks: 1,
        sequence_order: order++,
      }));
      currentDate.setDate(currentDate.getDate() + 7);
      weeksPlanned += 1;
      weeksWithoutDeload = 0;
    }

    const blockInfo = BLOCK_CHARACTERISTICS[phase.type];
    blocks.push(createPlannedBlock({
      name: `${competition.name} - ${blockInfo.name}`,
      block_type: phase.type,
      planned_start_date: currentDate.toISOString().split('T')[0],
      duration_weeks: phase.weeks,
      sequence_order: order++,
      depends_on_competition: competition.id,
      volume_level: blockInfo.volumeLevel,
      intensity_level: blockInfo.intensityLevel,
    }));

    currentDate.setDate(currentDate.getDate() + phase.weeks * 7);
    weeksPlanned += phase.weeks;
    weeksWithoutDeload += phase.weeks;
  }

  return blocks;
}

/**
 * Generate blocks for general training (no competition)
 */
function generateGeneralTraining(
  startDate: Date,
  weeksAvailable: number,
  goal: TrainingGoal,
  startOrder: number,
  deloadFrequency: number
): PlannedBlock[] {
  const blocks: PlannedBlock[] = [];
  const sequence = PHASE_SEQUENCES[goal] || PHASE_SEQUENCES.general;
  let currentDate = new Date(startDate);
  let order = startOrder;
  let weeksPlanned = 0;
  let phaseIndex = 0;

  while (weeksPlanned < weeksAvailable) {
    const blockType = sequence[phaseIndex % sequence.length];
    const blockInfo = BLOCK_CHARACTERISTICS[blockType];
    const duration = Math.min(blockInfo.typicalDuration, weeksAvailable - weeksPlanned);

    if (duration <= 0) break;

    blocks.push(createPlannedBlock({
      name: blockInfo.name,
      block_type: blockType,
      planned_start_date: currentDate.toISOString().split('T')[0],
      duration_weeks: duration,
      sequence_order: order++,
      volume_level: blockInfo.volumeLevel,
      intensity_level: blockInfo.intensityLevel,
    }));

    currentDate.setDate(currentDate.getDate() + duration * 7);
    weeksPlanned += duration;
    phaseIndex++;
  }

  return blocks;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createPlannedBlock(partial: Partial<PlannedBlock>): PlannedBlock {
  return {
    id: '',
    user_id: '',
    annual_plan_id: null,
    name: '',
    description: null,
    block_type: 'accumulation',
    planned_start_date: new Date().toISOString().split('T')[0],
    duration_weeks: 4,
    primary_focus: null,
    target_metrics: null,
    volume_level: 'moderate',
    intensity_level: 'moderate',
    training_block_id: null,
    sequence_order: 0,
    depends_on_competition: null,
    status: 'planned',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Get the next phase in a standard periodization sequence
 */
export function getNextPhase(currentPhase: TrainingPhase, goal: TrainingGoal): TrainingPhase {
  const phaseMap: Record<TrainingPhase, TrainingPhase> = {
    accumulation: 'intensification',
    intensification: 'realization',
    realization: 'deload',
    deload: 'accumulation',
    maintenance: 'accumulation',
  };

  return phaseMap[currentPhase] || 'accumulation';
}

/**
 * Calculate weeks between two dates
 */
export function weeksBetween(date1: Date, date2: Date): number {
  const diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Format block type for display
 */
export function formatBlockType(type: BlockType): string {
  return BLOCK_CHARACTERISTICS[type]?.name || type;
}

/**
 * Get color for block type (for calendar visualization)
 */
export function getBlockTypeColor(type: BlockType): string {
  const colors: Record<BlockType, string> = {
    accumulation: '#8B5CF6', // Purple
    intensification: '#F59E0B', // Amber
    realization: '#EF4444', // Red
    peaking: '#DC2626', // Dark Red
    deload: '#10B981', // Green
    transition: '#6B7280', // Gray
    base_building: '#3B82F6', // Blue
    hypertrophy: '#EC4899', // Pink
    strength: '#F97316', // Orange
    power: '#FBBF24', // Yellow
  };

  return colors[type] || '#6B7280';
}
