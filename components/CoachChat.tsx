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

import { Colors } from '@/constants/Colors';
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
}: {
  suggestion: QuickSuggestion;
  onPress: (prompt: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(suggestion.prompt)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <Ionicons
        name={suggestion.icon as keyof typeof Ionicons.glyphMap}
        size={16}
        color={Colors.graphite[300]}
      />
      <Text style={{ marginLeft: 8, fontSize: 14, color: Colors.graphite[200] }}>
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
  onApplyAction,
}: {
  message: ChatMessage;
  onApplyAction?: (action: SuggestedAction) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <View style={{ marginBottom: 12, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '85%',
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: isUser ? Colors.signal[500] : 'rgba(255, 255, 255, 0.05)',
          borderWidth: isUser ? 0 : 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderBottomRightRadius: isUser ? 4 : 16,
          borderBottomLeftRadius: isUser ? 16 : 4,
        }}
      >
        {message.isStreaming ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator size="small" color={Colors.graphite[300]} />
            <Text style={{ marginLeft: 8, color: Colors.graphite[400] }}>Thinking...</Text>
          </View>
        ) : (
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: isUser ? '#ffffff' : Colors.graphite[100],
            }}
          >
            {message.content}
          </Text>
        )}
      </View>

      {/* Suggested Action Button */}
      {message.suggestedAction && !message.suggestedAction.applied && onApplyAction && (
        <Pressable
          onPress={() => onApplyAction(message.suggestedAction!)}
          style={{
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 1,
            borderColor: 'rgba(59, 130, 246, 0.3)',
          }}
        >
          <Ionicons name="flash" size={16} color={Colors.signal[500]} />
          <Text style={{ marginLeft: 8, color: Colors.signal[500], fontWeight: '500' }}>
            {message.suggestedAction.label}
          </Text>
        </Pressable>
      )}

      {/* Timestamp */}
      <Text style={{ fontSize: 12, marginTop: 4, color: Colors.graphite[500] }}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
});

// ============================================================================
// Welcome Message
// ============================================================================

const WelcomeMessage = React.memo(function WelcomeMessage({
  hasReadiness,
  hasBlock,
}: {
  hasReadiness: boolean;
  hasBlock: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
        }}
      >
        <Ionicons name="fitness" size={32} color={Colors.signal[500]} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: Colors.graphite[100] }}>
        Hey, Coach here!
      </Text>
      <Text style={{ textAlign: 'center', color: Colors.graphite[400] }}>
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
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isStreaming: boolean;
}) {
  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-end',
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 8,
          minHeight: 44,
          maxHeight: 128,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask your coach..."
          placeholderTextColor={Colors.graphite[500]}
          multiline
          maxLength={1000}
          style={{
            flex: 1,
            fontSize: 16,
            paddingVertical: 4,
            maxHeight: 100,
            color: Colors.graphite[100],
          }}
        />
      </View>
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        style={{
          marginLeft: 8,
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: canSend ? Colors.signal[500] : 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {isStreaming ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons
            name="send"
            size={20}
            color={canSend ? '#ffffff' : Colors.graphite[500]}
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
        onApplyAction={item.role === 'assistant' ? handleApplyAction : undefined}
      />
    ),
    [handleApplyAction]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.signal[500]} />
        <Text style={{ marginTop: 16, color: Colors.graphite[400] }}>
          Loading your training context...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
            }}
          >
            <Ionicons name="fitness" size={20} color={Colors.signal[500]} />
          </View>
          <View>
            <Text style={{ fontWeight: '600', color: Colors.graphite[100] }}>AI Coach</Text>
            <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
              {context?.currentBlock
                ? `Week ${Math.ceil((Date.now() - new Date(context.currentBlock.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000))} of ${context.currentBlock.name}`
                : 'Ready to help'}
            </Text>
          </View>
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color={Colors.graphite[200]} />
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
          <View style={{ flex: 1 }}>
            <WelcomeMessage
              hasReadiness={!!context?.todayReadiness}
              hasBlock={!!context?.currentBlock}
            />

            {/* Quick Suggestions */}
            {quickSuggestions.length > 0 && (
              <View style={{ paddingHorizontal: 8, marginTop: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 12, color: Colors.graphite[400] }}>
                  Quick questions
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {quickSuggestions.map((suggestion) => (
                    <QuickSuggestionPill
                      key={suggestion.id}
                      suggestion={suggestion}
                      onPress={handleQuickSuggestion}
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
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.signal[500],
        shadowColor: '#2F80ED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Ionicons name="chatbubble-ellipses" size={24} color="#ffffff" />
      {hasNotification && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: '#ef4444',
            borderWidth: 2,
            borderColor: '#ffffff',
          }}
        />
      )}
    </Pressable>
  );
});
