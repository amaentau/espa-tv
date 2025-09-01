import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import DeviceService from '../services/DeviceService';

const SettingsScreen = ({ navigation }) => {
  const [cloudUrl, setCloudUrl] = useState(DeviceService.baseUrl);
  const [testingConnection, setTestingConnection] = useState(false);

  const handleSaveSettings = () => {
    // Update the cloud service URL
    DeviceService.baseUrl = cloudUrl;

    Alert.alert('Success', 'Settings saved successfully');
    navigation.goBack();
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const health = await DeviceService.checkHealth();
      Alert.alert(
        'Connection Test',
        `✅ Connected successfully!\nDevices online: ${health.connectedDevices}`
      );
    } catch (error) {
      Alert.alert(
        'Connection Test',
        `❌ Connection failed: ${error.message}\n\nPlease check the cloud service URL and try again.`
      );
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cloud Service</Text>

        <Text style={styles.label}>Cloud Service URL</Text>
        <TextInput
          style={styles.input}
          value={cloudUrl}
          onChangeText={setCloudUrl}
          placeholder="http://your-cloud-service.com"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.button, testingConnection && styles.disabledButton]}
          onPress={handleTestConnection}
          disabled={testingConnection}
        >
          <Text style={styles.buttonText}>
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Management</Text>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => Alert.alert('Info', 'Device registration will be implemented in a future update')}
        >
          <Text style={styles.secondaryButtonText}>Register New Device</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <Text style={styles.infoText}>
          Veo Dongle Mobile App v1.0.0{'\n\n'}
          Control your Veo stream devices from your mobile device.{'\n\n'}
          Features:{'\n'}
          • Device discovery and control{'\n'}
          • Real-time stream playback control{'\n'}
          • Fullscreen mode toggle{'\n'}
          • Cloud-based device management
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveSettings}
        >
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  section: {
    backgroundColor: '#1e1e1e',
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  infoText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    padding: 16,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;
