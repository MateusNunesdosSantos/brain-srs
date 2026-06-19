import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Text, View } from '../../components/Themed';
import { useAuth } from '../../context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    if (password.length < 10) {
      setError('A senha deve ter pelo menos 10 caracteres.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
    } catch (e: any) {
      console.error(e);
      setError(e?.error || e?.message || 'Falha ao criar conta. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logoText}>Brain<Text style={styles.logoHighlight}>SRS</Text></Text>
          <Text style={styles.subtitle}>Crie sua conta para começar a memorizar</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Cadastre-se</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              style={[styles.input, nameFocused && styles.inputFocused]}
              placeholder="Seu nome"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha (mínimo 10 caracteres)</Text>
            <TextInput
              style={[styles.input, passwordFocused && styles.inputFocused]}
              placeholder="Uma senha forte"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Criar Conta</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Já possui uma conta?</Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Fazer Login</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'transparent',
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#3c3c3c',
    letterSpacing: 1,
  },
  logoHighlight: {
    color: '#58cc02',
  },
  subtitle: {
    fontSize: 14,
    color: '#777777',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  form: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#e5e5e5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#ffdfe0',
    borderWidth: 2,
    borderColor: '#ff4b4b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff4b4b',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3c3c3c',
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#3c3c3c',
    backgroundColor: '#ffffff',
  },
  inputFocused: {
    borderColor: '#1cb0f6',
  },
  button: {
    height: 50,
    backgroundColor: '#58cc02',
    borderBottomWidth: 4,
    borderBottomColor: '#46a302',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  footerText: {
    color: '#777777',
    fontSize: 14,
    marginRight: 6,
  },
  footerLink: {
    color: '#1cb0f6',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
