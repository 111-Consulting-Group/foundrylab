/**
 * CoachCopilot
 * Modern copilot-style AI coach interface
 * Sleek, minimal, and smart
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useCoach, useApplyCoachAction } from '@/hooks/useCoach';
import type { ChatMessage, ConversationContextType, SuggestedAction } from '@/types/database';
import type { CoachMode } from '@/types/coach';

import { ModeIndicator } from './ModeIndicator';
import { CoachActionCard } from './CoachActionCard';

// ============================================================================
// Types
// ============================================================================

interface CoachCopilotProps {
  contextType?: ConversationContextType;
  workoutId?: string;
  blockId?: string;
  onClose?: () => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  initialMessage?: string; // Auto-send this message when component mounts
}

// ============================================================================
// Thinking Animation
// ============================================================================

const ThinkingDots = React.memo(function ThinkingDots() {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
      <Text style={{ fontSize: 16, color: Colors.signal[400], fontWeight: '600' }}>
        Thinking{dots}
      </Text>
    </View>
  );
});

// ============================================================================
// Smart Suggestion Chip
// ============================================================================

const SuggestionChip = React.memo(function SuggestionChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: pressed ? Colors.glass.white[10] : Colors.glass.white[5],
        borderWidth: 1,
        borderColor: Colors.glass.white[10],
        marginRight: 8,
        marginBottom: 8,
      })}
    >
      <Text
        style={{
          fontSize: 13,
          color: Colors.graphite[200],
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

// ============================================================================
// Message Bubble
// ============================================================================

const MessageBubble = React.memo(function MessageBubble({
  message,
  onApplyAction,
  isApplying,
}: {
  message: ChatMessage;
  onApplyAction?: (action: SuggestedAction) => void;
  isApplying?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <View
      style={{
        marginBottom: 16,
        alignItems: isUser ? 'flex-end' : 'flex-start',
        paddingHorizontal: 4,
      }}
    >
      {/* Coach Avatar for assistant messages */}
      {!isUser && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              backgroundColor: Colors.glass.blue[20],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="fitness" size={12} color={Colors.signal[400]} />
          </View>
          <Text
            style={{
              marginLeft: 8,
              fontSize: 12,
              fontWeight: '600',
              color: Colors.graphite[400],
            }}
          >
            Coach
          </Text>
        </View>
      )}

      {/* Message Content */}
      <View
        style={{
          maxWidth: '90%',
          borderRadius: 18,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: isUser
            ? Colors.signal[600]
            : Colors.glass.white[5],
          borderWidth: isUser ? 0 : 1,
          borderColor: Colors.glass.white[10],
          borderTopRightRadius: isUser ? 4 : 18,
          borderTopLeftRadius: isUser ? 18 : 4,
        }}
      >
        {message.isStreaming ? (
          <ThinkingDots />
        ) : (
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: isUser ? '#fff' : Colors.graphite[100],
            }}
          >
            {message.content}
          </Text>
        )}
      </View>

      {/* Suggested Action */}
      {message.suggestedAction && !message.suggestedAction.applied && onApplyAction && (
        <View style={{ width: '90%', marginTop: 4 }}>
          <CoachActionCard
            action={message.suggestedAction}
            onApply={() => onApplyAction(message.suggestedAction!)}
            onDismiss={() => {}}
            isApplying={isApplying}
          />
        </View>
      )}
    </View>
  );
});

// ============================================================================
// Empty State
// ============================================================================

const EmptyState = React.memo(function EmptyState({
  suggestions,
  onSuggestionPress,
}: {
  suggestions: string[];
  onSuggestionPress: (text: string) => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingBottom: 100,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 24,
          backgroundColor: Colors.glass.blue[10],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Ionicons name="fitness" size={32} color={Colors.signal[400]} />
      </View>

      {/* Title */}
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          color: Colors.graphite[100],
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        What can I help with?
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          fontSize: 15,
          color: Colors.graphite[400],
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 32,
        }}
      >
        I can plan your workouts, analyze your progress, or adjust your training based on how you're feeling.
      </Text>

      {/* Suggestions */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {suggestions.slice(0, 4).map((suggestion) => (
          <SuggestionChip
            key={suggestion}
            label={suggestion}
            onPress={() => onSuggestionPress(suggestion)}
          />
        ))}
      </View>
    </View>
  );
});

// ============================================================================
// Input Bar
// ============================================================================

const InputBar = React.memo(function InputBar({
  value,
  onChangeText,
  onSend,
  isStreaming,
  mode,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  mode: CoachMode;
}) {
  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.void[900],
        borderTopWidth: 1,
        borderTopColor: Colors.glass.white[5],
      }}
    >
      {/* Mode Indicator */}
      <View style={{ marginBottom: 10 }}>
        <ModeIndicator mode={mode} />
      </View>

      {/* Input Row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: Colors.glass.white[5],
            borderRadius: 24,
            borderWidth: 1,
            borderColor: Colors.glass.white[10],
            paddingHorizontal: 16,
            paddingVertical: 8,
            minHeight: 48,
            maxHeight: 120,
          }}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="Ask anything..."
            placeholderTextColor={Colors.graphite[500]}
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              fontSize: 16,
              color: Colors.graphite[100],
              maxHeight: 100,
              paddingVertical: 4,
            }}
            onSubmitEditing={onSend}
          />
        </View>

        {/* Send Button */}
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={({ pressed }) => ({
            marginLeft: 10,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: canSend
              ? pressed
                ? Colors.signal[600]
                : Colors.signal[500]
              : Colors.glass.white[10],
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {isStreaming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name="arrow-up"
              size={22}
              color={canSend ? '#fff' : Colors.graphite[500]}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const CoachCopilot = React.memo(function CoachCopilot({
  contextType = 'general',
  workoutId,
  blockId,
  onClose,
  minimized = false,
  onToggleMinimize,
  initialMessage,
}: CoachCopilotProps) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');
  const initialMessageSentRef = useRef(false);

  const {
    messages,
    isStreaming,
    isLoading,
    context,
    sendMessage,
    quickSuggestions,
    currentMode,
  } = useCoach({
    contextType,
    workoutId,
    blockId,
    useAdaptiveMode: true,
  });

  const { mutate: applyAction, isPending: isApplyingAction } = useApplyCoachAction();

  // Auto-send initial message if provided
  useEffect(() => {
    if (initialMessage && !initialMessageSentRef.current && !isLoading) {
      initialMessageSentRef.current = true;
      // Small delay to ensure the hook is ready
      const timeout = setTimeout(() => {
        sendMessage(initialMessage);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [initialMessage, isLoading, sendMessage]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length === 0) return;
    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timeout);
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (inputText.trim() && !isStreaming) {
      sendMessage(inputText.trim());
      setInputText('');
    }
  }, [inputText, isStreaming, sendMessage]);

  const handleSuggestionPress = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  const handleApplyAction = useCallback(
    (action: SuggestedAction) => {
      applyAction(action);
    },
    [applyAction]
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble
        message={item}
        onApplyAction={item.role === 'assistant' ? handleApplyAction : undefined}
        isApplying={isApplyingAction}
      />
    ),
    [handleApplyAction, isApplyingAction]
  );

  // Minimized FAB
  if (minimized) {
    return (
      <View
        style={{
          position: 'absolute',
          bottom: insets.bottom + 80,
          right: 20,
        }}
      >
        <Pressable
          onPress={onToggleMinimize}
          style={({ pressed }) => ({
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: pressed ? Colors.signal[600] : Colors.signal[500],
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: Colors.signal[500],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
          })}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Colors.void[900],
        }}
      >
        <ActivityIndicator size="large" color={Colors.signal[500]} />
        <Text
          style={{
            marginTop: 16,
            color: Colors.graphite[400],
            fontSize: 14,
          }}
        >
          Loading your context...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: Colors.void[900] }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: Colors.glass.white[5],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: Colors.glass.blue[10],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="fitness" size={18} color={Colors.signal[400]} />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: Colors.graphite[100],
              }}
            >
              Coach
            </Text>
            {context?.currentBlock && (
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.graphite[400],
                }}
              >
                Week{' '}
                {Math.ceil(
                  (Date.now() - new Date(context.currentBlock.start_date).getTime()) /
                    (7 * 24 * 60 * 60 * 1000)
                )}{' '}
                • {context.currentBlock.name}
              </Text>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onToggleMinimize && (
            <Pressable
              onPress={onToggleMinimize}
              style={{ padding: 8, marginRight: 4 }}
            >
              <Ionicons name="remove-outline" size={24} color={Colors.graphite[400]} />
            </Pressable>
          )}
          {onClose && (
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={Colors.graphite[400]} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 16,
          flexGrow: messages.length === 0 ? 1 : undefined,
        }}
        ListEmptyComponent={
          <EmptyState
            suggestions={quickSuggestions.map((s) => s.label)}
            onSuggestionPress={handleSuggestionPress}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Input */}
      <View style={{ paddingBottom: insets.bottom }}>
        <InputBar
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSend}
          isStreaming={isStreaming}
          mode={currentMode}
        />
      </View>
    </KeyboardAvoidingView>
  );
});

// ============================================================================
// Floating Coach Button
// ============================================================================

export const FloatingCoachButton = React.memo(function FloatingCoachButton({
  onPress,
  hasUnread = false,
}: {
  onPress: () => void;
  hasUnread?: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 100,
        right: 20,
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: pressed ? Colors.signal[600] : Colors.signal[500],
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: Colors.signal[500],
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        })}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />

        {hasUnread && (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: Colors.regression[500],
              borderWidth: 2,
              borderColor: Colors.void[900],
            }}
          />
        )}
      </Pressable>
    </View>
  );
});
