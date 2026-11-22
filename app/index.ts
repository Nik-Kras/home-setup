import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/data/widgetSync';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);

// Load the Router entry after registering the headless task.
require('expo-router/entry');
