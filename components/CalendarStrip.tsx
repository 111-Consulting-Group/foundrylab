import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Colors } from '@/constants/Colors';
import type { WorkoutWithSets } from '@/types/database';

interface CalendarStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  workouts: WorkoutWithSets[];
  rescheduleMode?: string | null; // workoutId when in reschedule mode
}

type DayStatus = 'completed' | 'planned' | 'missed' | 'none';

export function CalendarStrip({ selectedDate, onSelectDate, workouts, rescheduleMode }: CalendarStripProps) {
  // Generate array of 7 days (Sun-Sat)
  const weekDays = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const days: Array<{ date: Date; dayName: string; dayNumber: number; status: DayStatus }> = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      const dateStr = date.toISOString().split('T')[0];
      const dayWorkouts = workouts.filter((w) => {
        if (w.date_completed) {
          const completedDate = new Date(w.date_completed).toISOString().split('T')[0];
          return completedDate === dateStr;
        }
        if (w.scheduled_date) {
          const scheduledDate = new Date(w.scheduled_date).toISOString().split('T')[0];
          return scheduledDate === dateStr;
        }
        return false;
      });

      let status: DayStatus = 'none';
      if (dayWorkouts.length > 0) {
        const hasCompleted = dayWorkouts.some((w) => w.date_completed);
        if (hasCompleted) {
          status = 'completed';
        } else {
          // Planned workout that hasn't been completed
          const isPast = date < today && date.toDateString() !== today.toDateString();
          status = isPast ? 'missed' : 'planned';
        }
      } else {
        // No workout scheduled, but check if it's in the past
        const isPast = date < today && date.toDateString() !== today.toDateString();
        if (isPast) {
          status = 'missed';
        }
      }

      days.push({
        date,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
        dayNumber: date.getDate(),
        status,
      });
    }

    return days;
  }, [workouts]);

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 4 }}
      className="mb-4"
    >
      <View className="flex-row gap-2">
        {weekDays.map((day, index) => {
          const selected = isSelected(day.date);
          const today = isToday(day.date);

          return (
            <Pressable
              key={index}
              onPress={() => onSelectDate(day.date)}
              className={`items-center min-w-[48px] py-2 px-2 rounded-xl ${
                rescheduleMode
                  ? selected
                    ? 'bg-signal-500'
                    : isDark
                    ? 'bg-graphite-800 border-2 border-signal-500/50'
                    : 'bg-white border-2 border-signal-500/50'
                  : selected
                  ? isDark
                    ? 'bg-signal-500'
                    : 'bg-signal-500'
                  : isDark
                  ? 'bg-graphite-800'
                  : 'bg-white'
              } border ${
                rescheduleMode
                  ? selected
                    ? 'border-signal-500'
                    : 'border-signal-500/50'
                  : selected
                  ? 'border-signal-500'
                  : today
                  ? isDark
                    ? 'border-signal-500/50'
                    : 'border-signal-500/30'
                  : isDark
                  ? 'border-graphite-700'
                  : 'border-graphite-200'
              }`}
            >
              <Text
                className={`text-xs mb-1 ${
                  selected
                    ? 'text-white'
                    : isDark
                    ? 'text-graphite-400'
                    : 'text-graphite-500'
                }`}
              >
                {day.dayName}
              </Text>
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  selected
                    ? 'bg-white/20'
                    : day.status === 'completed'
                    ? 'bg-progress-500'
                    : day.status === 'planned'
                    ? 'bg-signal-500/30'
                    : day.status === 'missed'
                    ? isDark
                      ? 'bg-graphite-700'
                      : 'bg-graphite-200'
                    : isDark
                    ? 'bg-graphite-700'
                    : 'bg-graphite-100'
                }`}
              >
                {day.status === 'completed' ? (
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                ) : day.status === 'planned' ? (
                  <View className="w-2 h-2 rounded-full bg-signal-500" />
                ) : (
                  <Text
                    className={`text-sm font-semibold ${
                      selected
                        ? 'text-white'
                        : today
                        ? 'text-signal-500'
                        : day.status === 'missed'
                        ? isDark
                          ? 'text-graphite-500'
                          : 'text-graphite-400'
                        : isDark
                        ? 'text-graphite-300'
                        : 'text-graphite-600'
                    }`}
                  >
                    {day.dayNumber}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
