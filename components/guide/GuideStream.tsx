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
import { GlassCard, LabButton, SectionLabel } from '@/components/ui/LabPrimitives';

// ============================================================================
// Types
// ============================================================================

interface GuideStreamProps {
    onOpenProfile: () => void;
}

// ============================================================================
// Daily Briefing Component
// ============================================================================

const DailyBriefing = React.memo(function DailyBriefing() {
    const { data: readinessAwareWorkout, isLoading } = useReadinessAwareWorkout();
    const { data: readiness } = useTodaysReadiness();
    const { data: activeBlock } = useActiveTrainingBlock();
    const { greeting } = useDailyBriefing();

    if (isLoading) {
        return (
            <View style={{ padding: 16 }}>
                <ActivityIndicator color={Colors.signal[500]} />
            </View>
        );
    }

    const hasReadiness = !!readiness;
    const isRestDay = readinessAwareWorkout?.suggestRest;

    return (
        <View style={{ marginBottom: 24, paddingHorizontal: 16 }}>
            <SectionLabel>Daily Briefing</SectionLabel>

            <GlassCard variant="elevated">
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                    <View
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12
                        }}
                    >
                        <Ionicons name="sparkles" size={20} color={Colors.signal[500]} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[100], marginBottom: 4 }}>
                            {greeting || (hasReadiness
                                ? isRestDay ? "Take it easy today." : "Ready to train?"
                                : "Good Morning.")}
                        </Text>
                        <Text style={{ fontSize: 14, color: Colors.graphite[300], lineHeight: 20 }}>
                            {readinessAwareWorkout?.adjustmentSummary ||
                                (hasReadiness
                                    ? "I've analyzed your recovery. Let's get to work."
                                    : "Let's check your readiness before we finalize today's plan.")}
                        </Text>
                    </View>
                </View>

                {/* Action Area */}
                {hasReadiness ? (
                    <View style={{ marginTop: 8 }}>
                        <LabButton
                            label="View Today's Plan"
                            onPress={() => router.push('/program')}
                            icon={<Ionicons name="barbell" size={16} color="white" />}
                        />
                    </View>
                ) : (
                    <LabButton
                        label="Check In Now"
                        onPress={() => router.push('/readiness')}
                        icon={<Ionicons name="pulse" size={16} color="white" />}
                    />
                )}
            </GlassCard>
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
            <View
                style={{
                    maxWidth: '85%',
                    borderRadius: 20,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: isUser ? Colors.signal[600] : 'rgba(255, 255, 255, 0.05)',
                    borderWidth: isUser ? 0 : 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
            >
                <Text style={{ fontSize: 16, lineHeight: 24, color: isUser ? '#fff' : Colors.graphite[100] }}>
                    {message.content}
                </Text>

                {/* Suggested Action Button */}
                {!isUser && hasAction && message.suggestedAction && (
                    <View style={{ marginTop: 12 }}>
                        <LabButton
                            label={message.suggestedAction.label}
                            size="sm"
                            variant="secondary"
                            onPress={() => onAction?.(message.suggestedAction as unknown as CoachAction)}
                            icon={<Ionicons name="arrow-forward" size={14} color="white" />}
                        />
                    </View>
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

    // Use "daily" context for the guide
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

    const handleSuggestedAction = useCallback((action: CoachAction) => {
        // Handle common actions or route them
        console.log('Action triggered:', action);

        if (action.type === 'adjust_workout' || action.type === 'update_targets') {
            // For now, route to program or workout
            router.push('/program');
        } else if (action.type === 'schedule_deload') {
            // Maybe show a confirmation or route to planner
            router.push('/week-plan');
        } else if (action.type === 'set_goal') {
            router.push('/goals');
        } else if (action.type === 'open_week_planner') {
            router.push({
                pathname: '/week-plan',
                params: action.constraints
            } as any);
        } else {
            // Default fallback
            // router.push('/coach');
            console.log('Action not handled:', action);
        }
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <FoundryLabLogo size={32} />
                        <SectionLabel>Daily Guide</SectionLabel>
                    </View>
                    <Pressable onPress={onOpenProfile}>
                        <Ionicons name="person-circle-outline" size={32} color={Colors.graphite[400]} />
                    </Pressable>
                </View>

                {/* Content Stream */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
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
                        ListHeaderComponent={<DailyBriefing />}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />

                    {/* Input Area */}
                    <View style={{
                        padding: 16,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.1)',
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
                            />
                            <Pressable
                                onPress={handleSend}
                                disabled={!inputText.trim() || isStreaming}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                    backgroundColor: inputText.trim() ? Colors.signal[500] : 'rgba(255,255,255,0.1)',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
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
