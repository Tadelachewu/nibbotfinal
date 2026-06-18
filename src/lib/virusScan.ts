import { Socket } from 'node:net';

export interface ScanResult {
  clean: boolean;
  threat?: string;
  skipped?: boolean;
}

const CHUNK_SIZE = 8192;

export function isVirusScanEnabled(): boolean {
  return process.env.ENABLE_VIRUS_SCAN === 'true';
}

export async function scanBuffer(buffer: Buffer): Promise<ScanResult> {
  if (!isVirusScanEnabled()) {
    return { clean: true, skipped: true };
  }

  const host = process.env.CLAMAV_HOST || '127.0.0.1';
  const port = Number(process.env.CLAMAV_PORT) || 3310;
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS) || 30_000;

  return new Promise<ScanResult>((resolve) => {
    const socket = new Socket();
    let response = '';
    let settled = false;

    const finish = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      console.error('[VirusScan] Connection timed out');
      finish({ clean: false, threat: 'Scanner timeout — upload rejected.' });
    });

    socket.on('error', (err) => {
      console.error('[VirusScan] Connection error:', err.message);
      finish({ clean: false, threat: 'Scanner unavailable — upload rejected.' });
    });

    socket.on('data', (data) => {
      response += data.toString();
    });

    socket.on('end', () => {
      const trimmed = response.trim().replace(/\0/g, '');
      if (trimmed.endsWith('OK')) {
        finish({ clean: true });
      } else {
        const match = trimmed.match(/:\s*(.+)\s+FOUND$/);
        const threat = match ? match[1] : 'Unknown threat';
        finish({ clean: false, threat });
      }
    });

    socket.connect(port, host, () => {
      // INSTREAM command (null-terminated)
      socket.write(Buffer.from('zINSTREAM\0'));

      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
        const sizeHeader = Buffer.alloc(4);
        sizeHeader.writeUInt32BE(chunk.length, 0);
        socket.write(sizeHeader);
        socket.write(chunk);
      }

      // Zero-length chunk signals end of stream
      socket.write(Buffer.alloc(4, 0));
    });
  });
}
