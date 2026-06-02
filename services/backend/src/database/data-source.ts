import 'reflect-metadata'
import { DataSource } from 'typeorm'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvFile(filename: string) {
  const filePath = path.resolve(process.cwd(), filename)
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) return

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  })
}

loadEnvFile('.env')
loadEnvFile(`.env.${process.env.NODE_ENV || 'development'}`)
loadEnvFile('.env.production')

const dbType = process.env.DB_TYPE || 'postgres'
const entities = [
  path.join(__dirname, '../modules/**/*.entity{.ts,.js}'),
  path.join(__dirname, '../modules/**/*.module{.ts,.js}'),
]
const migrations = [path.join(__dirname, 'migrations/*{.ts,.js}')]

const AppDataSource = new DataSource(dbType === 'sqlite'
  ? {
    type: 'sqlite',
    database: process.env.DB_DATABASE || 'lightops.sqlite',
    entities,
    migrations,
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
  }
  : {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'lightops',
    username: process.env.DB_USER || 'lightops',
    password: process.env.DB_PASSWORD || '',
    entities,
    migrations,
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  })

export default AppDataSource
