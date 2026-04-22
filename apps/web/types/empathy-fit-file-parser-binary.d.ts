declare module "empathy-fit-file-parser-binary" {
  import type { Buffer } from "node:buffer";

  export function calculateCRC(blob: Uint8Array, start: number, end: number): number;
  export function getArrayBuffer(buffer: Buffer | ArrayBuffer): ArrayBuffer;
  export function readRecord(
    blob: Uint8Array,
    messageTypes: unknown[],
    developerFields: unknown[],
    startIndex: number,
    options: Record<string, unknown>,
    startDate: unknown,
    pausedTime: number,
  ): { nextIndex: number; messageType: string; message: Record<string, unknown> };
}
