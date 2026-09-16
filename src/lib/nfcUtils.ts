/**
 * NFC Utilities for Web NFC API
 * Handles reading NFC tags for location check-ins
 */

export interface NFCReading {
  serialNumber: string;
  records: Array<{
    recordType: string;
    data: string;
  }>;
}

export class NFCReader {
  private abortController: AbortController | null = null;

  /**
   * Check if NFC is supported by the browser
   */
  static isSupported(): boolean {
    return 'NDEFReader' in window;
  }

  /**
   * Request NFC permissions and start scanning
   */
  async startScanning(onScan: (locationCode: string) => void, onError: (error: Error) => void) {
    if (!NFCReader.isSupported()) {
      onError(new Error('NFC is not supported on this device'));
      return;
    }

    try {
      // Request permission
      // @ts-ignore - NDEFReader is not yet in TypeScript types
      const ndef = new NDEFReader();
      this.abortController = new AbortController();

      await ndef.scan({ signal: this.abortController.signal });

      console.log('NFC scan started');

      ndef.addEventListener('reading', ({ message, serialNumber }: any) => {
        console.log('NFC tag detected:', serialNumber);

        // Read the first text record from the NFC tag
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            const locationCode = textDecoder.decode(record.data);
            console.log('Location code from NFC:', locationCode);
            onScan(locationCode);
            return;
          }
        }

        onError(new Error('No valid location code found on NFC tag'));
      });

      ndef.addEventListener('readingerror', () => {
        onError(new Error('Failed to read NFC tag'));
      });

    } catch (error) {
      console.error('NFC scan error:', error);
      if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error('Failed to start NFC scanning'));
      }
    }
  }

  /**
   * Stop scanning for NFC tags
   */
  stopScanning() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      console.log('NFC scan stopped');
    }
  }
}
