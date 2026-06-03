import { randomBytes } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as bcrypt from 'bcryptjs'
import { DataSource } from 'typeorm'

function loadEnvFile(filename: string) {
  const envFile = path.resolve(__dirname, '../../../../', filename)
  if (!fs.existsSync(envFile)) return

  const envContent = fs.readFileSync(envFile, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=')
    if (key && !key.trim().startsWith('#') && values.length) {
      process.env[key.trim()] = values.join('=').trim().replace(/^['"]|['"]$/g, '')
    }
  })
}

loadEnvFile('.env')
loadEnvFile('.env.development')

const dbType = process.env.DB_TYPE || 'sqlite'
const entities = [path.resolve(__dirname, '../../modules/**/*.entity{.ts,.js}')]
const generatedAdminPassword = randomBytes(18).toString('base64url')
const adminPhone = process.env.SEED_ADMIN_PHONE || '13800000001'
const adminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || generatedAdminPassword

const AppDataSource = new DataSource(dbType === 'postgres' ? {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'lightops',
  username: process.env.DB_USER || 'lightops',
  password: process.env.DB_PASSWORD || '',
  entities,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
} : {
  type: 'sqlite',
  database: process.env.DB_DATABASE || 'lightops.sqlite',
  entities,
  synchronize: true,
})

async function runSeeds() {
  try {
    await AppDataSource.initialize()
    console.log('Database connected, running seeds...')

    const userRepo = AppDataSource.getRepository('users')
    const projectRepo = AppDataSource.getRepository('projects')

    let admin = await userRepo.findOne({ where: { phone: adminPhone } })
    if (!admin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      admin = userRepo.create({
        name: 'System Admin',
        phone: adminPhone,
        passwordHash,
        role: 'admin',
        projectIds: [],
        skillTags: [],
        isActive: true,
      })
      await userRepo.save(admin)
      console.log(`Admin user created: phone=${adminPhone}, password=${adminPassword}`)
      if (!process.env.SEED_ADMIN_PASSWORD && !process.env.INITIAL_ADMIN_PASSWORD) {
        console.log('A random one-time admin password was generated. Store it now.')
      }
    } else {
      console.log('Admin user already exists, skipping.')
    }

    const projectCount = await projectRepo.count()
    let project
    if (projectCount === 0) {
      project = projectRepo.create({
        name: 'W-LightOps Sample Project',
        venue: 'Main Theater',
        address: 'Sample address',
        status: 'active',
      })
      await projectRepo.save(project)
      console.log('Sample project created.')
    } else {
      project = await projectRepo.findOne({ where: {} })
    }

    const deviceRepo = AppDataSource.getRepository('devices')
    const deviceCount = await deviceRepo.count()
    if (deviceCount === 0 && project) {
      const dummyDevices = Array.from({ length: 5 }).map((_, index) => deviceRepo.create({
        deviceNo: `DEV-2026-${(index + 1).toString().padStart(4, '0')}`,
        name: index % 2 === 0 ? 'MA3 Console' : 'Martin MAC Viper',
        category: index % 2 === 0 ? '控台' : '灯具',
        manufacturer: 'MA/Martin',
        qrCode: `QR-2026-${(index + 1).toString().padStart(4, '0')}`,
        model: 'V1',
        projectId: project.id,
        location: 'Main Stage',
        status: index === 0 ? 'maintenance' : 'normal',
        healthScore: 100 - (index * 5),
      }))
      await deviceRepo.save(dummyDevices)
      console.log('Sample devices created.')
    }

    const orderRepo = AppDataSource.getRepository('work_orders')
    const orderCount = await orderRepo.count()
    if (orderCount === 0 && project && admin) {
      const dummyOrder = orderRepo.create({
        orderNo: 'WO-2026-0001',
        reporterId: admin.id,
        faultDesc: 'Main stage light failure: no response from DMX',
        priority: 'P1',
        status: 'pending',
        category: '故障维修',
        projectId: project.id,
      })
      await orderRepo.save(dummyOrder)
      console.log('Sample order created.')
    }

    console.log('Seeds completed successfully.')
    await AppDataSource.destroy()
  } catch (err) {
    console.error('Seed error:', err)
    process.exit(1)
  }
}

runSeeds()
