import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface RealtimeEvent {
  /** Monotonic sequence; surfaced to clients as `evt_<seq>` for Last-Event-ID. */
  seq: number;
  type: 'consultation';
  data: unknown;
}

/**
 * In-process event bus for Server-Sent Events. A single API instance fans new
 * consultations out to every connected admin dashboard, with a small replay buffer
 * so a client that briefly drops can recover missed events via Last-Event-ID.
 * (Multi-instance deployments would move this to Redis pub/sub — single-instance is the target.)
 */
@Injectable()
export class RealtimeService {
  private seq = 0;
  private readonly BUFFER_MAX = 100;
  private readonly buffer: RealtimeEvent[] = [];
  private readonly subject = new Subject<RealtimeEvent>();
  private readonly connections = new Map<string, { userId: string; since: number }>();

  /** Live event stream — SSE controllers subscribe to this. */
  get events$(): Observable<RealtimeEvent> {
    return this.subject.asObservable();
  }

  emitConsultation(view: unknown): void {
    const event: RealtimeEvent = { seq: ++this.seq, type: 'consultation', data: view };
    this.buffer.push(event);
    if (this.buffer.length > this.BUFFER_MAX) this.buffer.shift();
    this.subject.next(event);
  }

  /** Buffered events newer than `afterSeq` — replayed on reconnect (Last-Event-ID). */
  replayAfter(afterSeq: number): RealtimeEvent[] {
    if (!Number.isFinite(afterSeq) || afterSeq <= 0) return [];
    return this.buffer.filter((e) => e.seq > afterSeq);
  }

  // ── Connection registry: track live SSE connections; unregister on disconnect
  //    so subscriptions never leak. (Keyed per connection; userId enables per-user views.)
  registerConnection(connId: string, userId: string): void {
    this.connections.set(connId, { userId, since: Date.now() });
  }

  unregisterConnection(connId: string): void {
    this.connections.delete(connId);
  }

  get connectionCount(): number {
    return this.connections.size;
  }
}
