// Cardio-specific entry component
// Segment picker, distance presets, pace input, logged intervals list

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Alert, Platform } from 'react-native';

import { Colors } from '@/constants/Colors';
import { formatDistance, formatPace, type SetWithExercise } from '@/lib/workoutSummary';
import type { Exercise, WorkoutSetInsert, SegmentType } from '@/types/database';

// Distance presets in meters
const DISTANCE_PRESETS_METERS = [
  { label: '200m', meters: 200 },
  { label: '400m', meters: 400 },
  { label: '800m', meters: 800 },
  { label: '1mi', meters: 1609 },
];

// Conversion functions
function metersToMiles(meters: number): number {
  return meters / 1609.34;
}

function metersToKm(meters: number): number {
  return meters / 1000;
}

function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

function kmToMeters(km: number): number {
  return km * 1000;
}

// Get distance presets for current unit
function getDistancePresets(unit: 'meters' | 'miles' | 'km') {
  if (unit === 'meters') {
    return DISTANCE_PRESETS_METERS;
  } else if (unit === 'miles') {
    return [
      { label: '0.25mi', meters: 402 },
      { label: '0.5mi', meters: 805 },
      { label: '1mi', meters: 1609 },
      { label: '2mi', meters: 3219 },
    ];
  } else {
    return [
      { label: '0.5km', meters: 500 },
      { label: '1km', meters: 1000 },
      { label: '2km', meters: 2000 },
      { label: '5km', meters: 5000 },
    ];
  }
}

// Segment types with display config
const SEGMENT_TYPES: { type: SegmentType; label: string; color: string; bgColor: string }[] = [
  { type: 'warmup', label: 'Warm-up', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
  { type: 'work', label: 'Work', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  { type: 'recovery', label: 'Recovery', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
  { type: 'cooldown', label: 'Cool-down', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
];

interface CardioEntryProps {
  exercise: Exercise;
  sets: SetWithExercise[];
  workoutId: string;
  onSaveSet: (
    exerciseId: string,
    setOrder: number,
    data: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'>
  ) => Promise<void>;
  onDeleteSet: (setId: string) => Promise<void>;
  onAddSet: () => void;
}

export function CardioEntry({
  exercise,
  sets,
  workoutId,
  onSaveSet,
  onDeleteSet,
  onAddSet,
}: CardioEntryProps) {
  // Form state
  const [segmentType, setSegmentType] = useState<SegmentType>('work');
  const [selectedDistance, setSelectedDistance] = useState<number | null>(400);
  const [customDistance, setCustomDistance] = useState('');
  const [pace, setPace] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'meters' | 'miles' | 'km'>('meters');
  const [paceUnit, setPaceUnit] = useState<'/mi' | '/km' | '/m'>('/mi');

  // Get logged segments (sets that have data)
  const loggedSegments = sets.filter(
    (s) => s.distance_meters || s.duration_seconds || s.avg_pace
  );

  // Get next set order
  const nextSetOrder = Math.max(0, ...sets.map((s) => s.set_order)) + 1;

  // Handle logging a segment
  const handleLogSegment = useCallback(async () => {
    let distanceMeters: number | null = null;
    
    if (selectedDistance) {
      distanceMeters = selectedDistance; // Already in meters
    } else if (customDistance) {
      const customValue = parseFloat(customDistance);
      if (!isNaN(customValue)) {
        // Convert to meters based on unit
        if (distanceUnit === 'miles') {
          distanceMeters = milesToMeters(customValue);
        } else if (distanceUnit === 'km') {
          distanceMeters = kmToMeters(customValue);
        } else {
          distanceMeters = customValue; // Already meters
        }
      }
    }
    
    if (!distanceMeters && !pace) {
      Alert.alert('Missing Info', 'Please enter a distance or pace.');
      return;
    }

    // Format pace with unit
    const paceWithUnit = pace ? `${pace}${paceUnit}` : null;

    setIsLogging(true);
    try {
      await onSaveSet(exercise.id, nextSetOrder, {
        distance_meters: distanceMeters,
        avg_pace: paceWithUnit,
        segment_type: segmentType,
        is_warmup: segmentType === 'warmup',
        is_pr: false,
      });

      // Reset form for next entry (keep segment type)
      setPace('');
      
      // If work segment, keep distance for quick duplicate
      if (segmentType !== 'work') {
        setSelectedDistance(400);
        setCustomDistance('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to log segment. Please try again.');
    } finally {
      setIsLogging(false);
    }
  }, [exercise.id, nextSetOrder, selectedDistance, customDistance, pace, paceUnit, distanceUnit, segmentType, onSaveSet]);

  // Handle duplicate (copy last segment)
  const handleDuplicate = useCallback(async () => {
    if (loggedSegments.length === 0) return;

    const lastSegment = loggedSegments[loggedSegments.length - 1];
    setIsLogging(true);
    try {
      await onSaveSet(exercise.id, nextSetOrder, {
        distance_meters: lastSegment.distance_meters,
        avg_pace: lastSegment.avg_pace,
        segment_type: lastSegment.segment_type,
        is_warmup: lastSegment.segment_type === 'warmup',
        is_pr: false,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to duplicate segment.');
    } finally {
      setIsLogging(false);
    }
  }, [exercise.id, nextSetOrder, loggedSegments, onSaveSet]);

  // Handle delete segment
  const handleDeleteSegment = useCallback(
    async (setId: string) => {
      const confirmDelete = () => {
        if (Platform.OS === 'web') {
          return window.confirm('Delete this segment?');
        }
        return new Promise<boolean>((resolve) => {
          Alert.alert('Delete Segment', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
      };

      const confirmed = await confirmDelete();
      if (confirmed) {
        await onDeleteSet(setId);
      }
    },
    [onDeleteSet]
  );

  // Get segment config for display
  const getSegmentConfig = (type: SegmentType) =>
    SEGMENT_TYPES.find((s) => s.type === type) || SEGMENT_TYPES[1];

  const currentConfig = getSegmentConfig(segmentType);

  return (
    <View className="px-4 pt-4">
      {/* Segment Type Picker */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
          Segment Type
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SEGMENT_TYPES.map((seg) => (
            <Pressable
              key={seg.type}
              onPress={() => setSegmentType(seg.type)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: segmentType === seg.type ? seg.bgColor : 'rgba(255, 255, 255, 0.05)',
                borderWidth: segmentType === seg.type ? 2 : 1,
                borderColor: segmentType === seg.type ? seg.color : 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: segmentType === seg.type ? seg.color : Colors.graphite[400],
                }}
              >
                {seg.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Distance Presets */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
            Distance
          </Text>
          {/* Unit Toggle */}
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {(['meters', 'miles', 'km'] as const).map((unit) => (
              <Pressable
                key={unit}
                onPress={() => {
                  setDistanceUnit(unit);
                  setSelectedDistance(null);
                  setCustomDistance('');
                }}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  backgroundColor: distanceUnit === unit ? Colors.signal[500] : 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: distanceUnit === unit ? '#fff' : Colors.graphite[400],
                  }}
                >
                  {unit === 'meters' ? 'm' : unit === 'miles' ? 'mi' : 'km'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {getDistancePresets(distanceUnit).map((preset) => (
            <Pressable
              key={preset.meters}
              onPress={() => {
                setSelectedDistance(preset.meters);
                setCustomDistance('');
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
                borderWidth: 1,
                backgroundColor: selectedDistance === preset.meters ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: selectedDistance === preset.meters ? Colors.signal[500] : 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  color: selectedDistance === preset.meters ? Colors.signal[500] : Colors.graphite[100],
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {/* Custom distance input */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, marginRight: 8, color: Colors.graphite[400] }}>
            Custom:
          </Text>
          <TextInput
            style={{
              flex: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: Colors.graphite[100],
              borderWidth: 1,
              borderColor: customDistance ? Colors.signal[500] : 'rgba(255, 255, 255, 0.1)',
            }}
            value={customDistance}
            onChangeText={(text) => {
              setCustomDistance(text);
              if (text) setSelectedDistance(null);
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={Colors.graphite[500]}
          />
          <Text style={{ marginLeft: 8, fontSize: 14, color: Colors.graphite[400] }}>
            {distanceUnit === 'meters' ? 'meters' : distanceUnit === 'miles' ? 'miles' : 'km'}
          </Text>
        </View>
      </View>

      {/* Pace Input */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[300] }}>
            Pace
          </Text>
          {/* Pace Unit Toggle */}
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {(['/mi', '/km', '/m'] as const).map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setPaceUnit(unit)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 4,
                  backgroundColor: paceUnit === unit ? Colors.signal[500] : 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: paceUnit === unit ? '#fff' : Colors.graphite[400],
                  }}
                >
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            style={{
              flex: 1,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 8,
              textAlign: 'center',
              fontSize: 18,
              fontWeight: '600',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: Colors.graphite[100],
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
            value={pace}
            onChangeText={setPace}
            placeholder="8:45"
            placeholderTextColor={Colors.graphite[500]}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={{ marginLeft: 12, fontSize: 18, color: Colors.graphite[400] }}>
            {paceUnit}
          </Text>
        </View>
      </View>

      {/* Log Button */}
      <Pressable
        onPress={handleLogSegment}
        disabled={isLogging}
        className={`py-4 rounded-xl items-center mb-6 ${
          isLogging ? 'opacity-50' : ''
        }`}
        style={{ backgroundColor: currentConfig.color }}
      >
        <Text className="text-white font-semibold text-lg">
          {isLogging ? 'Logging...' : 'Log Interval'}
        </Text>
      </Pressable>

      {/* Logged Segments */}
      {loggedSegments.length > 0 && (
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 12, color: Colors.graphite[300] }}>
            Logged ({loggedSegments.length})
          </Text>

          {loggedSegments.map((segment, index) => {
            const config = getSegmentConfig(segment.segment_type || 'work');
            const distanceStr = segment.distance_meters
              ? formatDistance(segment.distance_meters)
              : '';
            const paceStr = segment.avg_pace ? formatPace(segment.avg_pace) : '';

            return (
              <View
                key={segment.id || index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                  backgroundColor: config.bgColor,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: config.color }}>
                    {config.label}
                  </Text>
                  <Text style={{ fontSize: 14, marginTop: 2, color: Colors.graphite[300] }}>
                    {distanceStr}
                    {distanceStr && paceStr ? ' @ ' : ''}
                    {paceStr}
                  </Text>
                </View>

                {/* Delete button */}
                {segment.id && (
                  <Pressable
                    onPress={() => handleDeleteSegment(segment.id)}
                    style={{ padding: 8 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* Duplicate button */}
          <Pressable
            onPress={handleDuplicate}
            disabled={isLogging}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderStyle: 'dashed',
              marginTop: 8,
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <Ionicons name="copy-outline" size={18} color={Colors.graphite[400]} />
            <Text style={{ marginLeft: 8, fontWeight: '500', color: Colors.graphite[400] }}>
              + Duplicate Last
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
