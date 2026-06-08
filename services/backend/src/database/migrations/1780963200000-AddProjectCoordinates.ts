import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProjectCoordinates1780963200000 implements MigrationInterface {
  name = 'AddProjectCoordinates1780963200000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "latitude" double precision`)
    await queryRunner.query(`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "longitude" double precision`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "longitude"`)
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN IF EXISTS "latitude"`)
  }
}
