/**
 * ErrorBoundary — catches unhandled React render errors and shows a
 * recovery screen instead of a blank/crashed app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeScreen />
 *   </ErrorBoundary>
 */

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {logger} from '@/utils/logger';

type Props = {
  children: React.ReactNode;
  /** Optional label shown above the generic message. */
  label?: string;
};

type State = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return {hasError: true, message};
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    logger.error('ErrorBoundary caught error', {error, componentStack: info.componentStack});
  }

  private handleReset = (): void => {
    this.setState({hasError: false, message: ''});
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>{'Something went wrong'}</Text>
        {this.props.label ? <Text style={styles.label}>{this.props.label}</Text> : null}
        <Text style={styles.message} numberOfLines={4}>
          {this.state.message}
        </Text>
        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
          <Text style={styles.buttonText}>{'Try again'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  label: string,
): React.ComponentType<P> {
  function WithBoundary(props: P): React.JSX.Element {
    return (
      <ErrorBoundary label={label}>
        <Component {...props} />
      </ErrorBoundary>
    );
  }
  WithBoundary.displayName = `WithBoundary(${Component.displayName ?? Component.name})`;
  return WithBoundary;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: '#FFF',
  },
  title: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    color: '#888',
    fontSize: 13,
  },
  message: {
    color: '#CC0000',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
