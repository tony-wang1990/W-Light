import { MigrationInterface, QueryRunner } from 'typeorm'

export class ProjectScopedDeviceUniques1780531200000 implements MigrationInterface {
  name = 'ProjectScopedDeviceUniques1780531200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_deviceNo"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_qrCode"`)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_project_deviceNo_unique"
      ON devices ("projectId", "deviceNo")
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_project_qrCode_unique"
      ON devices ("projectId", "qrCode")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_project_qrCode_unique"`)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_project_deviceNo_unique"`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_deviceNo" ON devices ("deviceNo")`)
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_devices_qrCode" ON devices ("qrCode")`)
  }
}
