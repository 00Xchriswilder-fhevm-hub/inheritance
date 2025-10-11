const fs = require('fs-extra');
const path = require('path');

const sourceDir = path.join(__dirname, '../packages/fhevm-sdk/dist');
const targetDir = path.join(__dirname, './templates/vue-template/fhevm-sdk/dist');

const sourcePackageJson = path.join(__dirname, '../packages/fhevm-sdk/package.json');
const targetPackageJson = path.join(__dirname, './templates/vue-template/fhevm-sdk/package.json');

async function copySdk() {
  try {
    await fs.remove(targetDir); // Ensure clean copy
    await fs.copy(sourceDir, targetDir);
    await fs.copy(sourcePackageJson, targetPackageJson);
    console.log('✅ FHEVM SDK copied successfully!');
  } catch (err) {
    console.error('❌ Error copying FHEVM SDK:', err);
  }
}

copySdk();
