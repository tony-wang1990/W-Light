import { QueryRunner } from 'typeorm'
import { InitialPostgresSchema1780358400000 } from './1780358400000-InitialPostgresSchema'
import { AddWorkOrderSequences1780444800000 } from './1780444800000-AddWorkOrderSequences'
import { ProjectScopedDeviceUniques1780531200000 } from './1780531200000-ProjectScopedDeviceUniques'
import { UseUuidForeignKeyColumns1780876800000 } from './1780876800000-UseUuidForeignKeyColumns'

type QueryResultResolver = (sql: string, params?: unknown[]) => unknown

function createQueryRunner(type = 'postgres', resolver?: QueryResultResolver) {
  const queries: Array<{ sql: string; params?: unknown[] }> = []
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params })
    return resolver ? resolver(sql, params) : []
  })

  return {
    queryRunner: {
      connection: { options: { type } },
      query,
    } as unknown as QueryRunner,
    queries,
  }
}

function flattenSql(queries: Array<{ sql: string }>) {
  return queries.map(item => item.sql.replace(/\s+/g, ' ').trim()).join('\n')
}

describe('database migrations', () => {
  const migrations = [
    InitialPostgresSchema1780358400000,
    AddWorkOrderSequences1780444800000,
    ProjectScopedDeviceUniques1780531200000,
    UseUuidForeignKeyColumns1780876800000,
  ]

  it('keeps migration timestamps strictly increasing and matching class names', () => {
    const timestamps = migrations.map(MigrationClass => {
      const instance = new MigrationClass()
      const timestamp = Number(instance.name.match(/(\d+)$/)?.[1])

      expect(instance.name).toContain(MigrationClass.name.replace(/\d+$/, ''))
      expect(timestamp).toBeGreaterThan(0)
      expect(typeof instance.up).toBe('function')
      expect(typeof instance.down).toBe('function')

      return timestamp
    })

    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b))
    expect(new Set(timestamps).size).toBe(timestamps.length)
  })

  it('creates the initial Postgres schema with required operational tables and indexes', async () => {
    const migration = new InitialPostgresSchema1780358400000()
    const { queryRunner, queries } = createQueryRunner()

    await migration.up(queryRunner)

    const sql = flattenSql(queries)
    ;[
      'CREATE TABLE IF NOT EXISTS users',
      'CREATE TABLE IF NOT EXISTS projects',
      'CREATE TABLE IF NOT EXISTS devices',
      'CREATE TABLE IF NOT EXISTS work_orders',
      'CREATE TABLE IF NOT EXISTS repair_logs',
      'CREATE TABLE IF NOT EXISTS spare_parts',
      "unit varchar(20) NOT NULL DEFAULT '个'",
      'CREATE TABLE IF NOT EXISTS spare_part_logs',
      'CREATE TABLE IF NOT EXISTS inspection_plans',
      'CREATE TABLE IF NOT EXISTS inspection_records',
      'CREATE TABLE IF NOT EXISTS notifications',
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_work_orders_orderNo"',
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_deviceNo"',
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_qrCode"',
    ].forEach(expected => expect(sql).toContain(expected))
  })

  it('creates and drops the work order sequence table used by concurrent order numbers', async () => {
    const migration = new AddWorkOrderSequences1780444800000()
    const runner = createQueryRunner()

    await migration.up(runner.queryRunner)
    const sql = flattenSql(runner.queries)

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS work_order_sequences')
    expect(sql).toContain('"dateKey" varchar(8) PRIMARY KEY')
    expect(sql).toContain('value integer NOT NULL DEFAULT 0')

    const downRunner = createQueryRunner()
    await migration.down(downRunner.queryRunner)
    expect(flattenSql(downRunner.queries)).toContain('DROP TABLE IF EXISTS work_order_sequences')
  })

  it('replaces global device unique indexes with project scoped unique indexes', async () => {
    const migration = new ProjectScopedDeviceUniques1780531200000()
    const runner = createQueryRunner()

    await migration.up(runner.queryRunner)

    const sql = flattenSql(runner.queries)
    expect(sql).toContain('DROP INDEX IF EXISTS "IDX_devices_deviceNo"')
    expect(sql).toContain('DROP INDEX IF EXISTS "IDX_devices_qrCode"')
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_project_deviceNo_unique"')
    expect(sql).toContain('ON devices ("projectId", "deviceNo")')
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_project_qrCode_unique"')
    expect(sql).toContain('ON devices ("projectId", "qrCode")')

    const downRunner = createQueryRunner()
    await migration.down(downRunner.queryRunner)

    const downSql = flattenSql(downRunner.queries)
    expect(downSql).toContain('DROP INDEX IF EXISTS "IDX_devices_project_qrCode_unique"')
    expect(downSql).toContain('DROP INDEX IF EXISTS "IDX_devices_project_deviceNo_unique"')
    expect(downSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_deviceNo"')
    expect(downSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_qrCode"')
  })

  it('converts legacy varchar foreign key columns to uuid safely and can revert them', async () => {
    const migration = new UseUuidForeignKeyColumns1780876800000()
    const varcharRunner = createQueryRunner('postgres', () => [{ data_type: 'character varying' }])

    await migration.up(varcharRunner.queryRunner)

    const upSql = flattenSql(varcharRunner.queries)
    ;[
      'ALTER TABLE "devices" ALTER COLUMN "projectId" TYPE uuid USING NULLIF("projectId", \'\')::uuid',
      'ALTER TABLE "work_orders" ALTER COLUMN "deviceId" TYPE uuid USING NULLIF("deviceId", \'\')::uuid',
      'ALTER TABLE "repair_logs" ALTER COLUMN "orderId" TYPE uuid USING NULLIF("orderId", \'\')::uuid',
      'ALTER TABLE "spare_parts" ALTER COLUMN "projectId" TYPE uuid USING NULLIF("projectId", \'\')::uuid',
      'ALTER TABLE "inspection_records" ALTER COLUMN "orderId" TYPE uuid USING NULLIF("orderId", \'\')::uuid',
      'ALTER TABLE "notifications" ALTER COLUMN "userId" TYPE uuid USING NULLIF("userId", \'\')::uuid',
    ].forEach(expected => expect(upSql).toContain(expected))
    expect(upSql).toContain('ALTER TABLE "work_orders" ALTER COLUMN "deviceId" DROP NOT NULL')
    expect(upSql).toContain('ALTER TABLE "repair_logs" ALTER COLUMN "orderId" SET NOT NULL')

    const uuidRunner = createQueryRunner('postgres', () => [{ data_type: 'uuid' }])
    await migration.down(uuidRunner.queryRunner)

    const downSql = flattenSql(uuidRunner.queries)
    expect(downSql).toContain('ALTER TABLE "notifications" ALTER COLUMN "userId" TYPE varchar USING "userId"::text')
    expect(downSql).toContain('ALTER TABLE "devices" ALTER COLUMN "projectId" TYPE varchar USING "projectId"::text')
  })

  it('does not run Postgres-only migrations against sqlite', async () => {
    const migration = new InitialPostgresSchema1780358400000()
    const { queryRunner, queries } = createQueryRunner('sqlite')

    await migration.up(queryRunner)
    await migration.down(queryRunner)

    expect(queries).toEqual([])
  })
})
