import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useCoach } from '@/hooks/useCoach';
import { useDailyBriefing } from '@/hooks/useDailyBriefing';
import { useTodaysReadiness } from '@/hooks/useReadiness';
import { useReadinessAwareWorkout } from '@/hooks/useReadinessAwareWorkout';
import { useActiveTrainingBlock } from '@/hooks/useTrainingBlocks';
import type { CoachAction } from '@/types/coach';
import type { ChatMessage } from '@/types/database';

import { FoundryLabLogo } from '@/components/FoundryLabLogo';
import { SectionLabel } from '@/components/ui/LabPrimitives';

// Clearance for the floating tab bar (height 72 + bottom offset 24 on iOS / 16 Android)
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 100 : 92;

// ============================================================================
// Voice Input Hook (Web Speech API)
// ============================================================================

function useVoiceInput() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<any>(null);

    // Check availability — Web Speech API works in Chrome/Edge on web
    const isAvailable = Platform.OS === 'web'
        && typeof window !== 'undefined'
        && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const startListening = useCallback(() => {
        if (!isAvailable) return;

        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let final = '';
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript;
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setTranscript(final || interim);
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        setTranscript('');
    }, [isAvailable]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    useEffect(() => {
        return () => { recognitionRef.current?.abort(); };
    }, []);

    return { isListening, transcript, isAvailable, startListening, stopListening };
}

// ============================================================================
// Types
// ============================================================================

interface GuideStreamProps {
    onOpenProfile: () => void;
}

interface SuggestionChip {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    chatMessage: string;
    primary?: boolean;
    navigate?: string;
}

// ============================================================================
// Welcome State — compact, left-aligned, pushed to bottom
// ============================================================================

const CopilotWelcome = React.memo(function CopilotWelcome({
    onSuggestionPress,
}: {
    onSuggestionPress: (chip: SuggestionChip) => void;
}) {
    const { data: readinessAwareWorkout } = useReadinessAwareWorkout();
    const { data: readiness } = useTodaysReadiness();
    const { data: activeBlock } = useActiveTrainingBlock();
    const { greeting } = useDailyBriefing();

    const hasReadiness = !!readiness;
    const dayOfWeek = new Date().getDay(); // 0=Sun
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // Time-aware greeting
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const displayGreeting = greeting || `${timeGreeting}.`;

    // Contextual subtitle
    const subtitle = hasReadiness
        ? readinessAwareWorkout?.suggestRest
            ? "Recovery day. Let me know if you want to do something light."
            : readinessAwareWorkout?.adjustmentSummary || `It's ${dayName}. Ready when you are.`
        : `It's ${dayName}. How are you feeling?`;

    // Build day-aware, state-aware chips
    const suggestions: SuggestionChip[] = [];

    if (!hasReadiness) {
        // No check-in yet: let them skip OR check in naturally
        suggestions.push({
            label: "Slept great, let's go",
            icon: 'flash',
            chatMessage: "Slept great, feeling fresh and ready to train",
            primary: true,
        });
        suggestions.push({
            label: "What's today's session?",
            icon: 'barbell',
            chatMessage: "What's my workout for today?",
        });
    } else {
        // Already checked in: focus on the session
        suggestions.push({
            label: "What's today's session?",
            icon: 'barbell',
            chatMessage: "What's my workout for today?",
            primary: true,
        });
    }

    if (dayOfWeek === 0) {
        suggestions.push({ label: 'Plan my week', icon: 'calendar', chatMessage: 'Plan my week' });
    }

    suggestions.push({
        label: 'Log a workout',
        icon: 'create',
        chatMessage: "Here's what I did:",
    });

    suggestions.push({
        label: 'See full week',
        icon: 'calendar-outline',
        chatMessage: '',
        navigate: '/week-plan',
    });

    return (
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 16 }}>
            {/* Coach icon + greeting */}
            <View style={{ marginBottom: 24 }}>
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 16,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                    }}
                >
                    <Ionicons name="sparkles" size={20} color={Colors.signal[500]} />
                </View>

                <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: Colors.graphite[100],
                    marginBottom: 6,
                }}>
                    {displayGreeting}
                </Text>

                <Text style={{
                    fontSize: 15,
                    color: Colors.graphite[400],
                    lineHeight: 22,
                }}>
                    {subtitle}
                </Text>
            </View>

            {/* Quick action chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.slice(0, 4).map((chip) => (
                    <Pressable
                        key={chip.label}
                        onPress={() => onSuggestionPress(chip)}
                        style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 20,
                            backgroundColor: pressed
                                ? 'rgba(255, 255, 255, 0.12)'
                                : chip.primary
                                    ? 'rgba(59, 130, 246, 0.15)'
                                    : 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1,
                            borderColor: chip.primary
                                ? 'rgba(59, 130, 246, 0.3)'
                                : 'rgba(255, 255, 255, 0.08)',
                        })}
                    >
                        <Ionicons
                            name={chip.icon}
                            size={14}
                            color={chip.primary ? Colors.signal[400] : Colors.graphite[300]}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={{
                            fontSize: 13,
                            fontWeight: '500',
                            color: chip.primary ? Colors.signal[300] : Colors.graphite[200],
                        }}>
                            {chip.label}
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
            {/* Coach label */}
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
    const inputRef = useRef<TextInput>(null);

    const { messages, sendMessage, isStreaming } = useCoach({
        contextType: 'general',
        useAdaptiveMode: true,
    });

    const voice = useVoiceInput();

    // Fill input with voice transcript as it arrives
    useEffect(() => {
        if (voice.transcript) {
            setInputText(voice.transcript);
        }
    }, [voice.transcript]);

    const handleSend = useCallback(() => {
        const text = inputText.trim();
        if (text) {
            sendMessage(text);
            setInputText('');
        }
    }, [inputText, sendMessage]);

    const handleChipPress = useCallback((chip: SuggestionChip) => {
        if (chip.navigate) {
            router.push(chip.navigate as any);
        } else {
            sendMessage(chip.chatMessage);
        }
    }, [sendMessage]);

    const handleMicPress = useCallback(() => {
        if (voice.isListening) {
            voice.stopListening();
        } else {
            setInputText('');
            voice.startListening();
        }
    }, [voice.isListening, voice.startListening, voice.stopListening]);

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
                params: action.constraints,
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Pressable onPress={() => router.push('/week-plan')} hitSlop={8}>
                            <Ionicons name="calendar-outline" size={24} color={Colors.graphite[400]} />
                        </Pressable>
                        <Pressable onPress={onOpenProfile}>
                            <Ionicons name="person-circle-outline" size={32} color={Colors.graphite[400]} />
                        </Pressable>
                    </View>
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
                        <CopilotWelcome onSuggestionPress={handleChipPress} />
                    )}

                    {/* Input Area — with clearance for floating tab bar */}
                    <View style={{
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: TAB_BAR_CLEARANCE,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.05)',
                        backgroundColor: Colors.void[900],
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {/* Mic button */}
                            <Pressable
                                onPress={voice.isAvailable ? handleMicPress : undefined}
                                disabled={!voice.isAvailable}
                                style={({ pressed }) => ({
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: voice.isListening
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : pressed
                                            ? 'rgba(255,255,255,0.1)'
                                            : 'rgba(255,255,255,0.05)',
                                    borderWidth: 1,
                                    borderColor: voice.isListening
                                        ? 'rgba(239, 68, 68, 0.4)'
                                        : 'rgba(255,255,255,0.08)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: voice.isAvailable ? 1 : 0.4,
                                })}
                            >
                                <Ionicons
                                    name={voice.isListening ? 'radio' : 'mic'}
                                    size={20}
                                    color={voice.isListening ? '#ef4444' : Colors.graphite[300]}
                                />
                            </Pressable>

                            {/* Text input */}
                            <TextInput
                                ref={inputRef}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder={voice.isListening ? 'Listening...' : 'Tell your coach...'}
                                placeholderTextColor={voice.isListening ? '#ef4444' : Colors.graphite[500]}
                                style={{
                                    flex: 1,
                                    height: 44,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderRadius: 22,
                                    paddingHorizontal: 16,
                                    color: '#fff',
                                    fontSize: 15,
                                    borderWidth: 1,
                                    borderColor: voice.isListening
                                        ? 'rgba(239, 68, 68, 0.3)'
                                        : 'rgba(255,255,255,0.08)',
                                }}
                                onSubmitEditing={handleSend}
                                returnKeyType="send"
                            />

                            {/* Send button */}
                            <Pressable
                                onPress={handleSend}
                                disabled={!inputText.trim() || isStreaming}
                                style={({ pressed }) => ({
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: inputText.trim()
                                        ? pressed ? Colors.signal[600] : Colors.signal[500]
                                        : 'rgba(255,255,255,0.05)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                })}
                            >
                                {isStreaming ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Ionicons
                                        name="arrow-up"
                                        size={20}
                                        color={inputText.trim() ? '#fff' : Colors.graphite[500]}
                                    />
                                )}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
