import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.8bc8181d658546a082d64570d2fbb82c',
  appName: 'Kretopia',
  webDir: 'dist',
  server: {
    url: 'https://8bc8181d-6585-46a0-82d6-4570d2fbb82c.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    // Handle deep links for kretopia.com
    appendUrlPathToDeepLinks: true,
    backgroundColor: '#0a0a0a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      showSpinner: true,
      spinnerColor: '#7c3aed',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
