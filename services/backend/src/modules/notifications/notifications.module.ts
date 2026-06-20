import { Module, Controller, Get, Injectable, Put, Param, UseGuards, Request, Query } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { TypeOrmModule } from '@nestjs/typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { WorkOrder } from '../orders/entities/order.entity'
import { Notification } from './entities/notification.entity'

export { Notification } from './entities/notification.entity'

// ─── Service ──────────────────────────────────────────────────────────────────
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>) {}

  async create(data: Partial<Notification>) { return this.repo.save(this.repo.create(data)) }

  async findAll(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Number(page) || 1)
    const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20))
    const [items, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    })
    const unreadCount = await this.getUnreadCount(userId)
    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
      unreadCount,
    }
  }

  getUnreadCount(userId: string) {
    return this.repo.count({ where: { userId, isRead: false } })
  }

  markRead(id: string, userId: string) {
    return this.repo.update({ id, userId }, { isRead: true })
  }

  markAllRead(userId: string) {
    return this.repo.update({ userId, isRead: false }, { isRead: true })
  }
}

type NotificationTarget = {
  userId?: string
  title: string
  content: string
}

@Injectable()
export class OrderNotificationsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent('order.updated')
  async handleOrderUpdated(order: WorkOrder & { eventAction?: string }) {
    const targets = this.getTargets(order)
    const uniqueTargets = targets.filter((target, index) =>
      Boolean(target.userId) &&
      targets.findIndex(item => item.userId === target.userId && item.title === target.title) === index,
    )

    await Promise.all(uniqueTargets.map(target => this.notifications.create({
      userId: target.userId,
      type: 'order',
      title: target.title,
      content: target.content,
      refId: order.id,
      refType: 'order',
      isRead: false,
    })))
  }

  private getTargets(order: WorkOrder & { eventAction?: string }): NotificationTarget[] {
    const orderLabel = order.orderNo || order.id
    switch (order.eventAction) {
      case 'assign':
        return [{
          userId: order.assigneeId,
          title: '收到新工单',
          content: `工单 ${orderLabel} 已派给你，请及时处理。`,
        }]
      case 'accept':
        return [{
          userId: order.reporterId,
          title: '工单已接单',
          content: `工单 ${orderLabel} 已由工程师接单。`,
        }]
      case 'reject':
        return [{
          userId: order.reporterId,
          title: '工程师已拒单',
          content: `工单 ${orderLabel} 已被拒绝：${order.rejectReason || '未填写原因'}`,
        }]
      case 'suspend':
        return [{
          userId: order.reporterId,
          title: '工单已挂起',
          content: `工单 ${orderLabel} 已挂起：${order.rejectReason || '未填写原因'}`,
        }]
      case 'resume':
        return [{
          userId: order.reporterId,
          title: '工单已恢复处理',
          content: `工单 ${orderLabel} 已恢复处理。`,
        }]
      case 'submit':
        return [{
          userId: order.reporterId,
          title: '工单待验收',
          content: `工单 ${orderLabel} 已提交，请及时验收。`,
        }]
      case 'accept check':
        return [{
          userId: order.assigneeId,
          title: '工单已验收',
          content: `工单 ${orderLabel} 已通过验收并关闭。`,
        }]
      case 'reject check':
        return [{
          userId: order.assigneeId,
          title: '验收未通过',
          content: `工单 ${orderLabel} 验收未通过：${order.rejectReason || '未填写原因'}`,
        }]
      case 'cancel':
        return [{
          userId: order.assigneeId,
          title: '工单已取消',
          content: `工单 ${orderLabel} 已取消：${order.rejectReason || '未填写原因'}`,
        }]
      default:
        return []
    }
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────
@ApiTags('通知中心')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get() findAll(@Request() req, @Query('page') page = 1, @Query('pageSize') ps = 20) {
    return this.svc.findAll(req.user.id, +page, +ps)
  }

  @Get('unread-count') getUnreadCount(@Request() req) { return this.svc.getUnreadCount(req.user.id) }

  @Put(':id/read') markRead(@Param('id') id: string, @Request() req) { return this.svc.markRead(id, req.user.id) }

  @Put('read-all') markAllRead(@Request() req) { return this.svc.markAllRead(req.user.id) }
}

// ─── Module ───────────────────────────────────────────────────────────────────
import { SseController } from './sse.controller'

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController, SseController],
  providers: [NotificationsService, OrderNotificationsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
