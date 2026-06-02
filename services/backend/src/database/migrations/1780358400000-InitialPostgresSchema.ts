import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialPostgresSchema1780358400000 implements MigrationInterface {
  name = 'InitialPostgresSchema1780358400000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(50) NOT NULL,
        phone varchar(20) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        role varchar NOT NULL DEFAULT 'engineer',
        "projectIds" text NOT NULL DEFAULT '[]',
        "skillTags" text NOT NULL DEFAULT '[]',
        "avatarUrl" varchar,
        "fcmToken" varchar,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(100) NOT NULL,
        venue varchar(100),
        address text,
        "managerId" varchar,
        status varchar NOT NULL DEFAULT 'active',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "projectId" varchar NOT NULL,
        "deviceNo" varchar(50) NOT NULL,
        name varchar(100) NOT NULL,
        category varchar NOT NULL DEFAULT '灯具',
        model varchar(100),
        manufacturer varchar(100),
        location varchar(200),
        "qrCode" varchar(100) NOT NULL,
        "dmxAddress" integer,
        "channelCount" integer,
        power numeric(8, 2),
        "warrantyExpire" date,
        "installDate" date,
        status varchar NOT NULL DEFAULT 'normal',
        "healthScore" numeric(5, 2) NOT NULL DEFAULT 100,
        "lastMaintainAt" timestamp,
        "manualUrl" varchar,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "orderNo" varchar(30) NOT NULL,
        "projectId" varchar NOT NULL,
        "deviceId" varchar,
        "reporterId" varchar NOT NULL,
        "assigneeId" varchar,
        category varchar NOT NULL DEFAULT '故障维修',
        priority varchar NOT NULL DEFAULT 'P2',
        status varchar NOT NULL DEFAULT 'pending',
        "faultType" varchar(50),
        "faultDesc" text NOT NULL,
        "mediaUrls" text NOT NULL DEFAULT '[]',
        "locationDesc" varchar(200),
        "faultAt" timestamp,
        "assignedAt" timestamp,
        "startedAt" timestamp,
        "submittedAt" timestamp,
        "closedAt" timestamp,
        "slaDeadline" timestamp,
        "isOvertime" boolean NOT NULL DEFAULT false,
        "repairCost" numeric(10, 2),
        "rejectReason" text,
        "acceptanceNote" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS repair_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "orderId" varchar NOT NULL,
        "engineerId" varchar NOT NULL,
        "stepType" varchar(50) NOT NULL,
        "stepDesc" text NOT NULL,
        "photoUrls" text NOT NULL DEFAULT '[]',
        "outsourceVendor" varchar(100),
        "outsourceCost" numeric(10, 2),
        "partUsages" text NOT NULL DEFAULT '[]',
        "loggedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spare_parts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "projectId" varchar NOT NULL,
        name varchar(100) NOT NULL,
        model varchar(100),
        unit varchar(20) NOT NULL DEFAULT '个',
        stock numeric(10, 2) NOT NULL DEFAULT 0,
        "minStock" numeric(10, 2) NOT NULL DEFAULT 5,
        "unitPrice" numeric(10, 2),
        supplier varchar(100),
        "supplierPhone" varchar(20),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spare_part_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "partId" varchar NOT NULL,
        "opType" varchar NOT NULL,
        quantity numeric(10, 2) NOT NULL,
        "orderId" varchar,
        "operatorId" varchar NOT NULL,
        note text,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inspection_plans (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "projectId" varchar NOT NULL,
        name varchar(100) NOT NULL,
        frequency varchar NOT NULL DEFAULT 'daily',
        "deviceIds" text NOT NULL DEFAULT '[]',
        "assigneeId" varchar,
        "nextInspectionAt" timestamp,
        "isActive" integer NOT NULL DEFAULT 1,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inspection_records (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "planId" varchar NOT NULL,
        "inspectorId" varchar NOT NULL,
        status varchar NOT NULL DEFAULT 'normal',
        "resultDesc" text,
        "photoUrls" text NOT NULL DEFAULT '[]',
        "orderId" varchar,
        "inspectedAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" varchar NOT NULL,
        type varchar(50) NOT NULL,
        title varchar(100) NOT NULL,
        content text NOT NULL,
        "refId" varchar,
        "refType" varchar(50),
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `)

    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_phone" ON users (phone)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_projects_managerId" ON projects ("managerId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_deviceNo" ON devices ("deviceNo")`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_qrCode" ON devices ("qrCode")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_devices_projectId" ON devices ("projectId")`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_work_orders_orderNo" ON work_orders ("orderNo")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_work_orders_projectId" ON work_orders ("projectId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_work_orders_deviceId" ON work_orders ("deviceId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_work_orders_assigneeId" ON work_orders ("assigneeId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_repair_logs_orderId" ON repair_logs ("orderId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_spare_parts_projectId" ON spare_parts ("projectId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_spare_part_logs_partId" ON spare_part_logs ("partId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_spare_part_logs_orderId" ON spare_part_logs ("orderId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_inspection_plans_projectId" ON inspection_plans ("projectId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_inspection_records_planId" ON inspection_records ("planId")`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_userId" ON notifications ("userId")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return

    await queryRunner.query(`DROP TABLE IF EXISTS notifications`)
    await queryRunner.query(`DROP TABLE IF EXISTS inspection_records`)
    await queryRunner.query(`DROP TABLE IF EXISTS inspection_plans`)
    await queryRunner.query(`DROP TABLE IF EXISTS spare_part_logs`)
    await queryRunner.query(`DROP TABLE IF EXISTS spare_parts`)
    await queryRunner.query(`DROP TABLE IF EXISTS repair_logs`)
    await queryRunner.query(`DROP TABLE IF EXISTS work_orders`)
    await queryRunner.query(`DROP TABLE IF EXISTS devices`)
    await queryRunner.query(`DROP TABLE IF EXISTS projects`)
    await queryRunner.query(`DROP TABLE IF EXISTS users`)
  }
}
