import { MigrationInterface, QueryRunner } from 'typeorm'

type ColumnMigration = {
  table: string
  column: string
  nullable?: boolean
}

const uuidColumns: ColumnMigration[] = [
  { table: 'projects', column: 'managerId', nullable: true },
  { table: 'devices', column: 'projectId' },
  { table: 'work_orders', column: 'projectId' },
  { table: 'work_orders', column: 'deviceId', nullable: true },
  { table: 'work_orders', column: 'reporterId' },
  { table: 'work_orders', column: 'assigneeId', nullable: true },
  { table: 'repair_logs', column: 'orderId' },
  { table: 'repair_logs', column: 'engineerId' },
  { table: 'spare_parts', column: 'projectId' },
  { table: 'spare_part_logs', column: 'partId' },
  { table: 'spare_part_logs', column: 'orderId', nullable: true },
  { table: 'spare_part_logs', column: 'operatorId' },
  { table: 'inspection_plans', column: 'projectId' },
  { table: 'inspection_plans', column: 'assigneeId', nullable: true },
  { table: 'inspection_records', column: 'planId' },
  { table: 'inspection_records', column: 'inspectorId' },
  { table: 'inspection_records', column: 'orderId', nullable: true },
  { table: 'notifications', column: 'userId' },
]

function quoted(name: string) {
  return `"${name}"`
}

export class UseUuidForeignKeyColumns1780876800000 implements MigrationInterface {
  name = 'UseUuidForeignKeyColumns1780876800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return

    for (const item of uuidColumns) {
      await this.toUuid(queryRunner, item)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return

    for (const item of [...uuidColumns].reverse()) {
      await this.toVarchar(queryRunner, item)
    }
  }

  private async toUuid(queryRunner: QueryRunner, item: ColumnMigration) {
    const currentType = await this.columnType(queryRunner, item)
    if (currentType === 'uuid') return

    const table = quoted(item.table)
    const column = quoted(item.column)

    await queryRunner.query(`
      ALTER TABLE ${table}
      ALTER COLUMN ${column} TYPE uuid
      USING NULLIF(${column}, '')::uuid
    `)

    if (item.nullable) {
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`)
    } else {
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`)
    }
  }

  private async toVarchar(queryRunner: QueryRunner, item: ColumnMigration) {
    const currentType = await this.columnType(queryRunner, item)
    if (currentType === 'character varying') return

    const table = quoted(item.table)
    const column = quoted(item.column)

    await queryRunner.query(`
      ALTER TABLE ${table}
      ALTER COLUMN ${column} TYPE varchar
      USING ${column}::text
    `)

    if (item.nullable) {
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`)
    } else {
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`)
    }
  }

  private async columnType(queryRunner: QueryRunner, item: ColumnMigration): Promise<string | undefined> {
    const [row] = await queryRunner.query(
      `
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = $2
      `,
      [item.table, item.column],
    )

    return row?.data_type
  }
}
