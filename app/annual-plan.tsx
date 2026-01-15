/**
 * Annual Plan Screen
 *
 * Full annual periodization view with timeline, competitions,
 * and intelligent block recommendations.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnnualCalendar } from '@/components/AnnualCalendar';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors } from '@/constants/Colors';
import {
  useAnnualPlanning,
  useCreateCompetition,
  useCreateAnnualPlan,
} from '@/hooks/useAnnualPlan';
import { formatBlockType, getBlockTypeColor, BLOCK_CHARACTERISTICS } from '@/lib/periodization';
import type {
  BlockRecommendation,
  Competition,
  EventType,
  PlannedBlock,
  TrainingGoal,
} from '@/types/database';

// ============================================================================
// Types
// ============================================================================

type ModalType = 'setup' | 'competition' | 'block-detail' | null;

// ============================================================================
// Setup Modal (First-time setup)
// ============================================================================

function SetupModal({
  visible,
  onClose,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const [step, setStep] = useState<'goal' | 'target'>('goal');
  const [selectedGoal, setSelectedGoal] = useState<TrainingGoal>('strength');
  const [competitionFocus, setCompetitionFocus] = useState(false);

  const createPlan = useCreateAnnualPlan();

  const goals: { value: TrainingGoal; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'strength', label: 'Build Strength', icon: 'barbell-outline' },
    { value: 'hypertrophy', label: 'Build Muscle', icon: 'body-outline' },
    { value: 'powerlifting', label: 'Powerlifting', icon: 'trophy-outline' },
    { value: 'athletic', label: 'Athletic Performance', icon: 'flash-outline' },
    { value: 'general', label: 'General Fitness', icon: 'fitness-outline' },
  ];

  const handleCreate = async () => {
    await createPlan.mutateAsync({
      primary_goal: selectedGoal,
      competition_focus: competitionFocus,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className={`rounded-t-3xl ${isDark ? 'bg-graphite-900' : 'bg-white'} p-6`}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="w-10 h-1 bg-graphite-400 rounded-full" />
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color={isDark ? '#E6E8EB' : '#0E1116'} />
            </Pressable>
          </View>
          <View className="flex-row items-center justify-between mb-4">
            <View className="w-10 h-1 bg-graphite-400 rounded-full" />
            <Pressable onPress={onClose} className="p-2 -mt-2">
              <Ionicons name="close" size={24} color={isDark ? '#E6E8EB' : '#0E1116'} />
            </Pressable>
          </View>

          {step === 'goal' ? (
            <>
              <Text
                className={`text-xl font-bold mb-2 ${
                  isDark ? 'text-graphite-100' : 'text-graphite-900'
                }`}
              >
                Plan Your Training Year
              </Text>
              <Text
                className={`mb-6 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
              >
                What's your primary training focus for {new Date().getFullYear()}?
              </Text>

              <View className="gap-2 mb-6">
                {goals.map((goal) => (
                  <Pressable
                    key={goal.value}
                    onPress={() => setSelectedGoal(goal.value)}
                    className={`p-4 rounded-xl flex-row items-center border-2 ${
                      selectedGoal === goal.value
                        ? 'border-signal-500 bg-signal-500/10'
                        : isDark
                        ? 'border-graphite-700 bg-graphite-800'
                        : 'border-graphite-200 bg-graphite-50'
                    }`}
                  >
                    <Ionicons
                      name={goal.icon}
                      size={24}
                      color={selectedGoal === goal.value ? '#2F80ED' : isDark ? '#808fb0' : '#607296'}
                    />
                    <Text
                      className={`ml-3 font-medium ${
                        isDark ? 'text-graphite-100' : 'text-graphite-900'
                      }`}
                    >
                      {goal.label}
                    </Text>
                    {selectedGoal === goal.value && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#2F80ED"
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => setStep('target')}
                className="py-4 rounded-xl bg-signal-500 items-center"
              >
                <Text className="text-white font-semibold">Continue</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text
                className={`text-xl font-bold mb-2 ${
                  isDark ? 'text-graphite-100' : 'text-graphite-900'
                }`}
              >
                Competition Focus?
              </Text>
              <Text
                className={`mb-6 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
              >
                Are you training toward specific competitions or events?
              </Text>

              <View className="gap-3 mb-6">
                <Pressable
                  onPress={() => setCompetitionFocus(true)}
                  className={`p-4 rounded-xl border-2 ${
                    competitionFocus
                      ? 'border-signal-500 bg-signal-500/10'
                      : isDark
                      ? 'border-graphite-700 bg-graphite-800'
                      : 'border-graphite-200 bg-graphite-50'
                  }`}
                >
                  <View className="flex-row items-center">
                    <Ionicons name="trophy" size={24} color="#EF4444" />
                    <View className="ml-3 flex-1">
                      <Text
                        className={`font-medium ${
                          isDark ? 'text-graphite-100' : 'text-graphite-900'
                        }`}
                      >
                        Yes, I have competitions
                      </Text>
                      <Text
                        className={`text-sm ${
                          isDark ? 'text-graphite-400' : 'text-graphite-500'
                        }`}
                      >
                        Plan blocks to peak for specific dates
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setCompetitionFocus(false)}
                  className={`p-4 rounded-xl border-2 ${
                    !competitionFocus
                      ? 'border-signal-500 bg-signal-500/10'
                      : isDark
                      ? 'border-graphite-700 bg-graphite-800'
                      : 'border-graphite-200 bg-graphite-50'
                  }`}
                >
                  <View className="flex-row items-center">
                    <Ionicons name="trending-up" size={24} color="#22c55e" />
                    <View className="ml-3 flex-1">
                      <Text
                        className={`font-medium ${
                          isDark ? 'text-graphite-100' : 'text-graphite-900'
                        }`}
                      >
                        No, just continuous progress
                      </Text>
                      <Text
                        className={`text-sm ${
                          isDark ? 'text-graphite-400' : 'text-graphite-500'
                        }`}
                      >
                        Standard periodization cycles
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setStep('goal')}
                  className={`flex-1 py-4 rounded-xl items-center ${
                    isDark ? 'bg-graphite-800' : 'bg-graphite-100'
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      isDark ? 'text-graphite-300' : 'text-graphite-600'
                    }`}
                  >
                    Back
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCreate}
                  disabled={createPlan.isPending}
                  className="flex-1 py-4 rounded-xl bg-signal-500 items-center"
                >
                  {createPlan.isPending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white font-semibold">Create Plan</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Add Competition Modal
// ============================================================================

function AddCompetitionModal({
  visible,
  onClose,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<EventType>('powerlifting_meet');
  const [date, setDate] = useState('');

  const createCompetition = useCreateCompetition();

  const eventTypes: { value: EventType; label: string }[] = [
    { value: 'powerlifting_meet', label: 'Powerlifting Meet' },
    { value: 'weightlifting_meet', label: 'Weightlifting Meet' },
    { value: 'strongman', label: 'Strongman Competition' },
    { value: 'crossfit_comp', label: 'CrossFit Competition' },
    { value: 'sport_season', label: 'Sport Season Start' },
    { value: 'other', label: 'Other Event' },
  ];

  const handleCreate = async () => {
    if (!name || !date) return;

    await createCompetition.mutateAsync({
      name,
      event_type: eventType,
      event_date: date,
      priority: 'primary',
    });

    setName('');
    setDate('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable
          className={`rounded-t-3xl ${isDark ? 'bg-graphite-900' : 'bg-white'} p-6`}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="w-10 h-1 bg-graphite-400 rounded-full self-center mb-4" />

          <Text
            className={`text-xl font-bold mb-4 ${
              isDark ? 'text-graphite-100' : 'text-graphite-900'
            }`}
          >
            Add Competition
          </Text>

          {/* Name */}
          <Text
            className={`font-medium mb-2 ${
              isDark ? 'text-graphite-200' : 'text-graphite-800'
            }`}
          >
            Event Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Regional Championships"
            placeholderTextColor={isDark ? '#607296' : '#a3b1cc'}
            className={`p-4 rounded-xl mb-4 ${
              isDark ? 'bg-graphite-800 text-graphite-100' : 'bg-graphite-100 text-graphite-900'
            }`}
          />

          {/* Event Type */}
          <Text
            className={`font-medium mb-2 ${
              isDark ? 'text-graphite-200' : 'text-graphite-800'
            }`}
          >
            Event Type
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {eventTypes.map((type) => (
                <Pressable
                  key={type.value}
                  onPress={() => setEventType(type.value)}
                  className={`px-4 py-2 rounded-full ${
                    eventType === type.value
                      ? 'bg-signal-500'
                      : isDark
                      ? 'bg-graphite-800'
                      : 'bg-graphite-100'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      eventType === type.value
                        ? 'text-white font-medium'
                        : isDark
                        ? 'text-graphite-300'
                        : 'text-graphite-600'
                    }`}
                  >
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Date */}
          <Text
            className={`font-medium mb-2 ${
              isDark ? 'text-graphite-200' : 'text-graphite-800'
            }`}
          >
            Event Date
          </Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={isDark ? '#607296' : '#a3b1cc'}
            className={`p-4 rounded-xl mb-6 ${
              isDark ? 'bg-graphite-800 text-graphite-100' : 'bg-graphite-100 text-graphite-900'
            }`}
          />

          <Pressable
            onPress={handleCreate}
            disabled={!name || !date || createCompetition.isPending}
            className={`py-4 rounded-xl items-center ${
              name && date ? 'bg-signal-500' : isDark ? 'bg-graphite-700' : 'bg-graphite-300'
            }`}
          >
            {createCompetition.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-semibold">Add Competition</Text>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ============================================================================
// Block Recommendation Card
// ============================================================================

const RecommendationCard = React.memo(function RecommendationCard({
  recommendation,
  index,
  isDark,
  onSelect,
}: {
  recommendation: BlockRecommendation;
  index: number;
  isDark: boolean;
  onSelect: () => void;
}) {
  const color = getBlockTypeColor(recommendation.block_type);
  const confidence = Math.round(recommendation.confidence * 100);

  return (
    <Pressable
      onPress={onSelect}
      className={`p-4 rounded-xl mb-3 border ${
        isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
      }`}
    >
      <View className="flex-row items-start">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${color}20` }}
        >
          <Text className="font-bold" style={{ color }}>
            {index + 1}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text
              className={`font-semibold ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              {formatBlockType(recommendation.block_type)}
            </Text>
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${color}20` }}
            >
              <Text className="text-xs font-medium" style={{ color }}>
                {confidence}% match
              </Text>
            </View>
          </View>
          <Text
            className={`text-sm mt-1 ${
              isDark ? 'text-graphite-400' : 'text-graphite-500'
            }`}
          >
            {recommendation.duration_weeks} weeks · {recommendation.volume_level} volume
          </Text>
          <Text
            className={`text-sm mt-2 ${
              isDark ? 'text-graphite-300' : 'text-graphite-600'
            }`}
          >
            {recommendation.reasoning}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

// ============================================================================
// Main Screen
// ============================================================================

export default function AnnualPlanScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedBlock, setSelectedBlock] = useState<PlannedBlock | null>(null);

  const {
    activePlan,
    competitions,
    plannedBlocks,
    recommendations,
    timeline,
    nextCompetition,
    weeksToCompetition,
    isLoading,
  } = useAnnualPlanning();

  // Show setup modal if no plan exists
  const showSetup = !isLoading && !activePlan;

  const handleBlockPress = useCallback((block: PlannedBlock) => {
    setSelectedBlock(block);
    setModalType('block-detail');
  }, []);

  const handleStartBlock = useCallback((recommendation: BlockRecommendation) => {
    // Navigate to block builder with pre-filled config
    router.push({
      pathname: '/block-builder',
      params: {
        blockType: recommendation.block_type,
        duration: recommendation.duration_weeks.toString(),
      },
    });
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
        edges={['left', 'right']}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2F80ED" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
      edges={['left', 'right']}
    >
      {/* Header */}
      <View
        className={`flex-row items-center justify-between px-4 py-3 border-b ${
          isDark ? 'border-graphite-800' : 'border-graphite-200'
        }`}
      >
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDark ? '#d3d8e4' : '#374151'}
          />
        </Pressable>
        <Text
          className={`text-lg font-bold ${
            isDark ? 'text-graphite-100' : 'text-graphite-900'
          }`}
        >
          {new Date().getFullYear()} Plan
        </Text>
        <Pressable
          onPress={() => setModalType('competition')}
          className="p-2"
        >
          <Ionicons name="add-circle" size={28} color="#2F80ED" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Next Competition Banner */}
        {nextCompetition && weeksToCompetition !== null && (
          <View
            className={`mx-4 mt-4 p-4 rounded-xl ${
              weeksToCompetition <= 4
                ? 'bg-oxide-500/10 border border-oxide-500/30'
                : isDark
                ? 'bg-graphite-800'
                : 'bg-white border border-graphite-200'
            }`}
          >
            <View className="flex-row items-center">
              <View
                className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${
                  weeksToCompetition <= 4 ? 'bg-oxide-500' : 'bg-signal-500'
                }`}
              >
                <Ionicons name="trophy" size={24} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text
                  className={`font-bold ${
                    isDark ? 'text-graphite-100' : 'text-graphite-900'
                  }`}
                >
                  {nextCompetition.name}
                </Text>
                <Text
                  className={`text-sm ${
                    weeksToCompetition <= 4
                      ? 'text-oxide-500 font-medium'
                      : isDark
                      ? 'text-graphite-400'
                      : 'text-graphite-500'
                  }`}
                >
                  {weeksToCompetition} weeks away ·{' '}
                  {new Date(nextCompetition.event_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Annual Calendar */}
        {timeline && (
          <View className="mt-4">
            <Text
              className={`px-4 text-lg font-bold mb-2 ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              Training Timeline
            </Text>
            <AnnualCalendar
              timeline={timeline}
              onBlockPress={handleBlockPress}
              onCompetitionPress={(comp) => console.log('Competition:', comp)}
              selectedBlockId={selectedBlock?.id}
            />
          </View>
        )}

        {/* Block Recommendations */}
        <View className="px-4 mt-6">
          <Text
            className={`text-lg font-bold mb-3 ${
              isDark ? 'text-graphite-100' : 'text-graphite-900'
            }`}
          >
            Recommended Next Block
          </Text>
          {recommendations.length > 0 ? (
            recommendations.map((rec, index) => (
              <RecommendationCard
                key={`${rec.block_type}-${index}`}
                recommendation={rec}
                index={index}
                isDark={isDark}
                onSelect={() => handleStartBlock(rec)}
              />
            ))
          ) : (
            <View
              className={`p-6 rounded-xl items-center ${
                isDark ? 'bg-graphite-800' : 'bg-white border border-graphite-200'
              }`}
            >
              <Ionicons
                name="bulb-outline"
                size={40}
                color={isDark ? '#607296' : '#808fb0'}
              />
              <Text
                className={`mt-3 text-center ${
                  isDark ? 'text-graphite-300' : 'text-graphite-600'
                }`}
              >
                Complete some workouts to get personalized recommendations
              </Text>
            </View>
          )}
        </View>

        {/* Upcoming Competitions */}
        <View className="px-4 mt-6 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className={`text-lg font-bold ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              Competitions
            </Text>
            <Pressable
              onPress={() => setModalType('competition')}
              className="flex-row items-center"
            >
              <Ionicons name="add" size={20} color="#2F80ED" />
              <Text className="text-signal-500 font-medium ml-1">Add</Text>
            </Pressable>
          </View>

          {competitions.length > 0 ? (
            competitions.map((comp) => (
              <View
                key={comp.id}
                className={`p-4 rounded-xl mb-2 flex-row items-center ${
                  isDark ? 'bg-graphite-800' : 'bg-white border border-graphite-200'
                }`}
              >
                <View className="w-10 h-10 rounded-full bg-oxide-500/20 items-center justify-center mr-3">
                  <Ionicons name="trophy" size={20} color="#EF4444" />
                </View>
                <View className="flex-1">
                  <Text
                    className={`font-medium ${
                      isDark ? 'text-graphite-100' : 'text-graphite-900'
                    }`}
                  >
                    {comp.name}
                  </Text>
                  <Text
                    className={`text-sm ${
                      isDark ? 'text-graphite-400' : 'text-graphite-500'
                    }`}
                  >
                    {new Date(comp.event_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View
                  className={`px-2 py-1 rounded ${
                    comp.priority === 'primary'
                      ? 'bg-oxide-500/20'
                      : isDark
                      ? 'bg-graphite-700'
                      : 'bg-graphite-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      comp.priority === 'primary'
                        ? 'text-oxide-500'
                        : isDark
                        ? 'text-graphite-400'
                        : 'text-graphite-600'
                    }`}
                  >
                    {comp.priority}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View
              className={`p-6 rounded-xl items-center ${
                isDark ? 'bg-graphite-800' : 'bg-white border border-graphite-200'
              }`}
            >
              <Ionicons
                name="calendar-outline"
                size={40}
                color={isDark ? '#607296' : '#808fb0'}
              />
              <Text
                className={`mt-3 text-center ${
                  isDark ? 'text-graphite-300' : 'text-graphite-600'
                }`}
              >
                No competitions scheduled
              </Text>
              <Pressable
                onPress={() => setModalType('competition')}
                className="mt-3 px-4 py-2 rounded-lg bg-signal-500"
              >
                <Text className="text-white font-medium">Add Competition</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <SetupModal
        visible={showSetup}
        onClose={() => router.back()}
        isDark={isDark}
      />

      <AddCompetitionModal
        visible={modalType === 'competition'}
        onClose={() => setModalType(null)}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}
