import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '@/navigation/types';
import {GradientBackground} from '@/components/GradientBackground';
import {colors} from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const WELCOME_KEY = '@olix/welcome_shown';

export function WelcomeScreen({navigation}: Props): React.JSX.Element {
  async function handleGetStarted(): Promise<void> {
    await AsyncStorage.setItem(WELCOME_KEY, 'true');
    navigation.replace('MainTabs');
  }

  return (
    <View style={styles.screen}>
      <GradientBackground gradientId="welcomeBg" startColor="#F0EEFF" endColor="#E4DEFF" />

      <View style={styles.center}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.wordmark}>{'akhr'}</Text>
        <Text style={styles.tagline}>{'Your private mind, on local silicon.'}</Text>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => void handleGetStarted()}
          activeOpacity={0.85}>
          <Text style={styles.buttonText}>{'Get Started'}</Text>
        </TouchableOpacity>
        <Text style={styles.poweredBy}>{'Powered by Gemma 4 · Made by Olix Studios'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lavender,
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 32,
  },
  wordmark: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.navy,
    letterSpacing: -1,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: colors.purpleDim,
    fontWeight: '400',
    textAlign: 'center',
  },
  bottom: {
    alignItems: 'center',
    gap: 16,
  },
  button: {
    backgroundColor: colors.purple,
    borderRadius: 50,
    paddingVertical: 18,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    shadowColor: colors.purple,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  poweredBy: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
