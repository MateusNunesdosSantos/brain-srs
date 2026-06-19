import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '../../components/Themed';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/StateContext';
import { apiRequest } from '../../services/api';

type RankingUser = {
  id: string;
  name: string;
  weeklyXp: number;
  streak: number;
  photoUrl: string | null;
  position?: number;
};

type FriendListItem = {
  id: string;
  status: 'pending' | 'accepted';
  user: { id: string; name: string; email: string; photoUrl: string | null };
  friend: { id: string; name: string; email: string; photoUrl: string | null };
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { state, dispatchAction } = useAppState();

  const [activeSubTab, setActiveSubTab] = useState<'social' | 'rankings' | 'settings'>('social');
  
  // States para rankings e amigos
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [loadingSocial, setLoadingSocial] = useState(false);

  // States para ajustes SRS
  const [minCooldown, setMinCooldown] = useState('10');
  const [maxCooldown, setMaxCooldown] = useState('60');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // State para adicionar amigo
  const [friendEmail, setFriendEmail] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Inicializa valores de configurações
  useEffect(() => {
    if (state?.settings) {
      setMinCooldown(String(state.settings.cooldownMinMinutes));
      setMaxCooldown(String(state.settings.cooldownMaxMinutes));
      setSoundEnabled(state.settings.soundEnabled);
    }
  }, [state]);

  // Carrega rankings e amigos do backend
  const loadSocialData = async () => {
    setLoadingSocial(true);
    try {
      const [rankData, friendsData] = await Promise.all([
        apiRequest('/api/rankings/global'),
        apiRequest('/api/friends'),
      ]);
      setRankings(rankData.ranking || []);
      setFriends(friendsData.friends || []);
    } catch (e) {
      console.error('Erro ao carregar dados sociais:', e);
    } finally {
      setLoadingSocial(false);
    }
  };

  useEffect(() => {
    loadSocialData();
  }, [activeSubTab]);

  const handleSaveSettings = async () => {
    const min = parseInt(minCooldown);
    const max = parseInt(maxCooldown);

    if (isNaN(min) || isNaN(max) || min < 1 || max < min) {
      Alert.alert('Erro', 'Insira valores válidos (Mínimo >= 1, Máximo >= Mínimo).');
      return;
    }

    setSavingSettings(true);
    try {
      await dispatchAction({
        type: 'saveSettings',
        settings: {
          cooldownMinMinutes: min,
          cooldownMaxMinutes: max,
          firstReviewDays: state?.settings?.firstReviewDays ?? 1,
          reviewMultiplier: state?.settings?.reviewMultiplier ?? 2,
          soundEnabled: soundEnabled,
        },
      });
      Alert.alert('Sucesso', 'Configurações de estudo salvas com sucesso!');
    } catch {
      Alert.alert('Erro', 'Falha ao salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!friendEmail.trim()) {
      Alert.alert('Erro', 'Preencha o e-mail do amigo.');
      return;
    }
    setSendingRequest(true);
    try {
      const res = await apiRequest('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ target: friendEmail.trim() }),
      });
      Alert.alert('Sucesso', res.message || 'Solicitação enviada!');
      setFriendEmail('');
      loadSocialData();
    } catch (e: any) {
      Alert.alert('Erro', e?.error || 'Erro ao enviar solicitação.');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptFriend = async (friendshipId: string) => {
    try {
      await apiRequest('/api/friends/accept', {
        method: 'POST',
        body: JSON.stringify({ friendshipId }),
      });
      Alert.alert('Sucesso', 'Solicitação de amizade aceita!');
      loadSocialData();
    } catch (e: any) {
      Alert.alert('Erro', e?.error || 'Erro ao aceitar solicitação.');
    }
  };

  const handleRemoveFriend = async (friendshipId: string, name: string) => {
    Alert.alert('Desfazer Amizade', `Deseja remover ${name} da sua lista de amigos?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest('/api/friends/remove', {
              method: 'POST',
              body: JSON.stringify({ friendshipId }),
            });
            loadSocialData();
          } catch (e: any) {
            Alert.alert('Erro', e?.error || 'Erro ao remover amizade.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f7f7' }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
      {/* 1. Header do Perfil */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarChar}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={[styles.planBadge, user?.plan === 'pro' ? styles.proBadge : styles.freeBadge]}>
              {user?.plan?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>
      </View>

      {/* 2. Stats Rápidos */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>🔥 {user?.streak ?? 0}</Text>
          <Text style={styles.statLabel}>Ofensiva</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>✨ {user?.xp ?? 0}</Text>
          <Text style={styles.statLabel}>XP Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>📊 {user?.weeklyXp ?? 0}</Text>
          <Text style={styles.statLabel}>XP Semanal</Text>
        </View>
      </View>

      {/* 3. Sub-Navegação de Abas */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tabButton, activeSubTab === 'social' && styles.tabButtonActive]}
          onPress={() => setActiveSubTab('social')}
        >
          <Text style={[styles.tabButtonText, activeSubTab === 'social' && styles.tabButtonTextActive]}>
            Amigos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeSubTab === 'rankings' && styles.tabButtonActive]}
          onPress={() => setActiveSubTab('rankings')}
        >
          <Text style={[styles.tabButtonText, activeSubTab === 'rankings' && styles.tabButtonTextActive]}>
            Ranking
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeSubTab === 'settings' && styles.tabButtonActive]}
          onPress={() => setActiveSubTab('settings')}
        >
          <Text style={[styles.tabButtonText, activeSubTab === 'settings' && styles.tabButtonTextActive]}>
            Ajustes
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Conteúdo das Sub-Abas */}
      {loadingSocial && activeSubTab !== 'settings' ? (
        <View style={styles.subTabLoading}>
          <ActivityIndicator color="#58cc02" />
        </View>
      ) : (
        <View style={styles.tabContentContainer}>
          {/* ABA SOCIAL */}
          {activeSubTab === 'social' && (
            <View style={styles.subTab}>
              <Text style={styles.subTabTitle}>Adicionar Amigos</Text>
              <View style={styles.addFriendRow}>
                <TextInput
                  style={styles.addFriendInput}
                  placeholder="E-mail do amigo"
                  placeholderTextColor="#666"
                  value={friendEmail}
                  onChangeText={setFriendEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity
                  style={styles.addFriendBtn}
                  onPress={handleSendFriendRequest}
                  disabled={sendingRequest}
                >
                  {sendingRequest ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.addFriendBtnText}>Convidar</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.subTabTitle}>Lista de Amigos</Text>
              {friends.length === 0 ? (
                <Text style={styles.emptySocialText}>Você ainda não possui amigos adicionados.</Text>
              ) : (
                friends.map((item, idx) => {
                  // O amigo pode ser o remetente ou o destinatário dependendo de quem criou a solicitação
                  const isIncomingRequest = item.status === 'pending' && item.friend.id === user?.id;
                  const isOutgoingRequest = item.status === 'pending' && item.user.id === user?.id;
                  
                  const targetUser = item.user.id === user?.id ? item.friend : item.user;

                  return (
                    <View key={item.id || idx} style={styles.friendCard}>
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarChar}>
                          {targetUser.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      
                      <View style={styles.friendDetails}>
                        <Text style={styles.friendName}>{targetUser.name}</Text>
                        <Text style={styles.friendEmail}>{targetUser.email}</Text>
                        
                        {item.status === 'pending' && (
                          <Text style={styles.pendingTag}>
                            {isIncomingRequest ? 'Recebido' : 'Pendente'}
                          </Text>
                        )}
                      </View>

                      <View style={styles.friendActions}>
                        {isIncomingRequest ? (
                          <TouchableOpacity
                            style={styles.acceptBtn}
                            onPress={() => handleAcceptFriend(item.id)}
                          >
                            <Text style={styles.acceptBtnText}>Aceitar</Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => handleRemoveFriend(item.id, targetUser.name)}
                        >
                          <Text style={styles.removeBtnText}>
                            {item.status === 'pending' ? 'Cancelar' : 'Excluir'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ABA RANKINGS */}
          {activeSubTab === 'rankings' && (
            <View style={styles.subTab}>
              <Text style={styles.subTabTitle}>Classificação Semanal (XP)</Text>
              {rankings.length === 0 ? (
                <Text style={styles.emptySocialText}>Nenhum ranking disponível.</Text>
              ) : (
                rankings.map((ru, idx) => {
                  const isMe = ru.id === user?.id;
                  const pos = idx + 1;

                  let posEmoji = '';
                  if (pos === 1) posEmoji = '🥇';
                  if (pos === 2) posEmoji = '🥈';
                  if (pos === 3) posEmoji = '🥉';

                  return (
                    <View key={ru.id || idx} style={[styles.rankingCard, isMe && styles.rankingCardMe]}>
                      <Text style={styles.rankPosition}>
                        {posEmoji ? posEmoji : `${pos}°`}
                      </Text>
                      <View style={styles.rankAvatar}>
                        <Text style={styles.rankAvatarChar}>{ru.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.rankDetails}>
                        <Text style={[styles.rankName, isMe && styles.rankNameMe]}>
                          {ru.name} {isMe && '(Você)'}
                        </Text>
                        <Text style={styles.rankStreak}>🔥 {ru.streak} dias de ofensiva</Text>
                      </View>
                      <Text style={styles.rankXp}>{ru.weeklyXp} XP</Text>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ABA AJUSTES */}
          {activeSubTab === 'settings' && (
            <View style={styles.subTab}>
              <Text style={styles.subTabTitle}>Ajustes do SRS (Repetição Espaçada)</Text>
              
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Tempo mínimo de cooldown (minutos)</Text>
                <TextInput
                  style={styles.settingInput}
                  keyboardType="numeric"
                  value={minCooldown}
                  onChangeText={setMinCooldown}
                />
              </View>

              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Tempo máximo de cooldown (minutos)</Text>
                <TextInput
                  style={styles.settingInput}
                  keyboardType="numeric"
                  value={maxCooldown}
                  onChangeText={setMaxCooldown}
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingRowLabel}>Efeitos sonoros ativados</Text>
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#e5e5e5', true: '#58cc02' }}
                  thumbColor="#fff"
                />
              </View>

              <TouchableOpacity
                style={styles.saveSettingsBtn}
                onPress={handleSaveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveSettingsBtnText}>Salvar Ajustes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 5. Ação de Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Sair da Conta</Text>
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f7f7f7',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#58cc02',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarChar: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileInfo: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginRight: 8,
  },
  planBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadge: {
    backgroundColor: '#ff9600',
    color: '#fff',
  },
  freeBadge: {
    backgroundColor: '#e5e5e5',
    color: '#777777',
  },
  profileEmail: {
    fontSize: 14,
    color: '#777777',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    paddingVertical: 12,
    borderRadius: 16,
    marginHorizontal: 4,
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  statLabel: {
    fontSize: 12,
    color: '#777777',
    marginTop: 4,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#e5e5e5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
  },
  tabButtonText: {
    color: '#777777',
    fontWeight: '500',
    fontSize: 14,
  },
  tabButtonTextActive: {
    color: '#1cb0f6',
    fontWeight: 'bold',
  },
  tabContentContainer: {
    backgroundColor: 'transparent',
    marginBottom: 30,
  },
  subTabLoading: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  subTab: {
    backgroundColor: 'transparent',
  },
  subTabTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 12,
  },
  emptySocialText: {
    color: '#777777',
    fontSize: 14,
    marginVertical: 10,
  },
  addFriendRow: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  addFriendInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#3c3c3c',
    fontSize: 15,
    marginRight: 10,
  },
  addFriendBtn: {
    backgroundColor: '#1cb0f6',
    borderBottomWidth: 3,
    borderBottomColor: '#189cdb',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarChar: {
    color: '#3c3c3c',
    fontWeight: 'bold',
    fontSize: 18,
  },
  friendDetails: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  friendName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  friendEmail: {
    fontSize: 12,
    color: '#777777',
    marginTop: 2,
  },
  pendingTag: {
    fontSize: 10,
    color: '#ff9600',
    backgroundColor: 'rgba(255, 150, 0, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    fontWeight: 'bold',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  acceptBtn: {
    backgroundColor: '#58cc02',
    borderBottomWidth: 3,
    borderBottomColor: '#46a302',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 6,
  },
  acceptBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  removeBtn: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  removeBtnText: {
    color: '#ff4b4b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rankingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  rankingCardMe: {
    borderColor: '#58cc02',
    backgroundColor: '#d7ffb8',
  },
  rankPosition: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#777777',
    width: 32,
    textAlign: 'center',
  },
  rankAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankAvatarChar: {
    color: '#3c3c3c',
    fontWeight: 'bold',
    fontSize: 16,
  },
  rankDetails: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  rankName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  rankNameMe: {
    color: '#3c3c3c',
  },
  rankStreak: {
    fontSize: 11,
    color: '#ff9600',
    marginTop: 2,
  },
  rankXp: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#58cc02',
  },
  settingGroup: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  settingLabel: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 6,
  },
  settingInput: {
    height: 48,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#3c3c3c',
    fontSize: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginVertical: 10,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e5e5',
  },
  settingRowLabel: {
    color: '#3c3c3c',
    fontSize: 15,
  },
  saveSettingsBtn: {
    backgroundColor: '#58cc02',
    borderBottomWidth: 4,
    borderBottomColor: '#46a302',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveSettingsBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#ff4b4b',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  logoutButtonText: {
    color: '#ff4b4b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
