import { Module, Controller, Get, Post, Put, Param, Body, UseGuards, Request, Query } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() userId: string
  @Column({ length: 50 }) type: string
  @Column({ length: 100 }) title: string
  @Column({ type: 'text' }) content: string
  @Column({ nullable: true }) refId?: string
  @Column({ length: 50, nullable: true }) refType?: string
  @Column({ default: false }) isRead: boolean
  @CreateDateColumn() createdAt: Date
}

// ─── Service ──────────────────────────────────────────────────────────────────
class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>) {}

  async create(data: Partial<Notification>) { return this.repo.save(this.repo.create(data)) }

  findAll(userId: string, page = 1, pageSize = 20) {
    return this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
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
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
