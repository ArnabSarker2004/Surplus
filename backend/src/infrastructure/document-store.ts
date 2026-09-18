/** Synchronous domain document boundary; persistence is committed by its unit of work. */
export interface DocumentStore {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  transaction(work: () => void): void;
}

export class MemoryDocuments implements DocumentStore {
  private documents = new Map<string, unknown>();
  dirty = false;
  changedKeys = new Set<string>();
  constructor(initial: Record<string, unknown> = {}) {
    this.documents = new Map(Object.entries(initial));
  }
  get<T>(key: string, fallback: T): T {
    return structuredClone(this.documents.has(key) ? this.documents.get(key) : fallback) as T;
  }
  set(key: string, value: unknown) {
    this.documents.set(key, structuredClone(value));
    this.dirty = true;
    this.changedKeys.add(key);
  }
  remove(key: string) {
    this.documents.delete(key);
    this.dirty = true;
    this.changedKeys.add(key);
  }
  transaction(work: () => void) {
    const before = structuredClone(this.documents);
    const dirty = this.dirty;
    const changedKeys = new Set(this.changedKeys);
    try {
      work();
    } catch (error) {
      this.documents = before;
      this.dirty = dirty;
      this.changedKeys = changedKeys;
      throw error;
    }
  }
}
