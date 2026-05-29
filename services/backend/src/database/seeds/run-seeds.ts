import { DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'
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


const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'lightops',
  username: process.env.DB_USER || 'lightops',
  password: process.env.DB_PASSWORD || 'lightops_dev_pwd',
  entities: [path.resolve(__dirname, '../modules/**/*.entity{.ts,.js}')],
  synchronize: true,
})

async function runSeeds() {
  try {
    await AppDataSource.initialize()
    console.log('Database connected, running seeds...')

    const userRepo = AppDataSource.getRepository('users')
    const projectRepo = AppDataSource.getRepository('projects')

    // 创建默认管理员
    const existing = await userRepo.findOne({ where: { phone: '13800000001' } })
    if (!existing) {
      const passwordHash = await bcrypt.hash('Admin@123', 10)
      const admin = userRepo.create({
        name: '超级管理员',
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

    // 创建示例项目
    const projectCount = await projectRepo.count()
    if (projectCount === 0) {
      const project = projectRepo.create({
        name: '示例文旅项目',
        venue: 'XX文化旅游景区',
        address: '广东省广州市示例路1号',
        status: 'active',
      })
      await projectRepo.save(project)
      console.log('Sample project created.')
    }

    console.log('Seeds completed successfully!')
    await AppDataSource.destroy()
  } catch (err) {
    console.error('Seed error:', err)
    process.exit(1)
  }
}

runSeeds()
