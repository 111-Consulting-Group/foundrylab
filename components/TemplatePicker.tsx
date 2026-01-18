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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useWorkoutTemplates, useDeleteWorkoutTemplate } from '@/hooks/useWorkoutTemplates';
import type { WorkoutTemplate } from '@/types/database';

interface TemplatePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkoutTemplate) => void;
}

/**
 * Modal to browse and select workout templates
 * Uses glass-morphic styling consistent with the rest of the app
 */
export function TemplatePicker({
  visible,
  onClose,
  onSelectTemplate,
}: TemplatePickerProps) {
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
      <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        {/* Ambient Background Glow */}
        <View
          style={{
            position: 'absolute',
            top: -50,
            right: -80,
            width: 200,
            height: 200,
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            borderRadius: 100,
          }}
        />

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: Colors.glass.white[10],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: Colors.graphite[50],
                }}
              >
                My Templates
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? Colors.glass.white[20] : Colors.glass.white[10],
                })}
              >
                <Ionicons name="close" size={24} color={Colors.graphite[50]} />
              </Pressable>
            </View>

            {/* Search */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: Colors.glass.white[5],
                borderWidth: 1,
                borderColor: Colors.glass.white[10],
              }}
            >
              <Ionicons name="search" size={20} color={Colors.graphite[400]} />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontSize: 16,
                  color: Colors.graphite[50],
                }}
                placeholder="Search templates..."
                placeholderTextColor={Colors.graphite[500]}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {isLoading ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <ActivityIndicator size="large" color={Colors.signal[500]} />
              </View>
            ) : filteredTemplates.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <Ionicons name="bookmark-outline" size={48} color={Colors.graphite[500]} />
                <Text
                  style={{
                    marginTop: 16,
                    textAlign: 'center',
                    color: Colors.graphite[400],
                  }}
                >
                  {templates.length === 0
                    ? 'No saved templates yet\nComplete a workout and save it as a template'
                    : 'No templates match your search'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {filteredTemplates.map((template) => (
                  <Pressable
                    key={template.id}
                    onPress={() => {
                      onSelectTemplate(template);
                      onClose();
                    }}
                    style={({ pressed }) => ({
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: pressed ? Colors.glass.white[10] : Colors.glass.white[5],
                      borderWidth: 1,
                      borderColor: Colors.glass.white[10],
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontWeight: '600',
                            fontSize: 16,
                            color: Colors.graphite[50],
                          }}
                        >
                          {template.name}
                        </Text>
                        {template.focus && (
                          <Text
                            style={{
                              fontSize: 14,
                              color: Colors.graphite[400],
                            }}
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
                        style={{ padding: 4 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.graphite[500]} />
                      </Pressable>
                    </View>

                    {/* Exercise summary */}
                    <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {template.exercises.slice(0, 4).map((ex, i) => (
                        <View
                          key={i}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: Colors.glass.white[10],
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: Colors.graphite[300],
                            }}
                          >
                            {ex.exercise_name || 'Exercise'}: {ex.sets}×{ex.target_reps || '?'}
                          </Text>
                        </View>
                      ))}
                      {template.exercises.length > 4 && (
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor: Colors.glass.white[10],
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              color: Colors.graphite[400],
                            }}
                          >
                            +{template.exercises.length - 4} more
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Meta info */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="barbell-outline" size={14} color={Colors.graphite[500]} />
                        <Text
                          style={{
                            marginLeft: 4,
                            fontSize: 12,
                            color: Colors.graphite[400],
                          }}
                        >
                          {template.exercises.length} exercises
                        </Text>
                      </View>
                      {template.estimated_duration && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="time-outline" size={14} color={Colors.graphite[500]} />
                          <Text
                            style={{
                              marginLeft: 4,
                              fontSize: 12,
                              color: Colors.graphite[400],
                            }}
                          >
                            ~{template.estimated_duration} min
                          </Text>
                        </View>
                      )}
                      {template.use_count > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="repeat-outline" size={14} color={Colors.graphite[500]} />
                          <Text
                            style={{
                              marginLeft: 4,
                              fontSize: 12,
                              color: Colors.graphite[400],
                            }}
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
        </SafeAreaView>
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
      <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        {/* Ambient Background Glow */}
        <View
          style={{
            position: 'absolute',
            top: -50,
            left: -50,
            width: 180,
            height: 180,
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            borderRadius: 90,
          }}
        />

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: Colors.glass.white[10],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: Colors.graphite[50],
                }}
              >
                Save as Template
              </Text>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? Colors.glass.white[20] : Colors.glass.white[10],
                })}
              >
                <Ionicons name="close" size={24} color={Colors.graphite[50]} />
              </Pressable>
            </View>
          </View>

          {/* Form */}
          <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 16 }}>
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 8,
                  color: Colors.graphite[300],
                }}
              >
                Template Name *
              </Text>
              <TextInput
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: Colors.glass.white[5],
                  borderWidth: 1,
                  borderColor: Colors.glass.white[10],
                  fontSize: 16,
                  color: Colors.graphite[50],
                }}
                placeholder={defaultFocus ? `${defaultFocus} Template` : 'e.g., My Push Day'}
                placeholderTextColor={Colors.graphite[500]}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 8,
                  color: Colors.graphite[300],
                }}
              >
                Description (optional)
              </Text>
              <TextInput
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: Colors.glass.white[5],
                  borderWidth: 1,
                  borderColor: Colors.glass.white[10],
                  fontSize: 16,
                  color: Colors.graphite[50],
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
                placeholder="Add a note about this template"
                placeholderTextColor={Colors.graphite[500]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => ({
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                marginTop: 16,
                backgroundColor: isSaving ? Colors.glass.blue[20] : Colors.signal[600],
                borderWidth: 1,
                borderColor: isSaving ? Colors.signal[500] : Colors.signal[500],
                opacity: pressed ? 0.8 : 1,
                shadowColor: Colors.signal[500],
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isSaving ? 0 : 0.3,
                shadowRadius: 16,
              })}
            >
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Save Template</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
