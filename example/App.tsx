import { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { ClaudeAuth, deleteTokens } from 'expo-claude-auth';
import type { ClaudeAuthSuccessResult } from 'expo-claude-auth';

export default function App() {
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState<ClaudeAuthSuccessResult | null>(null);

  if (user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Authenticated!</Text>
        <Text style={styles.info}>Subscription: {user.profile.subscriptionType ?? 'free'}</Text>
        <Text style={styles.info}>Rate limit tier: {user.profile.rateLimitTier ?? 'unknown'}</Text>
        <Text style={styles.info}>Token expires: {new Date(user.tokens.expiresAt).toLocaleString()}</Text>
        <View style={{ marginTop: 20 }}>
          <Button
            title="Sign out"
            onPress={async () => {
              await deleteTokens();
              setUser(null);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>expo-claude-auth example</Text>
      <Button onPress={() => setShowAuth(true)} title="Sign in with Claude" />

      <ClaudeAuth
        visible={showAuth}
        onSuccess={(result) => {
          setShowAuth(false);
          setUser(result);
        }}
        onCancel={() => setShowAuth(false)}
        onError={(error) => {
          setShowAuth(false);
          console.warn('Auth error:', error);
        }}
        config={{
          onError: (ctx, err, extra) => console.warn(`[${ctx}]`, err, extra),
          onEvent: (name, props) => console.log(`[event] ${name}`, props),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});
