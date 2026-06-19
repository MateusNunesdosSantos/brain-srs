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
import { Subject, Question, Alternative } from '../../services/types';

export default function StudyScreen() {
  const { state, fetchState } = useAppState();
  const { user } = useAuth();
  
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [lessonActive, setLessonActive] = useState(false);
  
  // Fila local de perguntas (comportamento web: perguntas erradas vão para o fim da fila)
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [missedQuestionIds, setMissedQuestionIds] = useState<Set<string>>(new Set());
  
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string | null>(null);
  const [answerConfirmed, setAnswerConfirmed] = useState(false);
  const [isCurrentCorrect, setIsCurrentCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [lessonFinished, setLessonFinished] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);

  if (!state) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color="#58cc02" />
        <Text style={styles.loadingText}>Carregando matérias...</Text>
      </SafeAreaView>
    );
  }

  // Filtra matérias que possuem perguntas
  const activeSubjects = state.subjects.filter((subject) => {
    return state.questions.some((q) => q.subjectId === subject.id);
  });

  const getNotebookName = (notebookId: string) => {
    return state.notebooks.find((n) => n.id === notebookId)?.name || 'Caderno';
  };

  const getSubjectQuestions = (subjectId: string) => {
    return state.questions.filter((q) => q.subjectId === subjectId);
  };

  const startLesson = (subject: Subject) => {
    const questions = getSubjectQuestions(subject.id);
    if (questions.length === 0) return;

    setSelectedSubject(subject);
    setActiveQuestions([...questions]); // Copia as perguntas para a fila local
    setMissedQuestionIds(new Set());
    setSelectedAlternativeId(null);
    setAnswerConfirmed(false);
    setIsCurrentCorrect(false);
    setCorrectCount(0);
    setLessonFinished(false);
    setLessonActive(true);
    setHintOpen(false);
  };

  const currentQuestion = activeQuestions[0] ?? null;
  const totalQuestions = selectedSubject ? getSubjectQuestions(selectedSubject.id).length : 0;

  // Embaralha alternativas localmente quando muda a pergunta
  const [displayedAlternatives, setDisplayedAlternatives] = useState<Alternative[]>([]);
  useEffect(() => {
    if (currentQuestion) {
      const shuffled = [...currentQuestion.alternatives].sort(() => Math.random() - 0.5);
      setDisplayedAlternatives(shuffled);
    } else {
      setDisplayedAlternatives([]);
    }
  }, [currentQuestion?.id]);

  // Avanço automático após 3 segundos da resposta ser confirmada (estilo web)
  useEffect(() => {
    if (!answerConfirmed) return;
    const timer = setTimeout(() => {
      nextQuestion();
    }, 3000);
    return () => clearTimeout(timer);
  }, [answerConfirmed, activeQuestions]);

  const handleSelectAlternative = (altId: string) => {
    if (answerConfirmed || !currentQuestion) return;
    setSelectedAlternativeId(altId);

    const selectedAlt = currentQuestion.alternatives.find((alt) => alt.id === altId);
    if (!selectedAlt) return;

    const correct = selectedAlt.isCorrect;
    setIsCurrentCorrect(correct);
    setAnswerConfirmed(true);

    if (correct) {
      // Só soma ao total de corretas se não tiver errado antes
      if (!missedQuestionIds.has(currentQuestion.id)) {
        setCorrectCount((prev) => prev + 1);
      }
      
      // Se for a última da fila, encerra a lição automaticamente após 1.2s
      if (activeQuestions.length === 1) {
        setTimeout(() => {
          void finishLesson();
        }, 1200);
        return;
      }
    } else {
      // Registra que errou a pergunta para não pontuar XP e repetir no final
      setMissedQuestionIds((prev) => {
        const next = new Set(prev);
        next.add(currentQuestion.id);
        return next;
      });
    }
  };

  const nextQuestion = () => {
    if (activeQuestions.length === 0) return;
    
    setSelectedAlternativeId(null);
    setAnswerConfirmed(false);
    setIsCurrentCorrect(false);
    setHintOpen(false);

    if (isCurrentCorrect) {
      // Remove do início da fila
      const nextQueue = activeQuestions.slice(1);
      setActiveQuestions(nextQueue);
      if (nextQueue.length === 0) {
        void finishLesson();
      }
    } else {
      // Move para o final da fila para responder de novo
      const nextQueue = [...activeQuestions.slice(1), activeQuestions[0]];
      setActiveQuestions(nextQueue);
    }
  };

  const finishLesson = async () => {
    if (!selectedSubject) return;
    setSavingLesson(true);
    const xpGained = correctCount * 10;

    try {
      // Envia a conclusão da lição do catálogo para ganhar XP e atualizar o banco
      await apiRequest('/api/catalog/complete', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: selectedSubject.id,
          correctCount,
          xpGained,
        }),
      });

      // Recarrega o estado global para atualizar o XP do usuário no app
      await fetchState();
      setLessonFinished(true);
    } catch (e) {
      console.error('Erro ao salvar lição:', e);
      setLessonFinished(true);
    } finally {
      setSavingLesson(false);
    }
  };

  const progressPercent = totalQuestions > 0 
    ? Math.min(((totalQuestions - activeQuestions.length) / totalQuestions) * 100, 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {activeSubjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎓</Text>
          <Text style={styles.emptyTitle}>Sua trilha está vazia</Text>
          <Text style={styles.emptyText}>
            Vá para a aba **Início (Catálogo)** e instale trilhas de estudo para começar a responder lições.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.sectionTitle}>Matérias Disponíveis</Text>
          <Text style={styles.sectionSubtitle}>Escolha uma matéria para treinar e ganhar XP</Text>
          
          {activeSubjects.map((subject) => {
            const questions = getSubjectQuestions(subject.id);
            const notebookName = getNotebookName(subject.notebookId);

            return (
              <TouchableOpacity
                key={subject.id}
                style={[styles.subjectCard, { borderColor: subject.color || '#e5e5e5' }]}
                onPress={() => startLesson(subject)}
              >
                <View style={styles.subjectCardHeader}>
                  <Text style={[styles.notebookTag, { backgroundColor: subject.color || '#58cc02' }]}>
                    {notebookName}
                  </Text>
                  <Text style={styles.questionCountText}>
                    📝 {questions.length} {questions.length === 1 ? 'pergunta' : 'perguntas'}
                  </Text>
                </View>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectDesc}>{subject.description}</Text>
                
                <View style={styles.startRow}>
                  <Text style={styles.startLink}>Iniciar Lição ➔</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={lessonActive} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom', 'left', 'right']}>
          {currentQuestion && !lessonFinished ? (
            <View style={styles.modalContent}>
              {/* Barra de progresso */}
              <View style={styles.progressBarRow}>
                <TouchableOpacity
                  onPress={() => {
                    setLessonActive(false);
                    setLessonFinished(false);
                  }}
                  style={styles.closeButtonIcon}
                >
                  <FontAwesome name="times" size={24} color="#afafaf" />
                </TouchableOpacity>

                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` }
                    ]}
                  />
                </View>

                <View style={styles.progressCounter}>
                  <Text style={styles.progressCountText}>
                    {Math.min(totalQuestions - activeQuestions.length + 1, totalQuestions)}/{totalQuestions}
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
                      {selectedSubject?.name || 'Matéria'}
                    </Text>
                  </View>
                  <View style={styles.learningTag}>
                    <Text style={styles.learningTagText}>Modo de estudo</Text>
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
                        disabled={answerConfirmed}
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
                            {isCurrentCorrect ? 'Muito bem!' : 'Resposta incorreta'}
                          </Text>
                          <Text
                            style={[
                              styles.feedbackSubstatusText,
                              { color: isCurrentCorrect ? "#6da83e" : "#cf5d5d" }
                            ]}
                          >
                            {isCurrentCorrect
                              ? 'Você acertou esta questão e garantiu +15 XP!'
                              : currentQuestion.alternatives.find((alt) => alt.isCorrect)?.rationale || 'A resposta selecionada não é a correta.'}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.feedbackInfo}>
                        <ActivityIndicator size="small" color="#58cc02" />
                        <Text style={styles.feedbackLoadingText}>Processando...</Text>
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
          ) : savingLesson ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#58cc02" />
              <Text style={styles.loadingText}>Salvando progresso no servidor...</Text>
            </View>
          ) : (
            <View style={styles.congratsContainer}>
              <Text style={styles.congratsEmoji}>🎉</Text>
              <Text style={styles.congratsTitle}>Lição Concluída!</Text>
              <Text style={styles.congratsSubtitle}>Você finalizou a matéria "{selectedSubject?.name}"</Text>
              
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>
                  Respostas corretas: <Text style={styles.greenText}>{correctCount} de {totalQuestions}</Text>
                </Text>
                <Text style={styles.summaryText}>
                  XP Ganhos: <Text style={styles.orangeText}>+{correctCount * 10} XP</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setLessonActive(false);
                  setLessonFinished(false);
                }}
              >
                <Text style={styles.closeButtonText}>Fechar e Voltar</Text>
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
  scrollContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#777777',
    marginTop: 4,
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 20,
  },
  subjectCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  subjectCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  notebookTag: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  questionCountText: {
    color: '#777777',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subjectName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 6,
  },
  subjectDesc: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 18,
    marginBottom: 12,
  },
  startRow: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  startLink: {
    color: '#58cc02',
    fontWeight: 'bold',
    fontSize: 14,
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
    color: '#8490a0',
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
    height: 50,
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
