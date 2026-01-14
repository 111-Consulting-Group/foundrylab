/**
 * Mapper for ExerciseDB schema to internal schema
 */

const {
  normalizeMuscleGroup,
  normalizeEquipment,
  determineModality,
  determinePrimaryMetric,
  formatInstructions,
  getPrimaryMuscleGroup,
} = require('../utils');

/**
 * Map ExerciseDB exercise to internal schema
 * 
 * ExerciseDB structure (based on API documentation):
 * {
 *   id: string,
 *   name: string,
 *   bodyPart: string,
 *   target: string,
 *   equipment: string,
 *   gifUrl: string,
 *   instructions: string[],
 *   secondaryMuscles: string[]
 * }
 * 
 * Internal schema:
 * {
 *   name: string,
 *   modality: 'Strength' | 'Cardio' | 'Hybrid',
 *   primary_metric: 'Weight' | 'Watts' | 'Pace' | 'Distance',
 *   muscle_group: string,
 *   equipment: string | null,
 *   instructions: string | null,
 *   is_custom: boolean (default false)
 * }
 */
function mapExerciseDb(exercise) {
  if (!exercise || !exercise.name) {
    throw new Error('Invalid exercise: missing name');
  }

  // ExerciseDB uses 'target' as primary muscle, 'bodyPart' as general area
  // Prefer 'target' if available, fallback to 'bodyPart'
  const primaryMuscle = exercise.target || exercise.bodyPart;
  const muscleGroup = normalizeMuscleGroup(primaryMuscle);
  
  // Determine modality - ExerciseDB doesn't have explicit category,
  // so infer from name and bodyPart
  const modality = determineModality(null, exercise.name);
  const primaryMetric = determinePrimaryMetric(modality, exercise.name);
  const equipment = normalizeEquipment(exercise.equipment);
  const instructions = formatInstructions(exercise.instructions);

  return {
    name: exercise.name.trim(),
    modality,
    primary_metric: primaryMetric,
    muscle_group: muscleGroup,
    equipment: equipment || null,
    instructions: instructions || null,
    is_custom: false,
    // Metadata for tracking source
    _source: 'exercisedb',
    _sourceId: exercise.id,
    _originalData: exercise,
  };
}

/**
 * Map array of ExerciseDB exercises
 */
function mapExerciseDbArray(exercises) {
  return exercises
    .filter(ex => ex && ex.name)
    .map(ex => {
      try {
        return mapExerciseDb(ex);
      } catch (error) {
        console.warn(`⚠️  Skipping exercise due to mapping error: ${ex.name || ex.id} - ${error.message}`);
        return null;
      }
    })
    .filter(ex => ex !== null);
}

module.exports = {
  mapExerciseDb,
  mapExerciseDbArray,
};
