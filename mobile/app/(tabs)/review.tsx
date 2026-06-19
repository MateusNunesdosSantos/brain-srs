import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { Text, View } from '../../components/Themed';
import { useAppState } from '../../context/StateContext';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Question, Alternative } from '../../services/types';

export default function ReviewScreen() {
  const { state, dispatchAction } = useAppState();
  const { user } = useAuth();

  const [sessionActive, setSessionActive] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);
  
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string | null>(null);
  const [answerConfirmed, setAnswerConfirmed] = useState(false);
  const [isCurrentCorrect, setIsCurrentCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  const [installations, setInstallations] = useState<any[]>([]);

  const now = Date.now();

  // Carrega as instalações do catálogo para verificar o filtro de revisão (includeInReview)
  useEffect(() => {
    const loadInstallations = async () => {
      try {
        const instData = await apiRequest('/api/catalog/installations');
        setInstallations(instData.installations || []);
      } catch (e) {
        console.error('Erro ao buscar installations no review:', e);
      }
    };
    if (user) {
      loadInstallations();
    }
  }, [user]);

  // Recupera sessão de revisão ativa se houver no estado do backend
  useEffect(() => {
    if (state?.activeReviewSession && !sessionActive && !sessionFinished && !reviewSessionId) {
      const session = state.activeReviewSession;
      const answered = new Set(session.answeredQuestionIds);
      const firstUnansweredIndex = session.questionIds.findIndex(
        (questionId) => !answered.has(questionId)
      );
      
      setReviewQueue(session.questionIds);
      setReviewIndex(firstUnansweredIndex !== -1 ? firstUnansweredIndex : 0);
      setReviewSessionId(session.id);
      setSessionActive(true);
      setCorrectCount(0);
    }
  }, [state?.activeReviewSession, sessionActive, sessionFinished, reviewSessionId]);

  // Avanço automático após 3 segundos da resposta ser confirmada (estilo web)
  useEffect(() => {
    if (!answerConfirmed) return;
    const timer = setTimeout(() => {
      nextQuestion();
    }, 3000);
    return () => clearTimeout(timer);
  }, [answerConfirmed, reviewIndex, reviewQueue]);

  const isActiveCooldown = (questionId: string) => {
    if (!state?.cooldown) return false;
    return state.cooldown.some(
      (item) =>
        item.questionId === questionId &&
        new Date(item.availableAt).getTime() > now
    );
  };

  const isQuestionIncludedInReview = (question: Question) => {
    if (!question.sourceCatalogPackId) return true;
    if (!user || user.plan !== 'pro') return false;
    const inst = installations.find((i) => i.packId === question.sourceCatalogPackId);
    return Boolean(inst?.includeInReview);
  };

  // Filtra as perguntas devidas para revisão de acordo com o algoritmo do SRS e installations
  const dueQuestions = useMemo(() => {
    if (!state?.questions || !state?.progress) return [];
    return state.questions.filter((question) => {
      const progress = state.progress[question.id];
      if (!progress || !isQuestionIncludedInReview(question)) return false;

      return (
        new Date(progress.nextReview).getTime() <= now &&
        !isActiveCooldown(question.id)
      );
    });
  }, [state, user, installations, now]);

  const startReviewSession = async () => {
    if (dueQuestions.length === 0) return;
    setSubmittingAction(true);

    const questionIds = dueQuestions.map((q) => q.id);
    try {
      const result = await dispatchAction({
        type: 'startReview',
        questionIds,
      });

      if (result.reviewSessionId) {
        setReviewQueue(result.questionIds || questionIds);
        setReviewSessionId(result.reviewSessionId);
        setReviewIndex(0);
        setSelectedAlternativeId(null);
        setAnswerConfirmed(false);
        setIsCurrentCorrect(false);
        setCorrectCount(0);
        setSessionFinished(false);
        setSessionActive(true);
        setHintOpen(false);
      }
    } catch (e) {
      console.error('Erro ao iniciar revisao:', e);
    } finally {
      setSubmittingAction(false);
    }
  };

  const currentQuestionId = reviewQueue[reviewIndex];
  const currentQuestion: Question | null = state && currentQuestionId
    ? state.questions.find((q) => q.id === currentQuestionId) || null
    : null;

  // Embaralha alternativas localmente quando muda a pergunta
  const [displayedAlternatives, setDisplayedAlternatives] = useState<Alternative[]>([]);
  useEffect(() => {
    if (currentQuestion) {
      const shuffled = [...currentQuestion.alternatives].sort(() => Math.random() - 0.5);
      setDisplayedAlternatives(shuffled);
    } else {
      setDisplayedAlternatives([]);
    }
  }, [currentQuestionId]);

  const handleSelectAlternative = async (alternativeId: string) => {
    if (answerConfirmed || submittingAction || !currentQuestion || !reviewSessionId) return;
    
    setSelectedAlternativeId(alternativeId);
    
    const selectedAlt = currentQuestion.alternatives.find(
      (a) => a.id === alternativeId
    );
    const isCorrect = selectedAlt?.isCorrect || false;
    setIsCurrentCorrect(isCorrect);
    
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
    }

    setSubmittingAction(true);
    try {
      await dispatchAction({
        type: 'answer',
        reviewSessionId,
        requestId: Math.random().toString(36).substring(7),
        questionId: currentQuestion.id,
        selectedAlternativeId: alternativeId,
        responseTimeSeconds: 5,
      });
      setAnswerConfirmed(true);
    } catch (e) {
      console.error('Erro ao salvar resposta:', e);
      setSelectedAlternativeId(null);
    } finally {
      setSubmittingAction(false);
    }
  };

  const nextQuestion = async () => {
    if (reviewIndex + 1 < reviewQueue.length) {
      setReviewIndex((prev) => prev + 1);
      setSelectedAlternativeId(null);
      setAnswerConfirmed(false);
      setIsCurrentCorrect(false);
      setHintOpen(false);
    } else {
      await finishReviewSession();
    }
  };

  const finishReviewSession = async () => {
    if (!reviewSessionId) return;
    setSubmittingAction(true);
    try {
      // Conclui e commita a sessão no banco de dados
      await dispatchAction({
        type: 'completeReview',
        reviewSessionId,
      });
      setSessionFinished(true);
    } catch (e) {
      console.error('Erro ao concluir sessao:', e);
      setSessionFinished(true);
    } finally {
      setSubmittingAction(false);
    }
  };

  if (!state) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color="#58cc02" />
        <Text style={styles.loadingText}>Carregando revisões...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {dueQuestions.length === 0 ? (
        <View style={styles.upToDateContainer}>
          <Text style={styles.upToDateEmoji}>🎉</Text>
          <Text style={styles.upToDateTitle}>Você está em dia!</Text>
          <Text style={styles.upToDateSubtitle}>Nenhum cartão pendente de revisão para hoje.</Text>
        </View>
      ) : (
        <View style={styles.startContainer}>
          <View style={styles.cardInfo}>
            <Text style={styles.dueNumber}>{dueQuestions.length}</Text>
            <Text style={styles.dueLabel}>
              {dueQuestions.length === 1 ? 'cartão pendente' : 'cartões pendentes'}
            </Text>
            <Text style={styles.dueDesc}>
              Revisar fortalece as conexões neuronais e fixa o conhecimento a longo prazo.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={startReviewSession}
            disabled={submittingAction}
          >
            {submittingAction ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startButtonText}>Iniciar Sessão de Revisão</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={sessionActive} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom', 'left', 'right']}>
          {currentQuestion && !sessionFinished ? (
            <View style={styles.modalContent}>
              {/* Barra de progresso */}
              <View style={styles.progressBarRow}>
                <TouchableOpacity
                  onPress={() => {
                    setSessionActive(false);
                    setSessionFinished(false);
                  }}
                  style={styles.closeButtonIcon}
                >
                  <FontAwesome name="times" size={24} color="#afafaf" />
                </TouchableOpacity>

                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${((reviewIndex + (selectedAlternativeId ? 1 : 0)) / reviewQueue.length) * 100}%` }
                    ]}
                  />
                </View>

                <View style={styles.progressCounter}>
                  <FontAwesome name="fire" size={18} color="#ff9600" />
                  <Text style={styles.progressCountText}>
                    {Math.min(reviewIndex + 1, reviewQueue.length)}/{reviewQueue.length}
                  </Text>
                </View>
              </View>

              <ScrollView
                contentContainerStyle={[
                  styles.questionScroll,
                  selectedAlternativeId ? { paddingBottom: 160 } : { paddingBottom: 30 }
                ]}
              >
                {/* Meta Tags */}
                <View style={styles.metaRow}>
                  <View style={styles.subjectTag}>
                    <Text style={styles.subjectTagText}>
                      {state.subjects.find((s) => s.id === currentQuestion.subjectId)?.name || 'Matéria'}
                    </Text>
                  </View>
                  <View style={styles.learningTag}>
                    <Text style={styles.learningTagText}>Revisão Espaçada</Text>
                  </View>
                </View>

                <Text style={styles.questionLabel}>Selecione a resposta correta</Text>
                <Text style={styles.questionPrompt}>{currentQuestion.prompt}</Text>
                
                {/* Hint Button */}
                {currentQuestion.hint ? (
                  <View style={styles.hintContainer}>
                    <TouchableOpacity
                      style={styles.hintToggleBtn}
                      onPress={() => setHintOpen(!hintOpen)}
                    >
                      <FontAwesome name="lightbulb-o" size={16} color="#ffc800" />
                      <Text style={styles.hintToggleBtnText}>
                        {hintOpen ? 'Ocultar dica' : 'Mostrar dica'}
                      </Text>
                    </TouchableOpacity>
                    {hintOpen && (
                      <View style={styles.hintTextBubble}>
                        <Text style={styles.hintText}>{currentQuestion.hint}</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Alternatives List */}
                <View style={styles.alternativesContainer}>
                  {displayedAlternatives.map((alt, altIndex) => {
                    const isSelected = selectedAlternativeId === alt.id;
                    const isCorrect = alt.isCorrect;

                    let cardStyle: any = styles.altCard;
                    let textStyle = styles.altText;

                    if (isSelected) {
                      cardStyle = { ...cardStyle, ...styles.altCardSelected };
                    }

                    if (answerConfirmed) {
                      if (isCorrect) {
                        cardStyle = { ...cardStyle, ...styles.altCardCorrect };
                        textStyle = { ...textStyle, ...styles.altTextCorrect };
                      } else if (isSelected) {
                        cardStyle = { ...cardStyle, ...styles.altCardIncorrect };
                        textStyle = { ...textStyle, ...styles.altTextIncorrect };
                      } else {
                        cardStyle = { ...cardStyle, opacity: 0.6 };
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={alt.id}
                        style={cardStyle}
                        onPress={() => handleSelectAlternative(alt.id)}
                        disabled={answerConfirmed || submittingAction}
                      >
                        <View
                          style={[
                            styles.altLabelContainer,
                            { borderColor: isSelected ? '#1cb0f6' : answerConfirmed && isCorrect ? '#58cc02' : answerConfirmed && isSelected && !isCorrect ? '#ff4b4b' : '#777777' }
                          ]}
                        >
                          <Text
                            style={[
                              styles.altLabelText,
                              { color: isSelected ? '#1cb0f6' : answerConfirmed && isCorrect ? '#58cc02' : answerConfirmed && isSelected && !isCorrect ? '#ff4b4b' : '#777777' }
                            ]}
                          >
                            {alt.label}
                          </Text>
                        </View>
                        <Text style={textStyle}>{alt.text}</Text>
                        
                        {answerConfirmed && isCorrect && (
                          <FontAwesome name="check-circle" size={22} color="#58cc02" style={styles.resultIcon} />
                        )}
                        {answerConfirmed && isSelected && !isCorrect && (
                          <FontAwesome name="times-circle" size={22} color="#ff4b4b" style={styles.resultIcon} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Rationale if answered */}
                {answerConfirmed && selectedAlternativeId && (
                  <View style={styles.rationaleContainer}>
                    <Text style={styles.rationaleTitle}>Explicação / Justificativa:</Text>
                    <Text style={styles.rationaleText}>
                      {currentQuestion.alternatives.find((alt) => alt.id === selectedAlternativeId)?.rationale || 'Sem justificativa.'}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Banner do feedback */}
              {selectedAlternativeId && (
                <View
                  style={[
                    styles.feedbackBanner,
                    answerConfirmed
                      ? isCurrentCorrect
                        ? styles.feedbackBannerCorrect
                        : styles.feedbackBannerIncorrect
                      : styles.feedbackBannerPending
                  ]}
                >
                  <View style={styles.feedbackBannerInner}>
                    {answerConfirmed ? (
                      <View style={styles.feedbackInfo}>
                        <View style={styles.feedbackIconCircle}>
                          <FontAwesome
                            name={isCurrentCorrect ? "check" : "times"}
                            size={20}
                            color={isCurrentCorrect ? "#58cc02" : "#ff4b4b"}
                          />
                        </View>
                        <View style={styles.feedbackTexts}>
                          <Text
                            style={[
                              styles.feedbackStatusText,
                              { color: isCurrentCorrect ? "#46a302" : "#ea2b2b" }
                            ]}
                          >
                            {isCurrentCorrect ? 'Muito bem!' : 'Quase lá!'}
                          </Text>
                          <Text
                            style={[
                              styles.feedbackSubstatusText,
                              { color: isCurrentCorrect ? "#6da83e" : "#cf5d5d" }
                            ]}
                          >
                            {isCurrentCorrect
                              ? 'Você fortaleceu esta memória.'
                              : 'Esta questão voltará após o cooldown para reforço.'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.feedbackInfo}>
                        <ActivityIndicator size="small" color="#58cc02" />
                        <Text style={styles.feedbackLoadingText}>Enviando resposta...</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.continueButton,
                        !answerConfirmed && styles.continueButtonDisabled,
                        answerConfirmed && isCurrentCorrect ? styles.continueButtonCorrect : styles.continueButtonIncorrect
                      ]}
                      onPress={nextQuestion}
                      disabled={!answerConfirmed}
                    >
                      <Text style={styles.continueButtonText}>Continuar</Text>
                      <FontAwesome name="arrow-right" size={14} color="#ffffff" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : submittingAction ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#58cc02" />
              <Text style={styles.loadingText}>Concluindo sessão no servidor...</Text>
            </View>
          ) : (
            <View style={styles.congratsContainer}>
              <Text style={styles.congratsEmoji}>🏆</Text>
              <Text style={styles.congratsTitle}>Revisão Finalizada!</Text>
              <Text style={styles.congratsSubtitle}>Você completou {reviewQueue.length} revisões agendadas</Text>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>
                  Corretas: <Text style={styles.greenText}>{correctCount} de {reviewQueue.length}</Text>
                </Text>
                <Text style={styles.summaryText}>
                  XP Ganhos: <Text style={styles.orangeText}>+{correctCount * 10} XP</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setSessionActive(false);
                  setSessionFinished(false);
                }}
              >
                <Text style={styles.closeButtonText}>Concluir</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
  },
  loadingText: {
    color: '#777777',
    marginTop: 12,
    fontSize: 16,
    fontWeight: 'bold',
  },
  upToDateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  upToDateEmoji: {
    fontSize: 72,
    marginBottom: 20,
  },
  upToDateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 8,
  },
  upToDateSubtitle: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
  },
  startContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  dueNumber: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#58cc02',
  },
  dueLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 16,
  },
  dueDesc: {
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 18,
  },
  startButton: {
    backgroundColor: '#58cc02',
    height: 52,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#46a302',
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  modalContent: {
    flex: 1,
  },
  progressBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#ffffff',
  },
  closeButtonIcon: {
    padding: 6,
  },
  progressBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#e5e5e5',
    borderRadius: 5,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#58cc02',
    borderRadius: 5,
  },
  progressCounter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ff9600',
    marginLeft: 4,
  },
  questionScroll: {
    padding: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  subjectTag: {
    backgroundColor: '#e9f8dd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  subjectTagText: {
    color: '#58a700',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  learningTag: {
    backgroundColor: '#f3f3f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  learningTagText: {
    color: '#8c8c8c',
    fontSize: 11,
    fontWeight: 'bold',
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#777777',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  questionPrompt: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3c3c3c',
    lineHeight: 28,
    marginBottom: 20,
  },
  hintContainer: {
    marginBottom: 20,
  },
  hintToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hintToggleBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#777777',
    marginLeft: 6,
  },
  hintTextBubble: {
    marginTop: 8,
    backgroundColor: '#fffbea',
    borderWidth: 2,
    borderColor: '#ffe58a',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hintText: {
    color: '#806d28',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  alternativesContainer: {
    backgroundColor: 'transparent',
    marginTop: 10,
  },
  altCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  altCardSelected: {
    borderColor: '#1cb0f6',
  },
  altCardCorrect: {
    borderColor: '#58cc02',
    backgroundColor: '#d7ffb8',
  },
  altCardIncorrect: {
    borderColor: '#ff4b4b',
    backgroundColor: '#ffdfe0',
  },
  altLabelContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  altLabelText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  altText: {
    color: '#3c3c3c',
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  altTextCorrect: {
    color: '#46a302',
    fontWeight: 'bold',
  },
  altTextIncorrect: {
    color: '#ff4b4b',
    fontWeight: 'bold',
  },
  resultIcon: {
    marginLeft: 'auto',
  },
  rationaleContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  rationaleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#777777',
    marginBottom: 4,
  },
  rationaleText: {
    fontSize: 13,
    color: '#3c3c3c',
    lineHeight: 18,
  },
  feedbackBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 2,
    padding: 16,
    zIndex: 99,
  },
  feedbackBannerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  feedbackIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  feedbackTexts: {
    flex: 1,
  },
  feedbackStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedbackSubstatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  feedbackLoadingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#777777',
    marginLeft: 8,
  },
  feedbackBannerCorrect: {
    backgroundColor: '#d7ffb8',
    borderColor: '#a5ed6e',
  },
  feedbackBannerIncorrect: {
    backgroundColor: '#ffdfe0',
    borderColor: '#ffc1c1',
  },
  feedbackBannerPending: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderBottomWidth: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
    borderBottomColor: '#aaa',
  },
  continueButtonCorrect: {
    backgroundColor: '#58cc02',
    borderBottomColor: '#46a302',
  },
  continueButtonIncorrect: {
    backgroundColor: '#ff4b4b',
    borderBottomColor: '#d83333',
  },
  continueButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  congratsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f7f7f7',
  },
  congratsEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  congratsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  congratsSubtitle: {
    fontSize: 14,
    color: '#777777',
    marginTop: 6,
    textAlign: 'center',
  },
  summaryBox: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginVertical: 30,
  },
  summaryText: {
    fontSize: 16,
    color: '#3c3c3c',
    marginVertical: 4,
  },
  greenText: {
    color: '#58cc02',
    fontWeight: 'bold',
  },
  orangeText: {
    color: '#ff9600',
    fontWeight: 'bold',
  },
  closeButton: {
    height: 52,
    backgroundColor: '#58cc02',
    borderBottomWidth: 4,
    borderBottomColor: '#46a302',
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
