import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import {
  parseIntent as parseNaturalLanguageIntent,
  mapToStoreModificationIntent,
  type ActionIntent,
  type ModifySessionPayload,
} from '@/lib/intentParser';
import {
  useFluidSessionStore,
  type FluidExercise,
  type FluidSet,
  type ModificationIntent,
} from '@/stores/useFluidSessionStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// AGENT HEADER COMPONENT
// ============================================================================

interface AgentHeaderProps {
  message: string;
  onDismiss: () => void;
}

function AgentHeader({ message, onDismiss }: AgentHeaderProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse the icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
        marginHorizontal: 16,
        marginBottom: 16,
      }}
    >
      <LinearGradient
        colors={['rgba(59, 130, 246, 0.15)', 'rgba(139, 92, 246, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(139, 92, 246, 0.3)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
          }}
        >
          {/* Animated AI Icon */}
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(139, 92, 246, 0.3)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="sparkles" size={20} color="#A78BFA" />
          </Animated.View>

          {/* Message */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: '#A78BFA',
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                marginBottom: 4,
              }}
            >
              Coach
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: Colors.graphite[100],
                lineHeight: 20,
              }}
            >
              {message}
            </Text>
          </View>

          {/* Dismiss */}
          <Pressable
            onPress={onDismiss}
            style={{
              padding: 8,
              marginLeft: 8,
            }}
          >
            <Ionicons name="close" size={20} color={Colors.graphite[400]} />
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================================================
// EXERCISE CARD COMPONENT
// ============================================================================

interface ExerciseCardProps {
  exercise: FluidExercise;
  exerciseNumber: number;
  totalExercises: number;
  e1rm?: number | null; // Estimated 1RM / PR for this exercise
}

function ExerciseCard({ exercise, exerciseNumber, totalExercises, e1rm }: ExerciseCardProps) {
  const { base, context, sets } = exercise;
  const lastPerf = context.lastPerformance;

  // Get the first pending/active set's target load for Near PR check
  const activeSet = sets.find((s) => s.uiStatus === 'active' || s.uiStatus === 'pending');
  const currentTargetLoad = activeSet?.target_load;

  // Check if we're within 95% of PR (Near PR territory)
  const isNearPR = e1rm && currentTargetLoad && currentTargetLoad >= e1rm * 0.95;

  // Format last session as compact chip: "Last: 225x5 @ RPE 8"
  const lastSessionChip =
    lastPerf?.last_weight && lastPerf?.last_reps
      ? `${lastPerf.last_weight}×${lastPerf.last_reps}${lastPerf.last_rpe ? ` @ RPE ${lastPerf.last_rpe}` : ''}`
      : null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Exercise Header */}
      <LinearGradient
        colors={['rgba(59, 130, 246, 0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ padding: 20 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            {/* Progress indicator */}
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: Colors.signal[400],
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                marginBottom: 6,
              }}
            >
              Exercise {exerciseNumber} of {totalExercises}
            </Text>

            {/* Exercise name */}
            <Text
              style={{
                fontSize: 24,
                fontWeight: '700',
                color: Colors.graphite[50],
                marginBottom: 4,
              }}
            >
              {base.name}
            </Text>

            {/* Muscle group */}
            <Text
              style={{
                fontSize: 13,
                color: Colors.graphite[400],
              }}
            >
              {base.muscle_group} {base.equipment ? `\u2022 ${base.equipment}` : ''}
            </Text>
          </View>

          {/* Badge Stack */}
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {/* Near PR Badge */}
            {isNearPR && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: 'rgba(245, 158, 11, 0.25)',
                  borderWidth: 1,
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                }}
              >
                <Ionicons name="flash" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: '#F59E0B',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Near PR
                </Text>
              </View>
            )}

            {/* Modality badge */}
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor:
                  base.modality === 'Strength'
                    ? 'rgba(59, 130, 246, 0.2)'
                    : base.modality === 'Cardio'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(245, 158, 11, 0.2)',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color:
                    base.modality === 'Strength'
                      ? Colors.signal[400]
                      : base.modality === 'Cardio'
                      ? Colors.emerald[400]
                      : Colors.oxide[400],
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {base.modality}
              </Text>
            </View>
          </View>
        </View>

        {/* Context Chips Row */}
        {(lastSessionChip || e1rm) && (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 16,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255, 255, 255, 0.06)',
            }}
          >
            {/* Last Session Chip */}
            {lastSessionChip && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <Ionicons name="time-outline" size={14} color={Colors.graphite[400]} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.graphite[300] }}>
                  Last: {lastSessionChip}
                </Text>
              </View>
            )}

            {/* PR Reference Chip */}
            {e1rm && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <Ionicons name="trophy-outline" size={14} color={Colors.graphite[400]} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.graphite[300] }}>
                  PR: {e1rm} lbs
                </Text>
              </View>
            )}

            {/* Trend Badge */}
            {lastPerf?.trend && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor:
                    lastPerf.trend === 'progressing'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : lastPerf.trend === 'regressing'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                }}
              >
                <Ionicons
                  name={
                    lastPerf.trend === 'progressing'
                      ? 'trending-up'
                      : lastPerf.trend === 'regressing'
                      ? 'trending-down'
                      : 'remove'
                  }
                  size={14}
                  color={
                    lastPerf.trend === 'progressing'
                      ? Colors.emerald[400]
                      : lastPerf.trend === 'regressing'
                      ? Colors.regression[400]
                      : Colors.oxide[400]
                  }
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color:
                      lastPerf.trend === 'progressing'
                        ? Colors.emerald[400]
                        : lastPerf.trend === 'regressing'
                        ? Colors.regression[400]
                        : Colors.oxide[400],
                    textTransform: 'capitalize',
                  }}
                >
                  {lastPerf.trend}
                </Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

// ============================================================================
// SET ROW COMPONENT
// ============================================================================

interface SetRowProps {
  set: FluidSet;
  setNumber: number;
  isActive: boolean;
  onLog: (result: { rpe: number; weight: number; reps: number }) => void;
}

function SetRow({ set, setNumber, isActive, onLog }: SetRowProps) {
  const [weight, setWeight] = useState(set.target_load?.toString() || '');
  const [reps, setReps] = useState(set.target_reps?.toString() || '');
  const [rpe, setRpe] = useState(set.target_rpe?.toString() || '');

  // Update local state when set becomes active or target values change
  useEffect(() => {
    if (isActive && set.uiStatus === 'active') {
      setWeight(set.target_load?.toString() || '');
      setReps(set.target_reps?.toString() || '');
      setRpe(set.target_rpe?.toString() || '7');
    }
  }, [isActive, set.target_load, set.target_reps, set.target_rpe, set.uiStatus]);

  const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.98)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ])
        ),
      ]).start();
    } else {
      scaleAnim.setValue(0.98);
      glowAnim.setValue(0);
    }
  }, [isActive]);

  const handleLog = useCallback(() => {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps, 10) || 0;
    const p = parseFloat(rpe) || 7;
    onLog({ weight: w, reps: r, rpe: p });
  }, [weight, reps, rpe, onLog]);

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.6)'],
  });

  const isCompleted = set.uiStatus === 'completed';
  const isPending = set.uiStatus === 'pending';

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        marginHorizontal: 16,
        marginBottom: 12,
      }}
    >
      <Animated.View
        style={{
          borderRadius: 16,
          backgroundColor: isActive
            ? 'rgba(59, 130, 246, 0.08)'
            : isCompleted
            ? 'rgba(16, 185, 129, 0.05)'
            : 'rgba(255, 255, 255, 0.02)',
          borderWidth: isActive ? 2 : 1,
          borderColor: isActive
            ? borderColor
            : isCompleted
            ? 'rgba(16, 185, 129, 0.2)'
            : 'rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
        }}
      >
        <View style={{ padding: 16 }}>
          {/* Set Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Set Number */}
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isCompleted
                    ? Colors.emerald[500]
                    : isActive
                    ? Colors.signal[500]
                    : 'rgba(255, 255, 255, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: isActive ? '#fff' : Colors.graphite[400],
                    }}
                  >
                    {setNumber}
                  </Text>
                )}
              </View>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isCompleted
                    ? Colors.emerald[400]
                    : isActive
                    ? Colors.graphite[50]
                    : Colors.graphite[500],
                }}
              >
                {isCompleted ? 'Completed' : isActive ? 'Current Set' : 'Set ' + setNumber}
              </Text>

              {/* Warmup indicator */}
              {set.is_warmup && (
                <View
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.oxide[400] }}>WARMUP</Text>
                </View>
              )}
            </View>

            {/* Agent Reasoning Badge */}
            {set.agentReasoning && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                }}
              >
                <Ionicons name="sparkles" size={12} color="#A78BFA" />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: '#A78BFA',
                    marginLeft: 5,
                  }}
                >
                  {set.agentAdjusted && set.target_load
                    ? `\u25B2 ${set.target_load}lbs`
                    : 'Adjusted'}
                </Text>
              </View>
            )}
          </View>

          {/* Input Row or Completed Values */}
          {isCompleted ? (
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <View>
                <Text style={{ fontSize: 10, color: Colors.graphite[500], marginBottom: 2 }}>WEIGHT</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[100] }}>
                  {set.actual_weight} lbs
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 10, color: Colors.graphite[500], marginBottom: 2 }}>REPS</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[100] }}>
                  {set.actual_reps}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 10, color: Colors.graphite[500], marginBottom: 2 }}>RPE</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[100] }}>
                  {set.actual_rpe}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Weight Input */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: Colors.graphite[500],
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  Weight
                </Text>
                <TextInput
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 18,
                    fontWeight: '600',
                    color: isActive ? Colors.graphite[50] : Colors.graphite[400],
                    textAlign: 'center',
                  }}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  editable={isActive}
                  placeholder={set.target_load?.toString() || '-'}
                  placeholderTextColor={Colors.graphite[600]}
                />
              </View>

              {/* Reps Input */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: Colors.graphite[500],
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  Reps
                </Text>
                <TextInput
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 18,
                    fontWeight: '600',
                    color: isActive ? Colors.graphite[50] : Colors.graphite[400],
                    textAlign: 'center',
                  }}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="numeric"
                  editable={isActive}
                  placeholder={set.target_reps?.toString() || '-'}
                  placeholderTextColor={Colors.graphite[600]}
                />
              </View>

              {/* RPE Input */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color: Colors.graphite[500],
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  RPE
                </Text>
                <TextInput
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 18,
                    fontWeight: '600',
                    color: isActive ? Colors.graphite[50] : Colors.graphite[400],
                    textAlign: 'center',
                  }}
                  value={rpe}
                  onChangeText={setRpe}
                  keyboardType="decimal-pad"
                  editable={isActive}
                  placeholder={set.target_rpe?.toString() || '7'}
                  placeholderTextColor={Colors.graphite[600]}
                />
              </View>
            </View>
          )}

          {/* Log Button for Active Set */}
          {isActive && !isCompleted && (
            <Pressable
              onPress={handleLog}
              style={({ pressed }) => ({
                marginTop: 16,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: pressed ? Colors.signal[600] : Colors.signal[500],
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              })}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#fff',
                  marginLeft: 8,
                }}
              >
                Log Set
              </Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================================
// NATURAL LANGUAGE INTENT PARSING
// ============================================================================

/**
 * Result of parsing user input with additional metadata for UI feedback.
 */
interface ParseResult {
  type: 'modification' | 'workout_log' | 'cardio_log' | 'chat' | 'unknown';
  modificationIntent?: ModificationIntent;
  parsedIntent: ActionIntent;
  feedbackMessage?: string;
}

/**
 * Parses user text input using the NLP intent parser.
 * Returns a structured result with the parsed intent and UI feedback.
 */
function parseUserInput(text: string): ParseResult {
  const parsedIntent = parseNaturalLanguageIntent(text);

  switch (parsedIntent.type) {
    case 'MODIFY_SESSION': {
      const payload = parsedIntent.payload as ModifySessionPayload;
      const storeIntent = mapToStoreModificationIntent(payload);

      if (storeIntent) {
        return {
          type: 'modification',
          modificationIntent: storeIntent,
          parsedIntent,
          feedbackMessage: payload.reason,
        };
      }

      // Unrecognized modification
      return {
        type: 'unknown',
        parsedIntent,
        feedbackMessage: 'I detected a modification request but couldn\'t determine the action.',
      };
    }

    case 'LOG_WORKOUT': {
      return {
        type: 'workout_log',
        parsedIntent,
        feedbackMessage: `Detected workout: ${JSON.stringify(parsedIntent.payload)}`,
      };
    }

    case 'LOG_CARDIO': {
      return {
        type: 'cardio_log',
        parsedIntent,
        feedbackMessage: `Detected cardio: ${JSON.stringify(parsedIntent.payload)}`,
      };
    }

    case 'CHAT': {
      return {
        type: 'chat',
        parsedIntent,
        feedbackMessage: undefined, // No feedback for chat
      };
    }

    default:
      return {
        type: 'unknown',
        parsedIntent,
        feedbackMessage: 'I didn\'t quite understand that. Try "too easy", "knee hurts", or "running late".',
      };
  }
}

/**
 * Legacy function for backward compatibility.
 * Parses user text and returns a ModificationIntent or null.
 */
function parseIntent(text: string): ModificationIntent | null {
  const result = parseUserInput(text);
  return result.modificationIntent || null;
}

// ============================================================================
// COMMAND INPUT BAR
// ============================================================================

interface CommandInputBarProps {
  onSubmit: (intent: ModificationIntent, context?: string) => void;
  onWorkoutLog?: (payload: ActionIntent['payload']) => void;
  onCardioLog?: (payload: ActionIntent['payload']) => void;
}

function CommandInputBar({ onSubmit, onWorkoutLog, onCardioLog }: CommandInputBarProps) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();

  // Voice input
  const {
    isListening,
    transcript,
    finalTranscript,
    startListening,
    stopListening,
    clearTranscript,
  } = useVoiceInput();

  // Pulsing animation for listening state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      // Start pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Glow animation
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
      glow.start();

      return () => {
        pulse.stop();
        glow.stop();
        pulseAnim.setValue(1);
        glowAnim.setValue(0);
      };
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isListening]);

  // Update input text when we get a transcript
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  // Auto-submit when final transcript is received
  useEffect(() => {
    if (finalTranscript && finalTranscript.trim()) {
      // Small delay to let user see what was transcribed
      const timer = setTimeout(() => {
        handleSubmitText(finalTranscript);
        clearTranscript();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [finalTranscript]);

  // Clear feedback message after delay
  const showFeedback = useCallback((message: string, duration = 3000) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setFeedbackMessage(message);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackMessage(null);
    }, duration);
  }, []);

  const handleSubmitText = useCallback((text: string) => {
    if (!text.trim() || isProcessing) return;

    // Parse using the NLP intent parser
    const result = parseUserInput(text);

    // Show loading state
    setIsProcessing(true);
    setInputText('');

    // Small delay to show processing state
    setTimeout(() => {
      switch (result.type) {
        case 'modification':
          if (result.modificationIntent) {
            onSubmit(result.modificationIntent, text);
          }
          break;

        case 'workout_log':
          if (onWorkoutLog) {
            onWorkoutLog(result.parsedIntent.payload);
            showFeedback('Workout logged!', 2000);
          } else {
            // No handler, show feedback about what was detected
            showFeedback(result.feedbackMessage || 'Workout detected but logging not available in session mode.', 3000);
          }
          break;

        case 'cardio_log':
          if (onCardioLog) {
            onCardioLog(result.parsedIntent.payload);
            showFeedback('Cardio logged!', 2000);
          } else {
            showFeedback(result.feedbackMessage || 'Cardio detected but logging not available in session mode.', 3000);
          }
          break;

        case 'chat':
          // For chat, we could integrate with an LLM later
          // For now, just acknowledge
          showFeedback('Try commands like "too easy", "knee hurts", or "running late"', 3000);
          break;

        case 'unknown':
        default:
          showFeedback(result.feedbackMessage || 'I didn\'t understand that. Try "too hard" or "add set".', 3000);
          break;
      }

      setIsProcessing(false);
    }, 300);
  }, [onSubmit, onWorkoutLog, onCardioLog, isProcessing, showFeedback]);

  const handleSubmit = useCallback(() => {
    handleSubmitText(inputText);
  }, [inputText, handleSubmitText]);

  const handleMicPress = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const quickActions: { icon: string; label: string; intent: ModificationIntent }[] = [
    { icon: 'add-circle', label: 'Add Set', intent: 'add_set' },
    { icon: 'chevron-up-circle', label: 'Too Easy', intent: 'too_easy' },
    { icon: 'chevron-down-circle', label: 'Too Hard', intent: 'too_hard' },
    { icon: 'alert-circle', label: 'Pain', intent: 'pain' },
  ];

  const micBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.8)'],
  });

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: insets.bottom + 8,
        paddingTop: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(10, 10, 10, 0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Listening Indicator */}
      {isListening && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
            paddingVertical: 6,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#EF4444',
              marginRight: 8,
            }}
          />
          <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '600' }}>
            Listening...
          </Text>
        </View>
      )}

      {/* Feedback Message */}
      {feedbackMessage && !isListening && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(59, 130, 246, 0.3)',
          }}
        >
          <Ionicons
            name="information-circle"
            size={16}
            color="#3B82F6"
            style={{ marginRight: 8 }}
          />
          <Text
            style={{
              fontSize: 13,
              color: '#93C5FD',
              flex: 1,
              textAlign: 'center',
            }}
          >
            {feedbackMessage}
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
        contentContainerStyle={{ gap: 8 }}
      >
        {quickActions.map((action) => (
          <Pressable
            key={action.intent}
            onPress={() => onSubmit(action.intent)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: pressed
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(255, 255, 255, 0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            })}
          >
            <Ionicons
              name={action.icon as keyof typeof Ionicons.glyphMap}
              size={16}
              color={Colors.graphite[300]}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '500',
                color: Colors.graphite[200],
                marginLeft: 6,
              }}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Text Input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 24,
          borderWidth: 1,
          borderColor: isListening ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)',
          paddingLeft: 6,
          paddingRight: 6,
        }}
      >
        {/* Mic Button */}
        <Pressable onPress={handleMicPress}>
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isListening ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              borderWidth: isListening ? 2 : 0,
              borderColor: isListening ? micBorderColor : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={20}
              color={isListening ? '#EF4444' : Colors.graphite[400]}
            />
          </Animated.View>
        </Pressable>

        <TextInput
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 8,
            fontSize: 15,
            color: Colors.graphite[50],
          }}
          placeholder={
            isProcessing
              ? 'Processing...'
              : isListening
                ? 'Speak now...'
                : 'Tell coach what\'s happening...'
          }
          placeholderTextColor={
            isProcessing
              ? Colors.signal[400]
              : isListening
                ? '#EF4444'
                : Colors.graphite[500]
          }
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          editable={!isListening && !isProcessing}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={isListening || isProcessing}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isProcessing
              ? Colors.signal[500]
              : inputText.trim() && !isListening
                ? pressed
                  ? Colors.signal[600]
                  : Colors.signal[500]
                : 'rgba(255, 255, 255, 0.05)',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons
            name={isProcessing ? 'hourglass' : 'send'}
            size={16}
            color={
              isProcessing
                ? '#fff'
                : inputText.trim() && !isListening
                  ? '#fff'
                  : Colors.graphite[600]
            }
          />
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// PROGRESS BAR
// ============================================================================

interface ProgressBarProps {
  completed: number;
  total: number;
}

function ProgressBar({ completed, total }: ProgressBarProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.graphite[400] }}>
          Session Progress
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.graphite[200] }}>
          {completed}/{total} sets
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            borderRadius: 3,
            backgroundColor: Colors.signal[500],
            width: widthAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface FluidSessionViewProps {
  /** Map of exercise ID to e1rm (estimated 1RM / PR) for Near PR detection */
  personalRecords?: Map<string, number>;
}

export function FluidSessionView({ personalRecords }: FluidSessionViewProps = {}) {
  const insets = useSafeAreaInsets();

  const {
    isActive,
    sessionQueue,
    activeExerciseIndex,
    activeSetIndex,
    agentMessage,
    logSet,
    requestModification,
    dismissAgentMessage,
    getSessionProgress,
  } = useFluidSessionStore();

  const currentExercise = sessionQueue[activeExerciseIndex];
  const progress = getSessionProgress();

  // Get e1rm for the current exercise
  const currentExerciseE1rm = currentExercise
    ? personalRecords?.get(currentExercise.base.id) ?? null
    : null;

  if (!isActive || !currentExercise) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.void[900],
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <Ionicons name="fitness" size={64} color={Colors.graphite[600]} />
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: Colors.graphite[400],
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          No active session
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: Colors.graphite[500],
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          Start a workout to begin your fluid training session.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.void[900] }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Ambient Background Effects */}
      <View
        style={{
          position: 'absolute',
          top: -120,
          left: -80,
          width: 300,
          height: 300,
          backgroundColor: 'rgba(59, 130, 246, 0.04)',
          borderRadius: 150,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 150,
          right: -100,
          width: 280,
          height: 280,
          backgroundColor: 'rgba(139, 92, 246, 0.03)',
          borderRadius: 140,
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 180, // Space for command bar
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Agent Message Header */}
        {agentMessage && (
          <AgentHeader message={agentMessage} onDismiss={dismissAgentMessage} />
        )}

        {/* Progress Bar */}
        <ProgressBar completed={progress.completed} total={progress.total} />

        {/* Current Exercise Card */}
        <ExerciseCard
          exercise={currentExercise}
          exerciseNumber={activeExerciseIndex + 1}
          totalExercises={sessionQueue.length}
          e1rm={currentExerciseE1rm}
        />

        {/* Sets List */}
        <View style={{ marginTop: 4 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: Colors.graphite[500],
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginLeft: 16,
              marginBottom: 12,
            }}
          >
            Working Sets
          </Text>

          {currentExercise.sets.map((set, idx) => (
            <SetRow
              key={`${set.id}-${set.uiStatus}`}
              set={set}
              setNumber={idx + 1}
              isActive={set.uiStatus === 'active'}
              onLog={(result) => logSet(currentExercise.base.id, set.id, result)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Command Input Bar */}
      <CommandInputBar onSubmit={requestModification} />
    </KeyboardAvoidingView>
  );
}

export default FluidSessionView;
