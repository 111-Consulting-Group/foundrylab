/**
 * WeekPlanner Component
 *
 * Two-screen flow:
 * 1. Set Targets: Stepper inputs for session counts
 * 2. Review & Adjust: 7-day grid with generated workouts
 *
 * Designed for Sunday night planning ritual.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek } from 'date-fns';

import { Colors } from '@/constants/Colors';
import { GlassCard, LabButton } from '@/components/ui/LabPrimitives';
import { DayCard, DayCardCompact } from './DayCard';
import {
  useGenerateWeekPlan,
  useSaveWeekPlan,
  useRunningSchedule,
} from '@/hooks/useWeekPlanGenerator';
import { DEFAULT_WEEKLY_TARGETS } from '@/types/coach';
import type { WeeklyTargets, WeeklyPlan, DayOfWeek } from '@/types/coach';

// ============================================================================
// Types
// ============================================================================

type PlannerStep = 'targets' | 'review';

interface WeekPlannerProps {
  onComplete?: (plan: WeeklyPlan) => void;
  onCancel?: () => void;
}

// ============================================================================
// Stepper Component
// ============================================================================

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: string;
  description?: string;
}

function Stepper({ label, value, min, max, onChange, unit, description }: StepperProps) {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };

  const increment = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <View style={stepperStyles.container}>
      <View style={stepperStyles.labelContainer}>
        <Text style={stepperStyles.label}>{label}</Text>
        {description && <Text style={stepperStyles.description}>{description}</Text>}
      </View>

      <View style={stepperStyles.controls}>
        <Pressable
          onPress={decrement}
          disabled={value <= min}
          style={({ pressed }) => [
            stepperStyles.button,
            pressed && stepperStyles.buttonPressed,
            value <= min && stepperStyles.buttonDisabled,
          ]}
        >
          <Ionicons
            name="remove"
            size={18}
            color={value <= min ? Colors.graphite[600] : Colors.graphite[200]}
          />
        </Pressable>

        <View style={stepperStyles.valueContainer}>
          <Text style={stepperStyles.value}>{value}</Text>
          {unit && <Text style={stepperStyles.unit}>{unit}</Text>}
        </View>

        <Pressable
          onPress={increment}
          disabled={value >= max}
          style={({ pressed }) => [
            stepperStyles.button,
            pressed && stepperStyles.buttonPressed,
            value >= max && stepperStyles.buttonDisabled,
          ]}
        >
          <Ionicons
            name="add"
            size={18}
            color={value >= max ? Colors.graphite[600] : Colors.graphite[200]}
          />
        </Pressable>
      </View>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.white[5],
  },
  labelContainer: {
    flex: 1,
    marginRight: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.graphite[100],
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: Colors.graphite[500],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.glass.white[10],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: Colors.glass.white[20],
    transform: [{ scale: 0.95 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  valueContainer: {
    minWidth: 60,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: Colors.graphite[50],
  },
  unit: {
    fontSize: 10,
    color: Colors.graphite[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

// ============================================================================
// Day Selector Component (for available days)
// ============================================================================

const ALL_DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

interface DaySelectorProps {
  selectedDays: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
}

function DaySelector({ selectedDays, onChange }: DaySelectorProps) {
  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter((d) => d !== day));
    } else {
      onChange([...selectedDays, day]);
    }
  };

  return (
    <View style={daySelectorStyles.container}>
      <Text style={daySelectorStyles.label}>Available Days</Text>
      <View style={daySelectorStyles.days}>
        {ALL_DAYS.map((day) => (
          <Pressable
            key={day}
            onPress={() => toggleDay(day)}
            style={[
              daySelectorStyles.dayButton,
              selectedDays.includes(day) && daySelectorStyles.dayButtonSelected,
            ]}
          >
            <Text
              style={[
                daySelectorStyles.dayLabel,
                selectedDays.includes(day) && daySelectorStyles.dayLabelSelected,
              ]}
            >
              {DAY_LABELS[day]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const daySelectorStyles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.graphite[300],
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.glass.white[5],
    borderWidth: 1,
    borderColor: Colors.glass.white[10],
  },
  dayButtonSelected: {
    backgroundColor: Colors.signal[500],
    borderColor: Colors.signal[400],
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.graphite[400],
  },
  dayLabelSelected: {
    color: '#000',
  },
});

// ============================================================================
// Main WeekPlanner Component
// ============================================================================

export function WeekPlanner({ onComplete, onCancel }: WeekPlannerProps) {
  // State
  const [step, setStep] = useState<PlannerStep>('targets');
  const [targets, setTargets] = useState<WeeklyTargets>(DEFAULT_WEEKLY_TARGETS);
  const [generatedPlan, setGeneratedPlan] = useState<WeeklyPlan | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState<number | null>(null);

  // Hooks
  const { data: runningSchedule, isLoading: loadingSchedule } = useRunningSchedule();
  const generateMutation = useGenerateWeekPlan();
  const saveMutation = useSaveWeekPlan();

  // Week date info
  const weekStart = useMemo(() => {
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    return today > monday ? addDays(monday, 7) : monday;
  }, []);

  const weekLabel = useMemo(() => {
    return `Week of ${format(weekStart, 'MMM d')}`;
  }, [weekStart]);

  // Target updaters
  const updateHypertrophyMin = useCallback((value: number) => {
    setTargets((t) => ({
      ...t,
      hypertrophySessions: { ...t.hypertrophySessions, min: value, max: Math.max(value, t.hypertrophySessions.max) },
    }));
  }, []);

  const updateHypertrophyMax = useCallback((value: number) => {
    setTargets((t) => ({
      ...t,
      hypertrophySessions: { ...t.hypertrophySessions, max: value, min: Math.min(value, t.hypertrophySessions.min) },
    }));
  }, []);

  const updateZone2Min = useCallback((value: number) => {
    setTargets((t) => ({
      ...t,
      zone2Sessions: { ...t.zone2Sessions, min: value, max: Math.max(value, t.zone2Sessions.max) },
    }));
  }, []);

  const updateZone2Duration = useCallback((value: number) => {
    setTargets((t) => ({
      ...t,
      zone2Sessions: { ...t.zone2Sessions, durationMinutes: value },
    }));
  }, []);

  const updateTempo = useCallback((value: number) => {
    setTargets((t) => ({ ...t, tempoSessions: value }));
  }, []);

  const updateRestDays = useCallback((value: number) => {
    setTargets((t) => ({ ...t, restDays: value }));
  }, []);

  const updateAvailableDays = useCallback((days: DayOfWeek[]) => {
    setTargets((t) => ({ ...t, availableDays: days }));
  }, []);

  // Generate plan
  const handleGeneratePlan = useCallback(async () => {
    try {
      const result = await generateMutation.mutateAsync({
        targets,
        runningSchedule: runningSchedule || undefined,
        weekStartDate: weekStart,
      });

      setGeneratedPlan(result.plan);
      setWarnings(result.warnings);
      setStep('review');
    } catch (error) {
      Alert.alert('Error', 'Failed to generate week plan. Please try again.');
    }
  }, [targets, runningSchedule, weekStart, generateMutation]);

  // Handle day swap
  const handleDaySwap = useCallback(
    (dayIndex: number) => {
      if (swapSelection === null) {
        setSwapSelection(dayIndex);
      } else if (swapSelection === dayIndex) {
        // Deselect
        setSwapSelection(null);
      } else {
        // Perform swap
        if (generatedPlan) {
          const newDays = [...generatedPlan.days];
          const day1 = { ...newDays[swapSelection] };
          const day2 = { ...newDays[dayIndex] };

          // Swap content but keep day numbers/names
          newDays[swapSelection] = {
            ...day2,
            dayNumber: day1.dayNumber,
            dayName: day1.dayName,
            isLocked: true,
          };
          newDays[dayIndex] = {
            ...day1,
            dayNumber: day2.dayNumber,
            dayName: day2.dayName,
            isLocked: true,
          };

          setGeneratedPlan({
            ...generatedPlan,
            days: newDays,
            adjustmentsApplied: [
              ...(generatedPlan.adjustmentsApplied || []),
              `Swapped ${day1.dayName} and ${day2.dayName}`,
            ],
          });
        }
        setSwapSelection(null);
        setSwapMode(false);
      }
    },
    [swapSelection, generatedPlan]
  );

  // Save plan
  const handleSavePlan = useCallback(async () => {
    if (!generatedPlan) return;

    try {
      await saveMutation.mutateAsync({
        plan: generatedPlan,
        createWorkouts: true,
      });

      onComplete?.(generatedPlan);
    } catch (error) {
      Alert.alert('Error', 'Failed to save week plan. Please try again.');
    }
  }, [generatedPlan, saveMutation, onComplete]);

  // Render Targets Step
  if (step === 'targets') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Plan Your Week</Text>
          <Text style={styles.subtitle}>{weekLabel}</Text>
        </View>

        {/* Running Schedule Indicator */}
        {runningSchedule && runningSchedule.days.length > 0 && (
          <GlassCard variant="subtle" style={styles.scheduleCard}>
            <View style={styles.scheduleHeader}>
              <Ionicons name="walk" size={18} color={Colors.emerald[400]} />
              <Text style={styles.scheduleTitle}>Running Schedule Detected</Text>
            </View>
            <Text style={styles.scheduleText}>
              {runningSchedule.days.length} runs/week on{' '}
              {runningSchedule.days.map((d) => DAY_LABELS[d]).join(', ')}
            </Text>
            <Text style={styles.scheduleHint}>
              We'll schedule lifting around your runs
            </Text>
          </GlassCard>
        )}

        {/* Lifting Targets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="barbell" size={18} color={Colors.signal[400]} />
            <Text style={styles.sectionTitle}>Lifting</Text>
          </View>

          <Stepper
            label="Min Hypertrophy Sessions"
            description="Building muscle volume"
            value={targets.hypertrophySessions.min}
            min={1}
            max={6}
            onChange={updateHypertrophyMin}
          />
          <Stepper
            label="Max Hypertrophy Sessions"
            description="Upper limit if time allows"
            value={targets.hypertrophySessions.max}
            min={targets.hypertrophySessions.min}
            max={6}
            onChange={updateHypertrophyMax}
          />
        </View>

        {/* Cardio Targets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="heart" size={18} color={Colors.emerald[400]} />
            <Text style={styles.sectionTitle}>Cardio</Text>
          </View>

          <Stepper
            label="Zone 2 Sessions"
            description="Easy aerobic base building"
            value={targets.zone2Sessions.min}
            min={0}
            max={5}
            onChange={updateZone2Min}
          />
          <Stepper
            label="Zone 2 Duration"
            value={targets.zone2Sessions.durationMinutes}
            min={20}
            max={90}
            onChange={updateZone2Duration}
            unit="min"
          />
          <Stepper
            label="Tempo Runs"
            description="Hard effort sessions"
            value={targets.tempoSessions || 0}
            min={0}
            max={3}
            onChange={updateTempo}
          />
        </View>

        {/* Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={18} color={Colors.amber[400]} />
            <Text style={styles.sectionTitle}>Schedule</Text>
          </View>

          <Stepper
            label="Rest Days"
            description="Complete recovery days"
            value={targets.restDays}
            min={0}
            max={3}
            onChange={updateRestDays}
          />

          <DaySelector
            selectedDays={targets.availableDays}
            onChange={updateAvailableDays}
          />
        </View>

        {/* Generate Button */}
        <View style={styles.buttonContainer}>
          <LabButton
            label="Generate Week Plan"
            icon={<Ionicons name="sparkles" size={16} color="#fff" />}
            onPress={handleGeneratePlan}
            loading={generateMutation.isPending}
            disabled={targets.availableDays.length < 3}
          />
          {onCancel && (
            <LabButton
              label="Cancel"
              variant="outline"
              onPress={onCancel}
              style={{ marginTop: 10 }}
            />
          )}
        </View>
      </ScrollView>
    );
  }

  // Render Review Step
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => setStep('targets')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={Colors.graphite[300]} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Review Your Week</Text>
          <Text style={styles.subtitle}>{weekLabel}</Text>
        </View>
        <Pressable
          onPress={() => setSwapMode(!swapMode)}
          style={[styles.swapButton, swapMode && styles.swapButtonActive]}
        >
          <Ionicons
            name="swap-horizontal"
            size={18}
            color={swapMode ? '#fff' : Colors.graphite[300]}
          />
        </Pressable>
      </View>

      {/* Warnings */}
      {warnings.length > 0 && (
        <GlassCard variant="subtle" style={styles.warningCard}>
          {warnings.map((warning, idx) => (
            <View key={idx} style={styles.warningRow}>
              <Ionicons name="warning" size={16} color={Colors.amber[400]} />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </GlassCard>
      )}

      {/* Rationale */}
      {generatedPlan?.rationale && (
        <View style={styles.rationaleContainer}>
          <Text style={styles.rationaleLabel}>Plan Summary</Text>
          <Text style={styles.rationaleText}>{generatedPlan.rationale}</Text>
        </View>
      )}

      {/* Compact Week Strip */}
      <View style={styles.weekStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {generatedPlan?.days.map((day, idx) => (
            <DayCardCompact
              key={day.dayNumber}
              day={day}
              isToday={new Date().getDay() === (day.dayNumber === 7 ? 0 : day.dayNumber)}
              onPress={() => swapMode ? handleDaySwap(idx) : undefined}
            />
          ))}
        </ScrollView>
      </View>

      {/* Swap Mode Instructions */}
      {swapMode && (
        <View style={styles.swapInstructions}>
          <Ionicons name="information-circle" size={18} color={Colors.signal[400]} />
          <Text style={styles.swapInstructionsText}>
            {swapSelection !== null
              ? `Now tap another day to swap with ${generatedPlan?.days[swapSelection].dayName}`
              : 'Tap a day to select it for swapping'}
          </Text>
        </View>
      )}

      {/* Detailed Day Cards */}
      <View style={styles.dayCards}>
        {generatedPlan?.days.map((day, idx) => (
          <DayCard
            key={day.dayNumber}
            day={day}
            isToday={new Date().getDay() === (day.dayNumber === 7 ? 0 : day.dayNumber)}
            swapMode={swapMode}
            selected={swapSelection === idx}
            onSwap={() => handleDaySwap(idx)}
          />
        ))}
      </View>

      {/* Save Button */}
      <View style={styles.buttonContainer}>
        <LabButton
          label="Looks Good - Save Week"
          icon={<Ionicons name="checkmark" size={16} color="#fff" />}
          onPress={handleSavePlan}
          loading={saveMutation.isPending}
        />
        <LabButton
          label="Adjust Targets"
          variant="outline"
          onPress={() => setStep('targets')}
          style={{ marginTop: 10 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.void[900],
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.glass.white[5],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.graphite[50],
  },
  subtitle: {
    fontSize: 14,
    color: Colors.graphite[400],
    marginTop: 2,
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glass.white[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glass.white[10],
  },
  swapButtonActive: {
    backgroundColor: Colors.signal[500],
    borderColor: Colors.signal[400],
  },

  scheduleCard: {
    marginBottom: 20,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.emerald[400],
  },
  scheduleText: {
    fontSize: 13,
    color: Colors.graphite[200],
    marginBottom: 4,
  },
  scheduleHint: {
    fontSize: 12,
    color: Colors.graphite[500],
    fontStyle: 'italic',
  },

  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.white[10],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.graphite[100],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  buttonContainer: {
    marginTop: 20,
  },

  warningCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  warningText: {
    fontSize: 13,
    color: Colors.amber[300],
    flex: 1,
  },

  rationaleContainer: {
    marginBottom: 16,
  },
  rationaleLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.graphite[500],
    marginBottom: 6,
  },
  rationaleText: {
    fontSize: 14,
    color: Colors.graphite[300],
    lineHeight: 20,
  },

  weekStrip: {
    marginBottom: 20,
  },

  swapInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.glass.blue[10],
    borderRadius: 10,
    marginBottom: 16,
  },
  swapInstructionsText: {
    fontSize: 13,
    color: Colors.signal[300],
    flex: 1,
  },

  dayCards: {
    gap: 2,
  },
});

export default WeekPlanner;
