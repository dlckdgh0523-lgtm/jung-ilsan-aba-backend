import { Controller, MessageEvent, Req, Sse, UseGuards } from '@nestjs/common';
import {
  Observable,
  concat,
  filter,
  finalize,
  from,
  interval,
  map,
  merge,
  startWith,
  switchMap,
} from 'rxjs';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { StatsService } from '../stats/stats.service';
import { RealtimeService, type RealtimeEvent } from './realtime.service';
import { SseAuthGuard } from './sse-auth.guard';

/** ~25s heartbeat keeps the stream alive through Nginx/proxy idle timeouts. */
const HEARTBEAT_MS = 25_000;
/** Stats stream re-polls the DB on this cadence (no event source to subscribe to). */
const STATS_POLL_MS = 5_000;

/** Tag each event with `id: evt_<seq>` so the browser echoes it back as Last-Event-ID. */
function toMessageEvent(e: RealtimeEvent): MessageEvent {
  return { id: `evt_${e.seq}`, type: e.type, data: e.data as object };
}

@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly stats: StatsService,
  ) {}

  @Sse('consultations')
  @UseGuards(SseAuthGuard)
  consultations(@Req() req: Request): Observable<MessageEvent> {
    const connId = randomUUID();
    const userId = (req as Request & { user?: { id?: string } }).user?.id ?? 'admin';
    this.realtime.registerConnection(connId, userId);

    // On auto-reconnect the browser sends Last-Event-ID; replay anything missed, then go live.
    const lastSeq = Number(String(req.headers['last-event-id'] ?? '').replace('evt_', ''));
    const replay$ = from(this.realtime.replayAfter(lastSeq)).pipe(map(toMessageEvent));
    const live$ = this.realtime.events$.pipe(
      filter((e) => e.type === 'consultation'),
      map(toMessageEvent),
    );

    // finalize() runs when the client disconnects → unregister so nothing leaks.
    return merge(concat(replay$, live$), this.heartbeat$()).pipe(
      finalize(() => this.realtime.unregisterConnection(connId)),
    );
  }

  @Sse('stats')
  @UseGuards(SseAuthGuard)
  streamStats(): Observable<MessageEvent> {
    const stats$ = interval(STATS_POLL_MS).pipe(
      startWith(0),
      switchMap(() => from(this.stats.summary())),
      map((data): MessageEvent => ({ type: 'stats', data: data as object })),
    );
    return merge(stats$, this.heartbeat$());
  }

  private heartbeat$(): Observable<MessageEvent> {
    return interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: { ts: Date.now() } })),
    );
  }
}
