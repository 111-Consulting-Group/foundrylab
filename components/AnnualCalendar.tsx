/**
 * AnnualCalendar Component
 *
 * Visual timeline showing training blocks and competitions across the year.
 * Supports scrolling, block selection, and competition markers.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { getBlockTypeColor, formatBlockType, BLOCK_CHARACTERISTICS } from '@/lib/periodization';
import type {
  BlockType,
  Competition,
  PlannedBlock,
  PeriodizationTimeline,
} from '@/types/database';

// ============================================================================
// Types
// ============================================================================

interface AnnualCalendarProps {
  timeline: PeriodizationTimeline;
  onBlockPress?: (block: PlannedBlock) => void;
  onCompetitionPress?: (competition: Competition) => void;
  onWeekPress?: (weekNumber: number, date: Date) => void;
  selectedBlockId?: string;
}

interface MonthData {
  month: number;
  name: string;
  weeks: WeekData[];
}

interface WeekData {
  weekNumber: number;
  startDate: Date;
  block?: PlannedBlock;
  isCurrentWeek: boolean;
  competitionsThisWeek: Competition[];
}

// ============================================================================
// Constants
// ============================================================================

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEK_WIDTH = 24;
const BLOCK_HEIGHT = 48;

// ============================================================================
// Week Cell Component
// ============================================================================

const WeekCell = React.memo(function WeekCell({
  week,
  isDark,
  onPress,
  isSelected,
}: {
  week: WeekData;
  isDark: boolean;
  onPress?: () => void;
  isSelected?: boolean;
}) {
  const hasCompetition = week.competitionsThisWeek.length > 0;
  const blockColor = week.block ? getBlockTypeColor(week.block.block_type) : null;

  return (
    <Pressable
      onPress={onPress}
      style={{ width: WEEK_WIDTH }}
      className={`h-12 items-center justify-center border-r ${
        isDark ? 'border-graphite-800' : 'border-graphite-200'
      } ${isSelected ? 'bg-signal-500/20' : ''}`}
    >
      {/* Block indicator */}
      {blockColor && (
        <View
          className="absolute inset-0"
          style={{ backgroundColor: blockColor, opacity: 0.3 }}
        />
      )}

      {/* Current week indicator */}
      {week.isCurrentWeek && (
        <View className="absolute inset-x-0 top-0 h-1 bg-signal-500" />
      )}

      {/* Week number */}
      <Text
        className={`text-xs font-medium ${
          week.isCurrentWeek
            ? 'text-signal-500'
            : isDark
            ? 'text-graphite-400'
            : 'text-graphite-600'
        }`}
      >
        {week.weekNumber}
      </Text>

      {/* Competition marker */}
      {hasCompetition && (
        <View className="absolute bottom-1">
          <View className="w-2 h-2 rounded-full bg-oxide-500" />
        </View>
      )}
    </Pressable>
  );
});

// ============================================================================
// Block Bar Component
// ============================================================================

const BlockBar = React.memo(function BlockBar({
  block,
  startWeek,
  totalWeeks,
  isDark,
  onPress,
  isSelected,
}: {
  block: PlannedBlock;
  startWeek: number;
  totalWeeks: number;
  isDark: boolean;
  onPress?: () => void;
  isSelected?: boolean;
}) {
  const color = getBlockTypeColor(block.block_type);
  const blockInfo = BLOCK_CHARACTERISTICS[block.block_type];

  // Calculate position
  const startOffset = startWeek * WEEK_WIDTH;
  const width = block.duration_weeks * WEEK_WIDTH;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        left: startOffset,
        width: width - 2,
        height: BLOCK_HEIGHT - 8,
        top: 4,
      }}
      className={`rounded-lg px-2 py-1 ${isSelected ? 'ring-2 ring-signal-500' : ''}`}
      accessibleRole="button"
    >
      <View
        className="absolute inset-0 rounded-lg"
        style={{ backgroundColor: color, opacity: 0.85 }}
      />
      <Text className="text-white text-xs font-semibold" numberOfLines={1}>
        {block.name || formatBlockType(block.block_type)}
      </Text>
      <Text className="text-white/80 text-[10px]" numberOfLines={1}>
        {block.duration_weeks}w · {blockInfo.repRanges} reps
      </Text>
    </Pressable>
  );
});

// ============================================================================
// Competition Marker Component
// ============================================================================

const CompetitionMarker = React.memo(function CompetitionMarker({
  competition,
  weekNumber,
  isDark,
  onPress,
}: {
  competition: Competition;
  weekNumber: number;
  isDark: boolean;
  onPress?: () => void;
}) {
  const offset = weekNumber * WEEK_WIDTH + WEEK_WIDTH / 2;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        left: offset - 12,
        top: -8,
      }}
      className="items-center"
    >
      <View className="w-6 h-6 rounded-full bg-oxide-500 items-center justify-center shadow-md">
        <Ionicons name="trophy" size={12} color="#ffffff" />
      </View>
      <View
        className={`mt-1 px-2 py-0.5 rounded ${
          isDark ? 'bg-graphite-800' : 'bg-white'
        } shadow-sm`}
      >
        <Text
          className={`text-[10px] font-medium ${
            isDark ? 'text-graphite-200' : 'text-graphite-800'
          }`}
          numberOfLines={1}
        >
          {competition.name}
        </Text>
      </View>
    </Pressable>
  );
});

// ============================================================================
// Legend Component
// ============================================================================

const Legend = React.memo(function Legend({ isDark }: { isDark: boolean }) {
  const blockTypes: BlockType[] = [
    'accumulation',
    'intensification',
    'realization',
    'peaking',
    'deload',
    'hypertrophy',
  ];

  return (
    <View className="flex-row flex-wrap gap-3 px-4 py-2">
      {blockTypes.map((type) => (
        <View key={type} className="flex-row items-center">
          <View
            className="w-3 h-3 rounded"
            style={{ backgroundColor: getBlockTypeColor(type) }}
          />
          <Text
            className={`text-xs ml-1 ${
              isDark ? 'text-graphite-400' : 'text-graphite-600'
            }`}
          >
            {formatBlockType(type)}
          </Text>
        </View>
      ))}
      <View className="flex-row items-center">
        <View className="w-3 h-3 rounded-full bg-oxide-500" />
        <Text
          className={`text-xs ml-1 ${
            isDark ? 'text-graphite-400' : 'text-graphite-600'
          }`}
        >
          Competition
        </Text>
      </View>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const AnnualCalendar = React.memo(function AnnualCalendar({
  timeline,
  onBlockPress,
  onCompetitionPress,
  onWeekPress,
  selectedBlockId,
}: AnnualCalendarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollRef = useRef<ScrollView>(null);

  // Build month and week data
  const monthsData = useMemo((): MonthData[] => {
    const startDate = new Date(timeline.startDate);
    const months: MonthData[] = [];
    let weekNumber = 1;

    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(startDate.getFullYear(), m, 1);
      const monthWeeks: WeekData[] = [];

      // Get weeks in this month
      const currentDate = new Date(monthStart);
      while (currentDate.getMonth() === m && weekNumber <= 52) {
        // Find block for this week
        const weekStart = new Date(currentDate);
        const block = timeline.blocks.find((b) => {
          const blockStart = new Date(b.planned_start_date);
          const blockEnd = new Date(blockStart);
          blockEnd.setDate(blockEnd.getDate() + b.duration_weeks * 7);
          return weekStart >= blockStart && weekStart < blockEnd;
        });

        // Find competitions this week
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const competitionsThisWeek = timeline.competitions.filter((c) => {
          const compDate = new Date(c.event_date);
          return compDate >= weekStart && compDate < weekEnd;
        });

        // Is this the current week?
        const now = new Date();
        const isCurrentWeek = now >= weekStart && now < weekEnd;

        monthWeeks.push({
          weekNumber,
          startDate: new Date(weekStart),
          block,
          isCurrentWeek,
          competitionsThisWeek,
        });

        currentDate.setDate(currentDate.getDate() + 7);
        weekNumber++;
      }

      months.push({
        month: m,
        name: MONTH_NAMES[m],
        weeks: monthWeeks,
      });
    }

    return months;
  }, [timeline]);

  // Calculate block positions
  const blockPositions = useMemo(() => {
    return timeline.blocks.map((block) => {
      const blockStart = new Date(block.planned_start_date);
      const startWeek = Math.floor(
        (blockStart.getTime() - new Date(timeline.startDate).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      return { block, startWeek };
    });
  }, [timeline]);

  // Calculate competition positions
  const competitionPositions = useMemo(() => {
    return timeline.competitions.map((comp) => {
      const compDate = new Date(comp.event_date);
      const weekNumber = Math.floor(
        (compDate.getTime() - new Date(timeline.startDate).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      return { competition: comp, weekNumber };
    });
  }, [timeline]);

  // Scroll to current week on mount
  const scrollToCurrentWeek = useCallback(() => {
    const currentWeekOffset = timeline.currentWeek * WEEK_WIDTH - 100;
    scrollRef.current?.scrollTo({ x: currentWeekOffset, animated: true });
  }, [timeline.currentWeek]);

  return (
    <View className="flex-1">
      {/* Legend */}
      <Legend isDark={isDark} />

      {/* Calendar */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={scrollToCurrentWeek}
        contentContainerStyle={{ paddingRight: 20 }}
      >
        <View>
          {/* Month headers */}
          <View className="flex-row h-6">
            {monthsData.map((month) => (
              <View
                key={month.month}
                style={{ width: month.weeks.length * WEEK_WIDTH }}
                className={`border-r ${
                  isDark ? 'border-graphite-700' : 'border-graphite-300'
                }`}
              >
                <Text
                  className={`text-xs font-semibold px-1 ${
                    isDark ? 'text-graphite-300' : 'text-graphite-700'
                  }`}
                >
                  {month.name}
                </Text>
              </View>
            ))}
          </View>

          {/* Week cells */}
          <View
            className={`flex-row border-t border-b ${
              isDark ? 'border-graphite-700' : 'border-graphite-300'
            }`}
          >
            {monthsData.flatMap((month) =>
              month.weeks.map((week) => (
                <WeekCell
                  key={week.weekNumber}
                  week={week}
                  isDark={isDark}
                  onPress={() => onWeekPress?.(week.weekNumber, week.startDate)}
                  isSelected={week.block?.id === selectedBlockId}
                />
              ))
            )}
          </View>

          {/* Block bars */}
          <View style={{ height: BLOCK_HEIGHT, position: 'relative' }}>
            {blockPositions.map(({ block, startWeek }) => (
              <BlockBar
                key={block.id || `block-${startWeek}`}
                block={block}
                startWeek={startWeek}
                totalWeeks={timeline.totalWeeks}
                isDark={isDark}
                onPress={() => onBlockPress?.(block)}
                isSelected={block.id === selectedBlockId}
              />
            ))}
          </View>

          {/* Competition markers */}
          <View style={{ height: 40, position: 'relative' }}>
            {competitionPositions.map(({ competition, weekNumber }) => (
              <CompetitionMarker
                key={competition.id}
                competition={competition}
                weekNumber={weekNumber}
                isDark={isDark}
                onPress={() => onCompetitionPress?.(competition)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Current week indicator */}
      <View
        className={`flex-row items-center justify-center py-2 border-t ${
          isDark ? 'border-graphite-800' : 'border-graphite-200'
        }`}
      >
        <View className="w-2 h-2 rounded-full bg-signal-500 mr-2" />
        <Text
          className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}
        >
          Week {timeline.currentWeek} of {timeline.totalWeeks}
        </Text>
        <Pressable
          onPress={scrollToCurrentWeek}
          className="ml-4 px-3 py-1 rounded-full bg-signal-500/20"
        >
          <Text className="text-signal-500 text-xs font-medium">Go to Today</Text>
        </Pressable>
      </View>
    </View>
  );
});

// ============================================================================
// Compact Timeline (for embedding in other views)
// ============================================================================

export const CompactTimeline = React.memo(function CompactTimeline({
  blocks,
  competitions,
  currentWeek,
  onPress,
}: {
  blocks: PlannedBlock[];
  competitions: Competition[];
  currentWeek: number;
  onPress?: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Get next 12 weeks of blocks
  const upcomingBlocks = useMemo(() => {
    const now = new Date();
    return blocks
      .filter((b) => {
        const blockEnd = new Date(b.planned_start_date);
        blockEnd.setDate(blockEnd.getDate() + b.duration_weeks * 7);
        return blockEnd >= now;
      })
      .slice(0, 3);
  }, [blocks]);

  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl p-4 ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${
        isDark ? 'border-graphite-700' : 'border-graphite-200'
      }`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text
          className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
        >
          Training Timeline
        </Text>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={isDark ? '#808fb0' : '#607296'}
        />
      </View>

      {/* Mini block preview */}
      <View className="flex-row h-6 rounded-lg overflow-hidden">
        {upcomingBlocks.map((block, index) => {
          const widthPercent = (block.duration_weeks / 12) * 100;
          return (
            <View
              key={block.id || index}
              style={{
                width: `${Math.min(widthPercent, 100 - index * 20)}%`,
                backgroundColor: getBlockTypeColor(block.block_type),
              }}
              className="items-center justify-center"
            >
              <Text className="text-white text-[10px] font-medium" numberOfLines={1}>
                {block.duration_weeks}w
              </Text>
            </View>
          );
        })}
      </View>

      {/* Next competition */}
      {competitions.length > 0 && (
        <View className="flex-row items-center mt-3">
          <Ionicons name="trophy" size={14} color="#EF4444" />
          <Text
            className={`text-xs ml-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
          >
            {competitions[0].name} -{' '}
            {new Date(competitions[0].event_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      )}
    </Pressable>
  );
});
