import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DeviceService from '../services/DeviceService';

const DeviceControlScreen = ({ route, navigation }) => {
  const { deviceId, deviceName } = route.params;
  const [deviceStatus, setDeviceStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set up device status monitoring
    const unsubscribe = DeviceService.subscribeToDeviceStatus(deviceId, (status) => {
      setDeviceStatus(status);
    });

    return unsubscribe;
  }, [deviceId]);

  const sendCommand = async (command) => {
    try {
      setLoading(true);
      await DeviceService.sendCommand(deviceId, command);
      Alert.alert('Success', `${command} command sent successfully`);
    } catch (error) {
      Alert.alert('Error', `Failed to send ${command} command: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const ControlButton = ({ title, command, color, disabled }) => (
    <TouchableOpacity
      style={[
        styles.controlButton,
        { backgroundColor: color },
        disabled && styles.disabledButton,
      ]}
      onPress={() => sendCommand(command)}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.deviceTitle}>{deviceName}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={[styles.statusDot, getStatusStyle(deviceStatus)]} />
          <Text style={styles.statusText}>{deviceStatus}</Text>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <Text style={styles.sectionTitle}>Stream Controls</Text>

        <View style={styles.buttonRow}>
          <ControlButton
            title="▶️ Play"
            command="play"
            color="#4CAF50"
            disabled={deviceStatus !== 'connected'}
          />
          <ControlButton
            title="⏸️ Pause"
            command="pause"
            color="#FF9800"
            disabled={deviceStatus !== 'connected'}
          />
        </View>

        <View style={styles.buttonRow}>
          <ControlButton
            title="🔍 Fullscreen"
            command="fullscreen"
            color="#2196F3"
            disabled={deviceStatus !== 'connected'}
          />
          <ControlButton
            title="🔄 Refresh"
            command="refresh"
            color="#9C27B0"
            disabled={deviceStatus !== 'connected'}
          />
        </View>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Device Information</Text>
        <Text style={styles.infoText}>ID: {deviceId}</Text>
        <Text style={styles.infoText}>Type: Raspberry Pi</Text>
        <Text style={styles.infoText}>
          Last updated: {new Date().toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

const getStatusStyle = (status) => {
  switch (status) {
    case 'connected':
      return styles.statusOnline;
    case 'disconnected':
      return styles.statusOffline;
    default:
      return styles.statusUnknown;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  statusContainer: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  deviceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: '#ccc',
    marginRight: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: '#f44336',
  },
  statusUnknown: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    fontSize: 16,
    color: '#fff',
    textTransform: 'capitalize',
  },
  controlsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  controlButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
  },
});

export default DeviceControlScreen;
