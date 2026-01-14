/**
 * Merge strategy for updating existing exercises with new data
 * Implements intelligent merging based on confidence levels and data quality
 */

/**
 * Merge new exercise data into existing exercise
 * Follows the strategy:
 * 1. Name: Keep existing (most trusted)
 * 2. Instructions: Merge/append if new source has more detail
 * 3. Equipment: Combine unique equipment values
 * 4. Muscle group: Keep existing (or merge if compatible)
 * 5. Modality/Primary metric: Keep existing (validated)
 * 
 * Returns: merged exercise object ready for database update
 */
function mergeExercise(existing, newExercise, options = {}) {
  const {
    mergeInstructions = true,
    mergeEquipment = true,
    updateMuscleGroup = false,
    updateModality = false,
  } = options;
  
  const merged = {
    ...existing,
    updated_at: new Date().toISOString(),
  };
  
  // Instructions: Merge if new has more detail or existing is empty
  if (mergeInstructions) {
    const existingInstructions = (existing.instructions || '').trim();
    const newInstructions = (newExercise.instructions || '').trim();
    
    if (!existingInstructions && newInstructions) {
      // Existing has no instructions, use new
      merged.instructions = newInstructions;
    } else if (existingInstructions && newInstructions) {
      // Both have instructions - append new if it's different and adds value
      if (newInstructions.length > existingInstructions.length * 0.5) {
        // New instructions are substantial, append them
        if (!existingInstructions.includes(newInstructions.substring(0, 50))) {
          merged.instructions = `${existingInstructions}\n\n--- Additional instructions from ${newExercise._source || 'external source'} ---\n\n${newInstructions}`;
        }
      }
    }
  }
  
  // Equipment: Combine if different
  if (mergeEquipment) {
    const existingEquipment = (existing.equipment || '').toLowerCase().trim();
    const newEquipment = (newExercise.equipment || '').toLowerCase().trim();
    
    if (existingEquipment && newEquipment && existingEquipment !== newEquipment) {
      // Combine equipment (e.g., "Barbell" + "Dumbbells" = "Barbell, Dumbbells")
      const existingList = existingEquipment.split(',').map(e => e.trim());
      const newList = newEquipment.split(',').map(e => e.trim());
      const combined = [...new Set([...existingList, ...newList])];
      
      // Capitalize first letter of each
      merged.equipment = combined
        .map(eq => eq.charAt(0).toUpperCase() + eq.slice(1))
        .join(', ');
    } else if (!existingEquipment && newEquipment) {
      // Existing has no equipment, use new
      merged.equipment = newExercise.equipment;
    }
  }
  
  // Muscle group: Only update if explicitly allowed and new is more specific
  if (updateMuscleGroup) {
    const existingGroup = (existing.muscle_group || '').toLowerCase();
    const newGroup = (newExercise.muscle_group || '').toLowerCase();
    
    // Only update if new is more specific (longer) or existing is generic
    if (newGroup && (newGroup.length > existingGroup.length || existingGroup === 'full body')) {
      merged.muscle_group = newExercise.muscle_group;
    }
  }
  
  // Modality and primary metric: Keep existing (validated data)
  // These are not updated as they're core to the exercise definition
  
  // Track merge metadata (optional - could be stored in source_metadata JSONB field)
  if (!merged._mergeHistory) {
    merged._mergeHistory = [];
  }
  merged._mergeHistory.push({
    source: newExercise._source || 'unknown',
    sourceId: newExercise._sourceId,
    mergedAt: new Date().toISOString(),
    confidence: options.confidence || 'medium',
  });
  
  return merged;
}

/**
 * Determine if an exercise should be updated based on confidence and data quality
 */
function shouldUpdate(existing, newExercise, duplicateInfo) {
  const { confidence, reason } = duplicateInfo;
  
  // High confidence duplicates should always be considered for update
  if (confidence === 'high') {
    return true;
  }
  
  // Medium confidence - update if new data adds value
  if (confidence === 'medium') {
    const hasBetterInstructions = 
      newExercise.instructions && 
      (!existing.instructions || newExercise.instructions.length > existing.instructions.length);
    
    const hasBetterEquipment = 
      newExercise.equipment && 
      (!existing.equipment || newExercise.equipment !== existing.equipment);
    
    return hasBetterInstructions || hasBetterEquipment;
  }
  
  // Low confidence - only update if existing is very sparse
  if (confidence === 'low') {
    const existingIsSparse = 
      (!existing.instructions || existing.instructions.length < 50) &&
      (!existing.equipment || existing.equipment === 'None');
    
    return existingIsSparse;
  }
  
  return false;
}

/**
 * Prepare exercises for merging
 * Returns: {
 *   toUpdate: Array<{ existing: exercise, merged: exercise, new: exercise, confidence: string }>,
 *   toSkip: Array<{ existing: exercise, new: exercise, reason: string }>
 * }
 */
function prepareMerges(duplicates, options = {}) {
  const toUpdate = [];
  const toSkip = [];
  
  for (const duplicate of duplicates) {
    const { existing, new: newExercise, confidence, reason } = duplicate;
    
    if (shouldUpdate(existing, newExercise, { confidence, reason })) {
      const merged = mergeExercise(existing, newExercise, {
        ...options,
        confidence,
      });
      
      toUpdate.push({
        existing,
        merged,
        new: newExercise,
        confidence,
        reason,
      });
    } else {
      toSkip.push({
        existing,
        new: newExercise,
        reason: `Low confidence or no value added (confidence: ${confidence})`,
      });
    }
  }
  
  return { toUpdate, toSkip };
}

module.exports = {
  mergeExercise,
  shouldUpdate,
  prepareMerges,
};
