import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useLogout } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/useAppStore';

export default function SettingsScreen() {
    const userProfile = useAppStore((state) => state.userProfile);
    const userId = useAppStore((state) => state.userId);
    const logout = useLogout();

    const handleLogout = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => logout.mutate() },
            ]
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.void[900] }}>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255, 255, 255, 0.05)',
            }}>
                <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
                    <Ionicons name="chevron-back" size={24} color={Colors.graphite[200]} />
                </Pressable>
                <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[100] }}>
                    Settings
                </Text>
            </View>

            <View style={{ flex: 1, padding: 16 }}>
                {/* Profile section */}
                <View style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                        }}>
                            <Ionicons name="person" size={24} color={Colors.signal[400]} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.graphite[100] }}>
                                {userProfile?.display_name || 'Athlete'}
                            </Text>
                            <Text style={{ fontSize: 13, color: Colors.graphite[400], marginTop: 2 }}>
                                {userProfile?.email || userId ? 'Signed in' : 'Not signed in'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Sign out button */}
                <Pressable
                    onPress={handleLogout}
                    style={({ pressed }) => ({
                        backgroundColor: pressed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 16,
                        padding: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(239, 68, 68, 0.2)',
                    })}
                >
                    <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#ef4444' }}>
                        Sign Out
                    </Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}
