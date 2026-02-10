import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useCoach } from '@/hooks/useCoach';
import { useDailyBriefing } from '@/hooks/useDailyBriefing';
import { useTodaysReadiness } from '@/hooks/useReadiness';
import { useReadinessAwareWorkout } from '@/hooks/useReadinessAwareWorkout';
import { useActiveTrainingBlock } from '@/hooks/useTrainingBlocks';
import type { CoachAction } from '@/types/coach';
import type { ChatMessage } from '@/types/database';

// Components
import { FoundryLabLogo } from '@/components/FoundryLabLogo';
import { SectionLabel } from '@/components/ui/LabPrimitives';

// ============================================================================
// Types
// ============================================================================

interface GuideStreamProps {
    onOpenProfile: () => void;
}

// ============================================================================
// Welcome State (replaces separate DailyBriefing card)
// ============================================================================

const CopilotWelcome = React.memo(function CopilotWelcome({
    onSuggestionPress,
}: {
    onSuggestionPress: (text: string) => void;
}) {
    const { data: readinessAwareWorkout } = useReadinessAwareWorkout();
    const { data: readiness } = useTodaysReadiness();
    const { data: activeBlock } = useActiveTrainingBlock();
    const { greeting } = useDailyBriefing();

    const hasReadiness = !!readiness;
    const isRestDay = readinessAwareWorkout?.suggestRest;

    const displayGreeting = greeting || (hasReadiness
        ? isRestDay ? "Take it easy today." : "Ready to train?"
        : "Good morning.");

    const subtitle = readinessAwareWorkout?.adjustmentSummary ||
        (hasReadiness
            ? "I've analyzed your recovery. Let's get to work."
            : "Check in so I can finalize today's plan.");

    // Build contextual suggestion chips
    const suggestions: { label: string; icon: keyof typeof Ionicons.glyphMap; chatMessage?: string }[] = [];
    const dayOfWeek = new Date().getDay(); // 0 = Sunday

    if (!hasReadiness) {
        // Prompt natural language check-in via chat (not a separate screen)
        suggestions.push({
            label: 'Check in',
            icon: 'pulse',
            chatMessage: "I'm checking in for today — here's how I feel:",
        });
    } else {
        suggestions.push({ label: "What's my plan today?", icon: 'barbell' });
    }

    if (dayOfWeek === 0) {
        // Sunday — weekly planning day
        suggestions.push({ label: 'Plan my week', icon: 'calendar' });
    }

    if (activeBlock) {
        suggestions.push({ label: 'How am I progressing?', icon: 'trending-up' });
    }

    suggestions.push({ label: 'Log a workout', icon: 'create', chatMessage: "Here's what I did:" });
    suggestions.push({ label: 'Adjust my training', icon: 'options' });

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 }}>
            {/* Coach avatar */}
            <View
                style={{
                    width: 64,
                    height: 64,
                    borderRadius: 22,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                }}
            >
                <Ionicons name="sparkles" size={28} color={Colors.signal[500]} />
            </View>

            {/* Greeting */}
            <Text style={{
                fontSize: 24,
                fontWeight: '700',
                color: Colors.graphite[100],
                textAlign: 'center',
                marginBottom: 8,
            }}>
                {displayGreeting}
            </Text>

            {/* Subtitle */}
            <Text style={{
                fontSize: 15,
                color: Colors.graphite[400],
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: 32,
            }}>
                {subtitle}
            </Text>

            {/* Suggestion chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                {suggestions.slice(0, 4).map((suggestion) => (
                    <Pressable
                        key={suggestion.label}
                        onPress={() => {
                            onSuggestionPress(suggestion.chatMessage || suggestion.label);
                        }}
                        style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: pressed
                                ? 'rgba(255, 255, 255, 0.1)'
                                : suggestion.label === 'Check in'
                                    ? 'rgba(59, 130, 246, 0.15)'
                                    : 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1,
                            borderColor: suggestion.label === 'Check in'
                                ? 'rgba(59, 130, 246, 0.3)'
                                : 'rgba(255, 255, 255, 0.1)',
                        })}
                    >
                        <Ionicons
                            name={suggestion.icon}
                            size={14}
                            color={suggestion.label === 'Check in' ? Colors.signal[400] : Colors.graphite[300]}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={{
                            fontSize: 13,
                            fontWeight: '500',
                            color: suggestion.label === 'Check in' ? Colors.signal[300] : Colors.graphite[200],
                        }}>
                            {suggestion.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
});

// ============================================================================
// Message Bubble
// ============================================================================

const GuideMessageBubble = React.memo(function GuideMessageBubble({
    message,
    onAction,
}: {
    message: ChatMessage;
    onAction?: (action: CoachAction) => void;
}) {
    const isUser = message.role === 'user';
    const hasAction = !!message.suggestedAction;

    return (
        <View
            style={{
                marginBottom: 16,
                paddingHorizontal: 16,
                alignItems: isUser ? 'flex-end' : 'flex-start'
            }}
        >
            {/* Coach label for assistant messages */}
            {!isUser && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <View
                        style={{
                            width: 22,
                            height: 22,
                            borderRadius: 8,
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Ionicons name="sparkles" size={10} color={Colors.signal[400]} />
                    </View>
                    <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '600', color: Colors.graphite[400] }}>
                        Coach
                    </Text>
                </View>
            )}

            <View
                style={{
                    maxWidth: '85%',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: isUser ? Colors.signal[600] : 'rgba(255, 255, 255, 0.05)',
                    borderWidth: isUser ? 0 : 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderTopRightRadius: isUser ? 4 : 20,
                    borderTopLeftRadius: isUser ? 20 : 4,
                }}
            >
                {message.isStreaming ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
                        <ActivityIndicator size="small" color={Colors.signal[400]} />
                        <Text style={{ marginLeft: 8, fontSize: 14, color: Colors.signal[400] }}>Thinking...</Text>
                    </View>
                ) : (
                    <Text style={{ fontSize: 16, lineHeight: 24, color: isUser ? '#fff' : Colors.graphite[100] }}>
                        {message.content}
                    </Text>
                )}

                {/* Suggested Action Button */}
                {!isUser && hasAction && message.suggestedAction && (
                    <Pressable
                        onPress={() => onAction?.(message.suggestedAction as unknown as CoachAction)}
                        style={{
                            marginTop: 12,
                            paddingVertical: 8,
                            paddingHorizontal: 14,
                            borderRadius: 16,
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(59, 130, 246, 0.3)',
                            flexDirection: 'row',
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                        }}
                    >
                        <Ionicons name="arrow-forward" size={14} color={Colors.signal[400]} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.signal[300] }}>
                            {message.suggestedAction.label}
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export default function GuideStream({ onOpenProfile }: GuideStreamProps) {
    const flatListRef = useRef<FlatList>(null);
    const [inputText, setInputText] = useState('');

    const { messages, sendMessage, isStreaming } = useCoach({
        contextType: 'general',
        useAdaptiveMode: true
    });

    const handleSend = () => {
        if (inputText.trim()) {
            sendMessage(inputText.trim());
            setInputText('');
        }
    };

    const handleSuggestionPress = useCallback((text: string) => {
        sendMessage(text);
    }, [sendMessage]);

    const handleSuggestedAction = useCallback((action: CoachAction) => {
        if (action.type === 'adjust_workout' || action.type === 'update_targets') {
            router.push('/program');
        } else if (action.type === 'schedule_deload') {
            router.push('/week-plan');
        } else if (action.type === 'set_goal') {
            router.push('/goals');
        } else if (action.type === 'open_week_planner') {
            router.push({
                pathname: '/week-plan',
                params: action.constraints
            } as any);
        }
    }, []);

    const hasMessages = messages.length > 0;

    return (
        <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: hasMessages ? 1 : 0,
                    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <FoundryLabLogo size={32} />
                        <SectionLabel>Daily Guide</SectionLabel>
                    </View>
                    <Pressable onPress={onOpenProfile}>
                        <Ionicons name="person-circle-outline" size={32} color={Colors.graphite[400]} />
                    </Pressable>
                </View>

                {/* Content */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    {hasMessages ? (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={({ item }) => (
                                <GuideMessageBubble
                                    message={item}
                                    onAction={handleSuggestedAction}
                                />
                            )}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ paddingTop: 16, paddingBottom: 20 }}
                            onContentSizeChange={() => {
                                flatListRef.current?.scrollToEnd({ animated: true });
                            }}
                        />
                    ) : (
                        <CopilotWelcome onSuggestionPress={handleSuggestionPress} />
                    )}

                    {/* Input Area */}
                    <View style={{
                        padding: 16,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.05)',
                        backgroundColor: Colors.void[900]
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <TextInput
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Ask your coach..."
                                placeholderTextColor={Colors.graphite[500]}
                                style={{
                                    flex: 1,
                                    height: 48,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderRadius: 24,
                                    paddingHorizontal: 20,
                                    color: '#fff',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.1)'
                                }}
                                onSubmitEditing={handleSend}
                                returnKeyType="send"
                            />
                            <Pressable
                                onPress={handleSend}
                                disabled={!inputText.trim() || isStreaming}
                                style={({ pressed }) => ({
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                    backgroundColor: inputText.trim()
                                        ? pressed ? Colors.signal[600] : Colors.signal[500]
                                        : 'rgba(255,255,255,0.1)',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                })}
                            >
                                {isStreaming ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Ionicons name="arrow-up" size={24} color={inputText.trim() ? '#fff' : Colors.graphite[500]} />
                                )}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
