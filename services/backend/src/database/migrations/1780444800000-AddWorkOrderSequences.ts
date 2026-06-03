import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkOrderSequences1780444800000 implements MigrationInterface {
  name = 'AddWorkOrderSequences1780444800000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS work_order_sequences (
        "dateKey" varchar(8) PRIMARY KEY,
        value integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') return

    await queryRunner.query(`DROP TABLE IF EXISTS work_order_sequences`)
  }
}
