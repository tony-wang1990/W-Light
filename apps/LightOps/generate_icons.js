const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputImagePath = 'C:/Users/yatao/.gemini/antigravity/brain/02bb321c-bb6b-4d73-83b0-52664abea34b/w_light_app_icon_1780925120212.png';
const androidResPath = path.join(__dirname, 'android/app/src/main/res');

const mipmapSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generateIcons() {
  try {
    if (!fs.existsSync(inputImagePath)) {
      console.error('Input image not found:', inputImagePath);
      process.exit(1);
    }

    for (const [folder, size] of Object.entries(mipmapSizes)) {
      const folderPath = path.join(androidResPath, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Generate ic_launcher.png
      await sharp(inputImagePath)
        .resize(size, size)
        .toFile(path.join(folderPath, 'ic_launcher.png'));
        
      // Generate ic_launcher_round.png (circular mask)
      const circleSvg = `<svg><circle cx="${size/2}" cy="${size/2}" r="${size/2}" /></svg>`;
      const circleBuffer = Buffer.from(circleSvg);
      
      await sharp(inputImagePath)
        .resize(size, size)
        .composite([{ input: circleBuffer, blend: 'dest-in' }])
        .toFile(path.join(folderPath, 'ic_launcher_round.png'));

      console.log(`Generated icons for ${folder} (${size}x${size})`);
    }
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
