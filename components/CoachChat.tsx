/**
 * CoachChat Component
 *
 * Interactive chat interface for the AI coach.
 * Features context-aware suggestions, message history, and action buttons.
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

import { useColorScheme } from '@/components/useColorScheme';
import { useCoach, useApplyCoachAction } from '@/hooks/useCoach';
import type { QuickSuggestion } from '@/lib/coachContext';
import type { ChatMessage, ConversationContextType, SuggestedAction } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

interface CoachChatProps {
  contextType?: ConversationContextType;
  workoutId?: string;
  blockId?: string;
  onClose?: () => void;
}

// ============================================================================
// Quick Suggestion Pills
// ============================================================================

const QuickSuggestionPill = React.memo(function QuickSuggestionPill({
  suggestion,
  onPress,
  isDark,
}: {
  suggestion: QuickSuggestion;
  onPress: (prompt: string) => void;
  isDark: boolean;
}) {
  return (
    <Pressable
      onPress={() => onPress(suggestion.prompt)}
      className={`flex-row items-center px-4 py-2 rounded-full mr-2 mb-2 ${
        isDark ? 'bg-graphite-700' : 'bg-graphite-100'
      }`}
    >
      <Ionicons
        name={suggestion.icon as keyof typeof Ionicons.glyphMap}
        size={16}
        color={isDark ? '#a3b1cc' : '#607296'}
      />
      <Text
        className={`ml-2 text-sm ${isDark ? 'text-graphite-200' : 'text-graphite-700'}`}
      >
        {suggestion.label}
      </Text>
    </Pressable>
  );
});

// ============================================================================
// Message Bubble
// ============================================================================

const MessageBubble = React.memo(function MessageBubble({
  message,
  isDark,
  onApplyAction,
}: {
  message: ChatMessage;
  isDark: boolean;
  onApplyAction?: (action: SuggestedAction) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <View
      className={`mb-3 ${isUser ? 'items-end' : 'items-start'}`}
    >
      <View
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-signal-500 rounded-br-sm'
            : isDark
            ? 'bg-graphite-800 rounded-bl-sm'
            : 'bg-white rounded-bl-sm border border-graphite-200'
        }`}
      >
        {message.isStreaming ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color={isDark ? '#a3b1cc' : '#607296'} />
            <Text
              className={`ml-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
            >
              Thinking...
            </Text>
          </View>
        ) : (
          <Text
            className={`text-base leading-6 ${
              isUser
                ? 'text-white'
                : isDark
                ? 'text-graphite-100'
                : 'text-graphite-900'
            }`}
          >
            {message.content}
          </Text>
        )}
      </View>

      {/* Suggested Action Button */}
      {message.suggestedAction && !message.suggestedAction.applied && onApplyAction && (
        <Pressable
          onPress={() => onApplyAction(message.suggestedAction!)}
          className={`mt-2 flex-row items-center px-4 py-2 rounded-xl ${
            isDark ? 'bg-signal-500/20' : 'bg-signal-50'
          } border border-signal-500/30`}
        >
          <Ionicons name="flash" size={16} color="#2F80ED" />
          <Text className="ml-2 text-signal-500 font-medium">
            {message.suggestedAction.label}
          </Text>
        </Pressable>
      )}

      {/* Timestamp */}
      <Text
        className={`text-xs mt-1 ${
          isDark ? 'text-graphite-500' : 'text-graphite-400'
        }`}
      >
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
});

// ============================================================================
// Welcome Message
// ============================================================================

const WelcomeMessage = React.memo(function WelcomeMessage({
  isDark,
  hasReadiness,
  hasBlock,
}: {
  isDark: boolean;
  hasReadiness: boolean;
  hasBlock: boolean;
}) {
  return (
    <View className="items-center justify-center py-8 px-6">
      <View
        className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
          isDark ? 'bg-signal-500/20' : 'bg-signal-50'
        }`}
      >
        <Ionicons name="fitness" size={32} color="#2F80ED" />
      </View>
      <Text
        className={`text-xl font-bold text-center mb-2 ${
          isDark ? 'text-graphite-100' : 'text-graphite-900'
        }`}
      >
        Hey, Coach here!
      </Text>
      <Text
        className={`text-center ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
      >
        I've got your training data loaded.{' '}
        {hasReadiness
          ? "I see you've checked in today - "
          : "Haven't done your readiness check yet? No worries. "}
        {hasBlock
          ? 'Ask me anything about your current program.'
          : "Let's talk about your training goals."}
      </Text>
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
  isDark,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  isDark: boolean;
}) {
  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <View
      className={`flex-row items-end px-4 py-3 border-t ${
        isDark ? 'border-graphite-800 bg-carbon-950' : 'border-graphite-200 bg-white'
      }`}
    >
      <View
        className={`flex-1 flex-row items-end rounded-2xl px-4 py-2 min-h-[44px] max-h-32 ${
          isDark ? 'bg-graphite-800' : 'bg-graphite-100'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask your coach..."
          placeholderTextColor={isDark ? '#607296' : '#a3b1cc'}
          multiline
          maxLength={1000}
          className={`flex-1 text-base py-1 ${
            isDark ? 'text-graphite-100' : 'text-graphite-900'
          }`}
          style={{ maxHeight: 100 }}
        />
      </View>
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        className={`ml-2 w-11 h-11 rounded-full items-center justify-center ${
          canSend ? 'bg-signal-500' : isDark ? 'bg-graphite-700' : 'bg-graphite-300'
        }`}
      >
        {isStreaming ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons
            name="send"
            size={20}
            color={canSend ? '#ffffff' : isDark ? '#607296' : '#a3b1cc'}
          />
        )}
      </Pressable>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const CoachChat = React.memo(function CoachChat({
  contextType = 'general',
  workoutId,
  blockId,
  onClose,
}: CoachChatProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');

  const {
    messages,
    isStreaming,
    isLoading,
    context,
    sendMessage,
    quickSuggestions,
  } = useCoach({ contextType, workoutId, blockId });

  const { mutate: applyAction } = useApplyCoachAction();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length === 0) return;

    const timeoutId = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (inputText.trim() && !isStreaming) {
      sendMessage(inputText.trim());
      setInputText('');
    }
  }, [inputText, isStreaming, sendMessage]);

  const handleQuickSuggestion = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
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
        isDark={isDark}
        onApplyAction={item.role === 'assistant' ? handleApplyAction : undefined}
      />
    ),
    [isDark, handleApplyAction]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2F80ED" />
        <Text
          className={`mt-4 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
        >
          Loading your training context...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View
        className={`flex-row items-center justify-between px-4 py-3 border-b ${
          isDark ? 'border-graphite-800' : 'border-graphite-200'
        }`}
      >
        <View className="flex-row items-center">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              isDark ? 'bg-signal-500/20' : 'bg-signal-50'
            }`}
          >
            <Ionicons name="fitness" size={20} color="#2F80ED" />
          </View>
          <View>
            <Text
              className={`font-semibold ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              AI Coach
            </Text>
            <Text
              className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
            >
              {context?.currentBlock
                ? `Week ${Math.ceil((Date.now() - new Date(context.currentBlock.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000))} of ${context.currentBlock.name}`
                : 'Ready to help'}
            </Text>
          </View>
        </View>
        {onClose && (
          <Pressable onPress={onClose} className="p-2">
            <Ionicons
              name="close"
              size={24}
              color={isDark ? '#d3d8e4' : '#374151'}
            />
          </Pressable>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 8,
          flexGrow: messages.length === 0 ? 1 : undefined,
        }}
        ListEmptyComponent={
          <View className="flex-1">
            <WelcomeMessage
              isDark={isDark}
              hasReadiness={!!context?.todayReadiness}
              hasBlock={!!context?.currentBlock}
            />

            {/* Quick Suggestions */}
            {quickSuggestions.length > 0 && (
              <View className="px-2 mt-4">
                <Text
                  className={`text-sm font-medium mb-3 ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  Quick questions
                </Text>
                <View className="flex-row flex-wrap">
                  {quickSuggestions.map((suggestion) => (
                    <QuickSuggestionPill
                      key={suggestion.id}
                      suggestion={suggestion}
                      onPress={handleQuickSuggestion}
                      isDark={isDark}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Input */}
      <InputBar
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSend}
        isStreaming={isStreaming}
        isDark={isDark}
      />
    </KeyboardAvoidingView>
  );
});

// ============================================================================
// Compact Coach Button (for embedding in other screens)
// ============================================================================

export const CoachButton = React.memo(function CoachButton({
  onPress,
  hasNotification = false,
}: {
  onPress: () => void;
  hasNotification?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={onPress}
      className={`w-14 h-14 rounded-full items-center justify-center shadow-lg ${
        isDark ? 'bg-signal-600' : 'bg-signal-500'
      }`}
      style={{
        shadowColor: '#2F80ED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Ionicons name="chatbubble-ellipses" size={24} color="#ffffff" />
      {hasNotification && (
        <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white" />
      )}
    </Pressable>
  );
});
