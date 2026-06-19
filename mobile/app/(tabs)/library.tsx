import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '../../components/Themed';
import { useAppState } from '../../context/StateContext';
import { Notebook, Subject, Question, Alternative } from '../../services/types';

const PRESETS_COLORS = ['#58cc02', '#ff9600', '#1cb0f6', '#ff4b4b', '#b87cf8', '#ffc800'];

export default function LibraryScreen() {
  const { state, dispatchAction } = useAppState();

  const [libraryTab, setLibraryTab] = useState<'oficial' | 'importado'>('oficial');

  // Estados de navegação interna: drill-down
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Modais de Criação
  const [modalType, setModalType] = useState<'notebook' | 'subject' | 'question' | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields - Notebook
  const [nbName, setNbName] = useState('');
  const [nbDesc, setNbDesc] = useState('');
  const [nbColor, setNbColor] = useState(PRESETS_COLORS[0]);

  // Form Fields - Subject
  const [subName, setSubName] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [subColor, setSubColor] = useState(PRESETS_COLORS[0]);

  // Form Fields - Question
  const [qPrompt, setQPrompt] = useState('');
  const [qHint, setQHint] = useState('');
  const [altAText, setAltAText] = useState('');
  const [altBText, setAltBText] = useState('');
  const [altCText, setAltCText] = useState('');
  const [altDText, setAltDText] = useState('');
  const [correctAlt, setCorrectAlt] = useState<'A' | 'B' | 'C' | 'D'>('A');

  if (!state) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color="#58cc02" />
        <Text style={styles.loadingText}>Carregando biblioteca...</Text>
      </SafeAreaView>
    );
  }

  // Get current active selections
  const currentNotebook = state.notebooks.find((n) => n.id === selectedNotebookId);
  const currentSubject = state.subjects.find((s) => s.id === selectedSubjectId);

  // Filter lists based on selections
  const filteredSubjects = state.subjects.filter((s) => s.notebookId === selectedNotebookId);
  const filteredQuestions = state.questions.filter((q) => q.subjectId === selectedSubjectId);

  // Handlers - Notebook
  const handleCreateNotebook = async () => {
    if (!nbName.trim()) {
      Alert.alert('Erro', 'O nome do caderno é obrigatório.');
      return;
    }
    setSaving(true);
    const newNb: Notebook = {
      id: Math.random().toString(36).substring(7),
      name: nbName.trim(),
      description: nbDesc.trim(),
      color: nbColor,
    };
    try {
      await dispatchAction({ type: 'addNotebook', notebook: newNb });
      setModalType(null);
      setNbName('');
      setNbDesc('');
    } catch {
      Alert.alert('Erro', 'Falha ao salvar caderno.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNotebook = (nb: Notebook) => {
    Alert.alert(
      'Excluir Caderno',
      `Tem certeza que deseja apagar "${nb.name}"? Isso removerá todas as matérias e perguntas associadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatchAction({ type: 'deleteNotebook', notebookId: nb.id });
              setSelectedNotebookId(null);
            } catch {
              Alert.alert('Erro', 'Falha ao excluir caderno.');
            }
          },
        },
      ]
    );
  };

  // Handlers - Subject
  const handleCreateSubject = async () => {
    if (!selectedNotebookId) return;
    if (!subName.trim()) {
      Alert.alert('Erro', 'O nome da matéria é obrigatório.');
      return;
    }
    setSaving(true);
    const newSub: Subject = {
      id: Math.random().toString(36).substring(7),
      notebookId: selectedNotebookId,
      name: subName.trim(),
      description: subDesc.trim(),
      color: subColor,
    };
    try {
      await dispatchAction({ type: 'addSubject', subject: newSub });
      setModalType(null);
      setSubName('');
      setSubDesc('');
    } catch {
      Alert.alert('Erro', 'Falha ao salvar matéria.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = (sub: Subject) => {
    Alert.alert(
      'Excluir Matéria',
      `Tem certeza que deseja apagar "${sub.name}"? Todas as perguntas desta matéria serão removidas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatchAction({ type: 'deleteSubject', subjectId: sub.id });
              setSelectedSubjectId(null);
            } catch {
              Alert.alert('Erro', 'Falha ao excluir matéria.');
            }
          },
        },
      ]
    );
  };

  // Handlers - Question
  const handleCreateQuestion = async () => {
    if (!selectedSubjectId) return;
    if (!qPrompt.trim() || !altAText.trim() || !altBText.trim() || !altCText.trim() || !altDText.trim()) {
      Alert.alert('Erro', 'Preencha a pergunta e todas as 4 alternativas.');
      return;
    }
    setSaving(true);

    const alts: Alternative[] = [
      { id: 'alt-a', label: 'A', text: altAText.trim(), rationale: 'Justificativa A', isCorrect: correctAlt === 'A' },
      { id: 'alt-b', label: 'B', text: altBText.trim(), rationale: 'Justificativa B', isCorrect: correctAlt === 'B' },
      { id: 'alt-c', label: 'C', text: altCText.trim(), rationale: 'Justificativa C', isCorrect: correctAlt === 'C' },
      { id: 'alt-d', label: 'D', text: altDText.trim(), rationale: 'Justificativa D', isCorrect: correctAlt === 'D' },
    ];

    const newQ: Question = {
      id: Math.random().toString(36).substring(7),
      subjectId: selectedSubjectId,
      prompt: qPrompt.trim(),
      hint: qHint.trim(),
      alternatives: alts,
    };

    try {
      await dispatchAction({ type: 'addQuestion', question: newQ });
      setModalType(null);
      setQPrompt('');
      setQHint('');
      setAltAText('');
      setAltBText('');
      setAltCText('');
      setAltDText('');
      setCorrectAlt('A');
    } catch {
      Alert.alert('Erro', 'Falha ao salvar pergunta.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = (qId: string) => {
    Alert.alert('Excluir Pergunta', 'Tem certeza que deseja apagar esta pergunta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await dispatchAction({ type: 'deleteQuestion', questionId: qId });
          } catch {
            Alert.alert('Erro', 'Falha ao excluir pergunta.');
          }
        },
      },
    ]);
  };

  // Filtra cadernos de acordo com a aba (Oficiais vs Importados/Custom)
  const filteredNotebooks = state.notebooks.filter((nb) => {
    const isOfficial = nb.sourceCatalogPackId !== null && nb.sourceCatalogPackId !== undefined;
    return libraryTab === 'oficial' ? isOfficial : !isOfficial;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 1. Nível de Notebooks */}
      {!selectedNotebookId && (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Biblioteca</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalType('notebook')}>
              <Text style={styles.addButtonText}>+ Caderno</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Gerencie seus cadernos e crie perguntas customizadas</Text>

          {/* Tabs Seletor estilo Web */}
          <View style={styles.tabSelectorContainer}>
            <View style={styles.tabSelector}>
              <TouchableOpacity
                style={[styles.tabButton, libraryTab === 'oficial' && styles.tabButtonActive]}
                onPress={() => setLibraryTab('oficial')}
              >
                <Text style={[styles.tabButtonText, libraryTab === 'oficial' && styles.tabButtonTextActive]}>
                  Oficiais
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, libraryTab === 'importado' && styles.tabButtonActive]}
                onPress={() => setLibraryTab('importado')}
              >
                <Text style={[styles.tabButtonText, libraryTab === 'importado' && styles.tabButtonTextActive]}>
                  Importados
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {filteredNotebooks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {libraryTab === 'oficial'
                  ? 'Nenhum caderno oficial instalado. Vá ao início para adicionar conteúdos do catálogo.'
                  : 'Nenhum caderno customizado criado. Toque em "+ Caderno" para criar.'}
              </Text>
            </View>
          ) : (
            filteredNotebooks.map((nb) => {
              const subCount = state.subjects.filter((s) => s.notebookId === nb.id).length;
              return (
                <TouchableOpacity
                  key={nb.id}
                  style={[styles.card, { borderColor: nb.color || '#e5e5e5' }]}
                  onPress={() => setSelectedNotebookId(nb.id)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{nb.name}</Text>
                    <Text style={styles.cardMeta}>📂 {subCount} matérias</Text>
                  </View>
                  <Text style={styles.cardDesc}>{nb.description || 'Sem descrição.'}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* 2. Nível de Subjects (Matérias) */}
      {selectedNotebookId && !selectedSubjectId && currentNotebook && (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.backRow}>
            <TouchableOpacity onPress={() => setSelectedNotebookId(null)}>
              <Text style={styles.backLink}>◀ Voltar para Cadernos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteLink} onPress={() => handleDeleteNotebook(currentNotebook)}>
              <Text style={styles.deleteLinkText}>Excluir Caderno</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerRow}>
            <Text style={styles.title}>{currentNotebook.name}</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalType('subject')}>
              <Text style={styles.addButtonText}>+ Matéria</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{currentNotebook.description || 'Caderno ativo'}</Text>

          {filteredSubjects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma matéria cadastrada neste caderno.</Text>
            </View>
          ) : (
            filteredSubjects.map((sub) => {
              const qCount = state.questions.filter((q) => q.subjectId === sub.id).length;
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.card, { borderColor: sub.color || '#e5e5e5' }]}
                  onPress={() => setSelectedSubjectId(sub.id)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{sub.name}</Text>
                    <Text style={styles.cardMeta}>📝 {qCount} perguntas</Text>
                  </View>
                  <Text style={styles.cardDesc}>{sub.description || 'Sem descrição.'}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* 3. Nível de Questions (Perguntas) */}
      {selectedNotebookId && selectedSubjectId && currentSubject && (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.backRow}>
            <TouchableOpacity onPress={() => setSelectedSubjectId(null)}>
              <Text style={styles.backLink}>◀ Voltar para Matérias</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteLink} onPress={() => handleDeleteSubject(currentSubject)}>
              <Text style={styles.deleteLinkText}>Excluir Matéria</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerRow}>
            <Text style={styles.title}>{currentSubject.name}</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalType('question')}>
              <Text style={styles.addButtonText}>+ Pergunta</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{currentSubject.description || 'Matéria ativa'}</Text>

          {filteredQuestions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma pergunta criada para esta matéria.</Text>
            </View>
          ) : (
            filteredQuestions.map((q) => (
              <View key={q.id} style={styles.questionCard}>
                <View style={styles.qHeader}>
                  <Text style={styles.qPrompt}>{q.prompt}</Text>
                  <TouchableOpacity onPress={() => handleDeleteQuestion(q.id)}>
                    <Text style={styles.qDeleteText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
                {q.hint ? <Text style={styles.qHint}>💡 Dica: {q.hint}</Text> : null}
                <View style={styles.qAlts}>
                  {q.alternatives.map((alt) => (
                    <Text key={alt.id} style={[styles.qAlt, alt.isCorrect && styles.qAltCorrect]}>
                      {alt.label}) {alt.text} {alt.isCorrect && '✅'}
                    </Text>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* MODAL CRIAR CADERNO */}
      <Modal visible={modalType === 'notebook'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Criar Novo Caderno</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome do Caderno"
              placeholderTextColor="#666"
              value={nbName}
              onChangeText={setNbName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Descrição (Opcional)"
              placeholderTextColor="#666"
              value={nbDesc}
              onChangeText={setNbDesc}
            />
            <Text style={styles.colorLabel}>Escolha uma Cor:</Text>
            <View style={styles.colorGrid}>
              {PRESETS_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorCircle, { backgroundColor: c }, nbColor === c && styles.colorCircleSelected]}
                  onPress={() => setNbColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalType(null)} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateNotebook} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CRIAR MATÉRIA */}
      <Modal visible={modalType === 'subject'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Criar Nova Matéria</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome da Matéria"
              placeholderTextColor="#666"
              value={subName}
              onChangeText={setSubName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Descrição"
              placeholderTextColor="#666"
              value={subDesc}
              onChangeText={setSubDesc}
            />
            <Text style={styles.colorLabel}>Escolha uma Cor:</Text>
            <View style={styles.colorGrid}>
              {PRESETS_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorCircle, { backgroundColor: c }, subColor === c && styles.colorCircleSelected]}
                  onPress={() => setSubColor(c)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalType(null)} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateSubject} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CRIAR PERGUNTA */}
      <Modal visible={modalType === 'question'} animationType="slide">
        <View style={styles.fullModal}>
          <ScrollView contentContainerStyle={styles.fullModalScroll}>
            <Text style={styles.modalTitle}>Nova Pergunta</Text>
            
            <Text style={styles.fieldLabel}>Pergunta</Text>
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Ex: Qual o principal protocolo de transporte seguro?"
              placeholderTextColor="#666"
              multiline
              value={qPrompt}
              onChangeText={setQPrompt}
            />

            <Text style={styles.fieldLabel}>Dica (opcional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Começa com a letra H"
              placeholderTextColor="#666"
              value={qHint}
              onChangeText={setQHint}
            />

            <Text style={styles.fieldLabel}>Alternativas e a Correta</Text>
            {['A', 'B', 'C', 'D'].map((label) => {
              let val = altAText;
              let setVal = setAltAText;
              if (label === 'B') { val = altBText; setVal = setAltBText; }
              if (label === 'C') { val = altCText; setVal = setAltCText; }
              if (label === 'D') { val = altDText; setVal = setAltDText; }

              const isCorrect = correctAlt === label;

              return (
                <View key={label} style={styles.altFormRow}>
                  <TouchableOpacity
                    style={[styles.correctIndicator, isCorrect && styles.correctIndicatorActive]}
                    onPress={() => setCorrectAlt(label as any)}
                  >
                    <Text style={styles.correctIndicatorText}>{label}</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.altInput}
                    placeholder={`Texto da alternativa ${label}`}
                    placeholderTextColor="#666"
                    value={val}
                    onChangeText={setVal}
                  />
                </View>
              );
            })}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalType(null)} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateQuestion} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Criar Pergunta</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#3c3c3c',
  },
  subtitle: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#58cc02',
    borderBottomWidth: 3,
    borderBottomColor: '#46a302',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
  },
  emptyText: {
    color: '#777777',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 6,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#3c3c3c',
    flex: 1,
    marginRight: 10,
  },
  cardMeta: {
    fontSize: 12,
    color: '#777777',
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 18,
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  backLink: {
    color: '#1cb0f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteLinkText: {
    color: '#ff4b4b',
    fontSize: 13,
    fontWeight: '500',
  },
  deleteLink: {
    backgroundColor: 'transparent',
  },
  questionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  qHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  qPrompt: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3c3c3c',
    flex: 1,
    marginRight: 10,
    lineHeight: 22,
  },
  qDeleteText: {
    color: '#ff4b4b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  qHint: {
    color: '#1cb0f6',
    fontSize: 13,
    marginBottom: 10,
  },
  qAlts: {
    backgroundColor: 'transparent',
  },
  qAlt: {
    fontSize: 14,
    color: '#555555',
    marginVertical: 2,
  },
  qAltCorrect: {
    color: '#46a302',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#3c3c3c',
    fontSize: 15,
    marginBottom: 12,
  },
  colorLabel: {
    color: '#777777',
    fontSize: 13,
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#3c3c3c',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#777777',
    fontSize: 15,
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#58cc02',
    borderBottomWidth: 3,
    borderBottomColor: '#46a302',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  fullModal: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  fullModalScroll: {
    padding: 24,
  },
  fieldLabel: {
    color: '#777777',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 10,
  },
  altFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  correctIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  correctIndicatorActive: {
    backgroundColor: '#58cc02',
  },
  correctIndicatorText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  altInput: {
    flex: 1,
    height: 48,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#3c3c3c',
    fontSize: 14,
  },
  tabSelectorContainer: {
    backgroundColor: 'transparent',
    marginBottom: 16,
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
});
