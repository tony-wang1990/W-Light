import {
  BadRequestException,
  Controller,
  ForbiddenException,
  MessageEvent,
  Query,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Observable, fromEvent } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../users/entities/user.entity';

interface OrderUpdatedPayload {
  projectId?: string;
  [key: string]: unknown;
}

interface RequestUser {
  role?: UserRole | string;
  projectIds?: string[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('实时推送 (SSE)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sse')
export class SseController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Sse('orders')
  ordersStream(@Request() req: { user?: RequestUser }, @Query('projectId') projectId?: string): Observable<MessageEvent> {
    const normalizedProjectId = projectId?.trim();
    if (!normalizedProjectId || !UUID_PATTERN.test(normalizedProjectId)) {
      throw new BadRequestException('Missing or invalid projectId query');
    }

    const user = req.user;
    const allowed = user?.role === UserRole.ADMIN || user?.projectIds?.includes(normalizedProjectId);
    if (!allowed) {
      throw new ForbiddenException('No access to this project');
    }

    // We only send events relevant to the user's current project.
    return fromEvent<OrderUpdatedPayload>(this.eventEmitter, 'order.updated').pipe(
      filter((payload: OrderUpdatedPayload) => {
        if (!payload) return false;
        return payload.projectId === normalizedProjectId;
      }),
      map((payload: OrderUpdatedPayload) => {
        return {
          data: payload,
          type: 'order_updated'
        } as MessageEvent;
      })
    );
  }
}
