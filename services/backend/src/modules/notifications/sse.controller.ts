import { Controller, Sse, UseGuards, Request, MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Observable, fromEvent } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('实时推送 (SSE)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sse')
export class SseController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Sse('orders')
  ordersStream(@Request() req): Observable<MessageEvent> {
    const projectId = req.projectId as string;
    // We only send events relevant to the user's current project.
    return fromEvent(this.eventEmitter, 'order.updated').pipe(
      filter((payload: any) => {
        if (!payload) return false;
        if (payload.projectId && payload.projectId !== projectId) return false;
        return true;
      }),
      map((payload: any) => {
        return {
          data: payload,
          type: 'order_updated'
        } as MessageEvent;
      })
    );
  }
}
