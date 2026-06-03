import { DataSource } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import * as path from 'path'

// Load .env manually without dotenv dependency
const fs = require('fs')
const envFile = path.resolve(__dirname, '../../../../.env.development')
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8')
  envContent.split('\n').forEach((line: string) => {
    const [key, ...vals] = line.split('=')
    if (key && !key.startsWith('#') && vals.length) {
      process.env[key.trim()] = vals.join('=').trim()
    }
  })
}


const dbType = 'sqlite';

const AppDataSource = new DataSource(dbType === 'sqlite' ? {
  type: 'sqlite',
  database: process.env.DB_DATABASE || 'lightops.sqlite',
  entities: [path.resolve(__dirname, '../../modules/**/*.entity{.ts,.js}')],
  synchronize: true,
} : {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'lightops',
  username: process.env.DB_USER || 'lightops',
  password: process.env.DB_PASSWORD || 'lightops_dev_pwd',
  entities: [path.resolve(__dirname, '../../modules/**/*.entity{.ts,.js}')],
  synchronize: true,
})

async function runSeeds() {
  try {
    await AppDataSource.initialize()
    console.log('Database connected, running seeds...')

    const userRepo = AppDataSource.getRepository('users')
    const projectRepo = AppDataSource.getRepository('projects')

    // 创建默认管理员
    let admin = await userRepo.findOne({ where: { phone: '13800000001' } })
    if (!admin) {
      const passwordHash = await bcrypt.hash('Admin@123', 10)
      admin = userRepo.create({
        name: '系统管理员',
        phone: '13800000001',
        passwordHash,
        role: 'admin',
        projectIds: [],
        skillTags: [],
        isActive: true,
      })
      await userRepo.save(admin)
      console.log('Admin user created: phone=13800000001, password=Admin@123')
    } else {
      console.log('Admin user already exists, skipping.')
    }

    // Seed Sample Project
    const projectCount = await projectRepo.count()
    let project;
    if (projectCount === 0) {
      project = projectRepo.create({
        name: 'W-LightOps Sample Project',
        venue: 'XX Grand Theater',
        address: '123 Main St',
        status: 'active',
      })
      await projectRepo.save(project)
      console.log('Sample project created.')
    } else {
      project = await projectRepo.findOne({ where: {} })
    }

    // Seed Dummy Devices
    const deviceRepo = AppDataSource.getRepository('devices')
    const deviceCount = await deviceRepo.count()
    if (deviceCount === 0) {
      const dummyDevices = Array.from({ length: 5 }).map((_, i) => deviceRepo.create({
        deviceNo: `DEV-2026-${(i + 1).toString().padStart(4, '0')}`,
        name: i % 2 === 0 ? 'MA3 全尺寸控台' : 'Martin MAC Viper',
        category: i % 2 === 0 ? '控台' : '灯具',
        manufacturer: 'MA/Martin',
        qrCode: `QR-2026-${(i + 1).toString().padStart(4, '0')}`,
        model: 'V1',
        projectId: project.id,
        location: 'Main Stage',
        status: i === 0 ? 'maintenance' : 'normal',
        healthScore: 100 - (i * 5),
      }))
      await deviceRepo.save(dummyDevices)
      console.log('Sample devices created.')
    }

    // Seed Dummy Orders
    const orderRepo = AppDataSource.getRepository('work_orders')
    const orderCount = await orderRepo.count()
    if (orderCount === 0) {
      const dummyOrder = orderRepo.create({
        orderNo: 'WO-2026-0001',
        reporterId: admin.id,
        faultDesc: 'Main stage light failure: No response from DMX',
        priority: 'P1',
        status: 'pending',
        category: '故障维修',
        projectId: project.id,
      })
      await orderRepo.save(dummyOrder)
      console.log('Sample order created.')
    }

    console.log('Seeds completed successfully!')
    await AppDataSource.destroy()
  } catch (err) {
    console.error('Seed error:', err)
    process.exit(1)
  }
}

runSeeds()
