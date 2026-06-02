/** DI token for the active StorageService implementation. */
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface StoredFile {
  /** Public URL the SPA stores and the browser loads. */
  url: string;
  /** Opaque storage key (e.g. filename) usable with `remove`. */
  key: string;
}

/**
 * File persistence abstraction. Local-disk today; swap the provider for S3/GCS
 * without touching callers (see UploadsModule providers).
 */
export interface StorageService {
  save(buffer: Buffer, ext: string): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}
