import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { Text, View } from '../../components/Themed';
import { apiRequest, getBaseUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/StateContext';

type CatalogPack = {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  level: string;
  version: number;
  installed: boolean;
  updateAvailable: boolean;
  requiredPlan: 'free' | 'pro';
  subjectCount: number;
  questionCount: number;
};

type CatalogGoal = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  packs: CatalogPack[];
};

type CatalogInstallation = {
  id: string;
  packId: string;
  version: number;
  includeInReview: boolean;
};

export default function CatalogScreen() {
  const { user, logout } = useAuth();
  const { fetchState } = useAppState();
  
  const [goals, setGoals] = useState<CatalogGoal[]>([]);
  const [installations, setInstallations] = useState<CatalogInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'disponiveis' | 'minhas-trilhas'>('disponiveis');
  const [searchQuery, setSearchQuery] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const [goalsData, instData] = await Promise.all([
        apiRequest('/api/catalog'),
        apiRequest('/api/catalog/installations'),
      ]);
      setGoals(goalsData.goals || []);
      setInstallations(instData.installations || []);
    } catch (e: any) {
      console.error('Erro ao buscar catalogo:', e);
      setError(e?.error || e?.message || 'Falha ao carregar catálogo. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Recarrega sempre que o usuário logado estiver disponível
  useEffect(() => {
    if (user) {
      loadCatalog();
    }
  }, [user]);

  const handleInstall = async (pack: CatalogPack) => {
    if (pack.requiredPlan === 'pro' && user?.plan !== 'pro') {
      Alert.alert('Plano Pro Exigido', 'Este pacote está disponível apenas para assinantes do plano Pro.');
      return;
    }

    setActionLoading(pack.id);
    try {
      await apiRequest('/api/catalog/install', {
        method: 'POST',
        body: JSON.stringify({
          packIds: [pack.id],
          includeInReview: true,
        }),
      });
      await Promise.all([loadCatalog(), fetchState()]);
      Alert.alert('Sucesso', `Pacote "${pack.name}" instalado com sucesso!`);
    } catch (e: any) {
      Alert.alert('Erro', e?.error || 'Erro ao instalar pacote.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (pack: CatalogPack) => {
    const inst = installations.find((i) => i.packId === pack.id);
    if (!inst) return;

    Alert.alert(
      'Remover Pacote',
      `Tem certeza que deseja desinstalar "${pack.name}"? Todo o progresso deste pacote será perdido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(pack.id);
            try {
              await apiRequest(`/api/catalog/installations/${inst.id}`, {
                method: 'DELETE',
                body: JSON.stringify({ confirmation: 'REMOVER' }),
              });
              await Promise.all([loadCatalog(), fetchState()]);
            } catch (e: any) {
              Alert.alert('Erro', e?.error || 'Erro ao remover pacote.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handlePreview = async (packId: string) => {
    setPreviewLoading(packId);
    try {
      const response = await apiRequest(`/api/catalog/packs/${packId}`);
      setPreview(response.pack || null);
    } catch (e: any) {
      Alert.alert('Erro', e?.error || e?.message || 'Erro ao carregar prévia do pacote.');
    } finally {
      setPreviewLoading(null);
    }
  };

  const isPackInstalled = (packId: string) => {
    return installations.some((i) => i.packId === packId);
  };

  // Filtra os packs de acordo com a aba e busca
  const getFilteredPacks = (goalPacks: CatalogPack[]) => {
    return goalPacks.filter((pack) => {
      const isInstalled = isPackInstalled(pack.id);
      const matchesTab = activeTab === 'disponiveis' ? !isInstalled : isInstalled;
      const matchesSearch = !searchQuery || 
        pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pack.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesTab && matchesSearch;
    });
  };

  const hasPacksInGoal = (goal: CatalogGoal) => {
    return getFilteredPacks(goal.packs).length > 0;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color="#58cc02" />
        <Text style={styles.loadingText}>Carregando catálogo...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Falha na conexão</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubText}>Servidor: {getBaseUrl()}</Text>
        
        <TouchableOpacity style={styles.retryButton} onPress={loadCatalog}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Sair da Conta</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Contagem de trilhas instaladas
  const installedCount = installations.length;

  return (
    <SafeAreaView style={styles.rootContainer} edges={['top', 'left', 'right']}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catálogo de Conteúdos</Text>
        <Text style={styles.headerSubtitle}>Selecione cadernos, matérias ou questões oficiais para estudar</Text>
      </View>

      {/* Tabs Seletor estilo Web */}
      <View style={styles.tabSelectorContainer}>
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'disponiveis' && styles.tabButtonActive]}
            onPress={() => setActiveTab('disponiveis')}
          >
            <Text style={[styles.tabButtonText, activeTab === 'disponiveis' && styles.tabButtonTextActive]}>
              Disponíveis
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'minhas-trilhas' && styles.tabButtonActive]}
            onPress={() => setActiveTab('minhas-trilhas')}
          >
            <View style={styles.tabButtonContent}>
              <Text style={[styles.tabButtonText, activeTab === 'minhas-trilhas' && styles.tabButtonTextActive]}>
                Minhas Trilhas
              </Text>
              {installedCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{installedCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Busca (Apenas na aba Disponíveis) */}
      {activeTab === 'disponiveis' && (
        <View style={styles.searchContainer}>
          <FontAwesome name="search" size={16} color="#8490a0" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar trilha ou assunto..."
            placeholderTextColor="#8490a0"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      {/* Scroll de Conteúdo */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {goals.filter(hasPacksInGoal).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>Nenhuma trilha encontrada</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'disponiveis'
                ? 'Nenhum conteúdo disponível atende ao filtro de busca.'
                : 'Adicione trilhas na aba "Disponíveis" para vê-las aqui.'}
            </Text>
            {activeTab === 'minhas-trilhas' && (
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => setActiveTab('disponiveis')}
              >
                <Text style={styles.emptyActionBtnText}>Ver trilhas disponíveis</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          goals.map((goal) => {
            const filteredPacks = getFilteredPacks(goal.packs);
            if (filteredPacks.length === 0) return null;

            return (
              <View key={goal.id} style={styles.goalSection}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalTitle}>
                    {goal.name}
                  </Text>
                </View>
                <Text style={styles.goalDesc}>{goal.description}</Text>

                <View style={styles.packGrid}>
                  {filteredPacks.map((pack) => {
                    const installed = isPackInstalled(pack.id);
                    const isPro = pack.requiredPlan === 'pro';
                    const isPerforming = actionLoading === pack.id;

                    return (
                      <View key={pack.id} style={styles.packCard}>
                        <View style={styles.packCardHeaderRow}>
                          {/* Colored Square with icon (Estilo Web) */}
                          <View style={[styles.packIconWrapper, { backgroundColor: pack.color || '#58cc02' }]}>
                            <FontAwesome name="book" size={18} color="#ffffff" />
                          </View>
                          
                          <View style={styles.packInfo}>
                            <View style={styles.packNameRow}>
                              <Text style={styles.packName} numberOfLines={2}>{pack.name}</Text>
                              {isPro && (
                                <View style={styles.proTag}>
                                  <Text style={styles.proTagText}>PRO</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.packMetaRow}>
                              <Text style={styles.packMetaText}>
                                {pack.subjectCount} temas · {pack.questionCount} questões
                              </Text>
                              <View style={styles.goalBadge}>
                                <Text style={styles.goalBadgeText}>{goal.name}</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <Text style={styles.packDesc}>{pack.description}</Text>
                        
                        <View style={styles.packFooter}>
                          <Text style={styles.levelText}>{pack.level.toUpperCase()}</Text>
                        </View>

                        {/* Action Buttons Row - Estilo Web */}
                        <View style={styles.cardActionsRow}>
                          <TouchableOpacity
                            style={styles.previewButton}
                            onPress={() => handlePreview(pack.id)}
                            disabled={previewLoading === pack.id || isPerforming}
                          >
                            {previewLoading === pack.id ? (
                              <ActivityIndicator size="small" color="#1cb0f6" />
                            ) : (
                              <Text style={styles.previewButtonText}>Ver prévia</Text>
                            )}
                          </TouchableOpacity>

                          {installed ? (
                            <TouchableOpacity
                              style={styles.installedButton}
                              onPress={() => handleRemove(pack)}
                              disabled={isPerforming || previewLoading === pack.id}
                            >
                              {isPerforming ? (
                                <ActivityIndicator size="small" color="#ff4b4b" />
                              ) : (
                                <Text style={styles.installedButtonText}>Remover</Text>
                              )}
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.installButton}
                              onPress={() => handleInstall(pack)}
                              disabled={isPerforming || previewLoading === pack.id}
                            >
                              {isPerforming ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.installButtonText}>Instalar</Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal de Prévia estilo Web */}
      <Modal
        visible={preview !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPreview(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{preview?.name}</Text>
                <Text style={styles.modalSubtitle}>{preview?.description}</Text>
              </View>
              <TouchableOpacity style={styles.closeModalButton} onPress={() => setPreview(null)}>
                <FontAwesome name="times" size={20} color="#7d8797" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>Matérias e Questões incluídas:</Text>
              {preview?.subjects.map((subject: any) => (
                <View key={subject.id} style={styles.previewSubjectCard}>
                  <View style={styles.previewSubjectHeader}>
                    <View style={[styles.subjectColorDot, { backgroundColor: subject.color || '#1cb0f6' }]} />
                    <Text style={styles.previewSubjectName}>{subject.name}</Text>
                  </View>
                  <View style={styles.previewQuestionsList}>
                    {subject.questions.map((question: any, idx: number) => (
                      <Text key={question.id} style={styles.previewQuestionPrompt}>
                        {idx + 1}. {question.prompt}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalFooterButton} onPress={() => setPreview(null)}>
              <Text style={styles.modalFooterButtonText}>Fechar Prévia</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    padding: 24,
  },
  loadingText: {
    color: '#777777',
    marginTop: 12,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#ff4b4b',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 6,
    lineHeight: 20,
  },
  errorSubText: {
    fontSize: 11,
    color: '#777777',
    marginBottom: 28,
  },
  retryButton: {
    backgroundColor: '#58cc02',
    borderBottomWidth: 4,
    borderBottomColor: '#46a302',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '90%',
    alignItems: 'center',
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: '#ff4b4b',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '90%',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ff4b4b',
    fontWeight: 'bold',
    fontSize: 15,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#777777',
    marginTop: 4,
    lineHeight: 18,
  },
  tabSelectorContainer: {
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#e5e5e5',
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
  },
  tabButtonText: {
    color: '#777777',
    fontWeight: 'bold',
    fontSize: 13,
  },
  tabButtonTextActive: {
    color: '#3c3c3c',
  },
  tabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  badge: {
    backgroundColor: '#58cc02',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#3c3c3c',
    fontSize: 13,
    fontWeight: '600',
    height: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 6,
  },
  emptyText: {
    color: '#777777',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#58cc02',
    borderBottomWidth: 3,
    borderBottomColor: '#46a302',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  goalSection: {
    marginTop: 16,
    backgroundColor: 'transparent',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  goalDesc: {
    fontSize: 13,
    color: '#777777',
    marginTop: 2,
    marginBottom: 12,
  },
  packGrid: {
    backgroundColor: 'transparent',
  },
  packCard: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    marginBottom: 16,
    padding: 16,
  },
  packCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  packIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  packInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  packNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  packName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#3c3c3c',
    flex: 1,
  },
  proTag: {
    backgroundColor: '#ff9600',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  proTagText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  packMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  packMetaText: {
    color: '#777777',
    fontSize: 11,
    fontWeight: 'bold',
  },
  goalBadge: {
    backgroundColor: '#f0f3f5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  goalBadgeText: {
    color: '#7d8797',
    fontSize: 9,
    fontWeight: 'bold',
  },
  packDesc: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 18,
    marginBottom: 16,
  },
  packFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  levelText: {
    color: '#1cb0f6',
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: 'rgba(28, 176, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  previewButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: '#dfe5e9',
    borderRadius: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#1cb0f6',
    fontWeight: 'bold',
    fontSize: 13,
  },
  installButton: {
    flex: 1,
    backgroundColor: '#58cc02',
    borderBottomWidth: 3,
    borderBottomColor: '#46a302',
    borderRadius: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  installButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  installedButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderBottomWidth: 3,
    borderColor: '#ff4b4b',
    borderRadius: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  installedButtonText: {
    color: '#ff4b4b',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 56, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: '#e5e5e5',
    overflow: 'hidden',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#edf0f3',
    paddingBottom: 15,
    marginBottom: 15,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#777777',
    marginTop: 4,
    lineHeight: 16,
  },
  closeModalButton: {
    padding: 4,
    backgroundColor: 'transparent',
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 12,
  },
  previewSubjectCard: {
    backgroundColor: '#f7f7f7',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  previewSubjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  subjectColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  previewSubjectName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  previewQuestionsList: {
    paddingLeft: 10,
    backgroundColor: 'transparent',
  },
  previewQuestionPrompt: {
    fontSize: 12,
    color: '#555555',
    marginTop: 4,
    lineHeight: 16,
  },
  modalFooterButton: {
    backgroundColor: '#58cc02',
    borderBottomWidth: 4,
    borderBottomColor: '#46a302',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  modalFooterButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
