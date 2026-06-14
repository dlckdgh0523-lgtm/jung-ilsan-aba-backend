/** DI token for the active StorageService implementation. */
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StoredFile {
  /** Public URL the SPA stores and the browser loads. */
  url: string;
  /** Opaque storage key (e.g. filename) usable with `remove`. */
  key: string;
}

export interface SaveOptions {
  /** Override the stored object's Content-Type (defaults by extension). */
  contentType?: string;
  /** e.g. `attachment; filename*=UTF-8''...` — forces a download with a friendly name. */
  contentDisposition?: string;
}

/**
 * File persistence abstraction. Local-disk today; swap the provider for S3/GCS
 * without touching callers (see UploadsModule providers).
 */
export interface StorageService {
  save(buffer: Buffer, ext: string, opts?: SaveOptions): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}
