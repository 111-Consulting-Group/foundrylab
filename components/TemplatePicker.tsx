import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useWorkoutTemplates, useDeleteWorkoutTemplate } from '@/hooks/useWorkoutTemplates';
import type { WorkoutTemplate } from '@/types/database';

interface TemplatePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkoutTemplate) => void;
}

/**
 * Modal to browse and select workout templates
 */
export function TemplatePicker({
  visible,
  onClose,
  onSelectTemplate,
}: TemplatePickerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: templates, isLoading } = useWorkoutTemplates();
  const deleteTemplateMutation = useDeleteWorkoutTemplate();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.focus && t.focus.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDelete = (template: WorkoutTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTemplateMutation.mutate(template.id),
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}>
        {/* Header */}
        <View
          className={`px-4 py-4 border-b ${
            isDark ? 'border-graphite-700' : 'border-graphite-200'
          }`}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className={`text-lg font-bold ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              My Templates
            </Text>
            <Pressable
              onPress={onClose}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isDark ? 'bg-graphite-800' : 'bg-graphite-100'
              }`}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? '#E6E8EB' : '#0E1116'}
              />
            </Pressable>
          </View>

          {/* Search */}
          <View
            className={`flex-row items-center px-4 py-3 rounded-xl ${
              isDark ? 'bg-graphite-800' : 'bg-white'
            } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
          >
            <Ionicons
              name="search"
              size={20}
              color={isDark ? '#808fb0' : '#607296'}
            />
            <TextInput
              className={`flex-1 ml-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
              placeholder="Search templates..."
              placeholderTextColor={isDark ? '#808fb0' : '#607296'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 px-4 pt-4">
          {isLoading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#2F80ED" />
            </View>
          ) : filteredTemplates.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Ionicons
                name="bookmark-outline"
                size={48}
                color={isDark ? '#808fb0' : '#607296'}
              />
              <Text
                className={`mt-4 text-center ${
                  isDark ? 'text-graphite-400' : 'text-graphite-500'
                }`}
              >
                {templates.length === 0
                  ? 'No saved templates yet\nComplete a workout and save it as a template'
                  : 'No templates match your search'}
              </Text>
            </View>
          ) : (
            <View className="gap-3 pb-8">
              {filteredTemplates.map((template) => (
                <Pressable
                  key={template.id}
                  className={`p-4 rounded-xl ${
                    isDark ? 'bg-graphite-800' : 'bg-white'
                  } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                  onPress={() => {
                    onSelectTemplate(template);
                    onClose();
                  }}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <Text
                        className={`font-semibold text-base ${
                          isDark ? 'text-graphite-100' : 'text-graphite-900'
                        }`}
                      >
                        {template.name}
                      </Text>
                      {template.focus && (
                        <Text
                          className={`text-sm ${
                            isDark ? 'text-graphite-400' : 'text-graphite-500'
                          }`}
                        >
                          {template.focus}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(template);
                      }}
                      className="p-1"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={isDark ? '#808fb0' : '#607296'}
                      />
                    </Pressable>
                  </View>

                  {/* Exercise summary */}
                  <View className="mt-3 flex-row flex-wrap gap-1">
                    {template.exercises.slice(0, 4).map((ex, i) => (
                      <View
                        key={i}
                        className={`px-2 py-1 rounded ${
                          isDark ? 'bg-graphite-700' : 'bg-graphite-100'
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            isDark ? 'text-graphite-300' : 'text-graphite-600'
                          }`}
                        >
                          {ex.exercise_name || 'Exercise'}: {ex.sets}×{ex.target_reps || '?'}
                        </Text>
                      </View>
                    ))}
                    {template.exercises.length > 4 && (
                      <View
                        className={`px-2 py-1 rounded ${
                          isDark ? 'bg-graphite-700' : 'bg-graphite-100'
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            isDark ? 'text-graphite-400' : 'text-graphite-500'
                          }`}
                        >
                          +{template.exercises.length - 4} more
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Meta info */}
                  <View className="flex-row items-center mt-3 gap-4">
                    <View className="flex-row items-center">
                      <Ionicons
                        name="barbell-outline"
                        size={14}
                        color={isDark ? '#808fb0' : '#607296'}
                      />
                      <Text
                        className={`ml-1 text-xs ${
                          isDark ? 'text-graphite-400' : 'text-graphite-500'
                        }`}
                      >
                        {template.exercises.length} exercises
                      </Text>
                    </View>
                    {template.estimated_duration && (
                      <View className="flex-row items-center">
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={isDark ? '#808fb0' : '#607296'}
                        />
                        <Text
                          className={`ml-1 text-xs ${
                            isDark ? 'text-graphite-400' : 'text-graphite-500'
                          }`}
                        >
                          ~{template.estimated_duration} min
                        </Text>
                      </View>
                    )}
                    {template.use_count > 0 && (
                      <View className="flex-row items-center">
                        <Ionicons
                          name="repeat-outline"
                          size={14}
                          color={isDark ? '#808fb0' : '#607296'}
                        />
                        <Text
                          className={`ml-1 text-xs ${
                            isDark ? 'text-graphite-400' : 'text-graphite-500'
                          }`}
                        >
                          Used {template.use_count}x
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Save as Template Modal
 */
interface SaveTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => void;
  defaultName?: string;
  defaultFocus?: string;
  isSaving?: boolean;
}

export function SaveTemplateModal({
  visible,
  onClose,
  onSave,
  defaultName = '',
  defaultFocus = '',
  isSaving = false,
}: SaveTemplateModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your template');
      return;
    }
    onSave(name.trim(), description.trim() || undefined);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}>
        {/* Header */}
        <View
          className={`px-4 py-4 border-b ${
            isDark ? 'border-graphite-700' : 'border-graphite-200'
          }`}
        >
          <View className="flex-row items-center justify-between">
            <Text
              className={`text-lg font-bold ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              Save as Template
            </Text>
            <Pressable
              onPress={onClose}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isDark ? 'bg-graphite-800' : 'bg-graphite-100'
              }`}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? '#E6E8EB' : '#0E1116'}
              />
            </Pressable>
          </View>
        </View>

        {/* Form */}
        <View className="px-4 pt-6 gap-4">
          <View>
            <Text
              className={`text-sm font-semibold mb-2 ${
                isDark ? 'text-graphite-300' : 'text-graphite-600'
              }`}
            >
              Template Name *
            </Text>
            <TextInput
              className={`px-4 py-3 rounded-xl ${
                isDark ? 'bg-graphite-800 text-graphite-100' : 'bg-white text-graphite-900'
              } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              placeholder={defaultFocus ? `${defaultFocus} Template` : 'e.g., My Push Day'}
              placeholderTextColor={isDark ? '#808fb0' : '#607296'}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View>
            <Text
              className={`text-sm font-semibold mb-2 ${
                isDark ? 'text-graphite-300' : 'text-graphite-600'
              }`}
            >
              Description (optional)
            </Text>
            <TextInput
              className={`px-4 py-3 rounded-xl ${
                isDark ? 'bg-graphite-800 text-graphite-100' : 'bg-white text-graphite-900'
              } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              placeholder="Add a note about this template"
              placeholderTextColor={isDark ? '#808fb0' : '#607296'}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </View>

          <Pressable
            className={`py-4 rounded-xl items-center mt-4 ${
              isSaving ? 'bg-signal-500/50' : 'bg-signal-500'
            }`}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-semibold">Save Template</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
