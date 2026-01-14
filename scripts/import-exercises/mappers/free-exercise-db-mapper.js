/**
 * Mapper for free-exercise-db schema to internal schema
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
 * Map free-exercise-db exercise to internal schema
 * 
 * free-exercise-db structure:
 * {
 *   id: string,
 *   name: string,
 *   force: string,
 *   level: string,
 *   mechanic: string,
 *   equipment: string,
 *   primaryMuscles: string[],
 *   secondaryMuscles: string[],
 *   instructions: string[],
 *   category: string,
 *   images: string[]
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
function mapFreeExerciseDb(exercise) {
  if (!exercise || !exercise.name) {
    throw new Error('Invalid exercise: missing name');
  }

  const muscleGroup = getPrimaryMuscleGroup(exercise.primaryMuscles);
  const modality = determineModality(exercise.category, exercise.name);
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
    _source: 'free-exercise-db',
    _sourceId: exercise.id,
    _originalData: exercise,
  };
}

/**
 * Map array of free-exercise-db exercises
 */
function mapFreeExerciseDbArray(exercises) {
  return exercises
    .filter(ex => ex && ex.name)
    .map(ex => {
      try {
        return mapFreeExerciseDb(ex);
      } catch (error) {
        console.warn(`⚠️  Skipping exercise due to mapping error: ${ex.name || ex.id} - ${error.message}`);
        return null;
      }
    })
    .filter(ex => ex !== null);
}

module.exports = {
  mapFreeExerciseDb,
  mapFreeExerciseDbArray,
};
