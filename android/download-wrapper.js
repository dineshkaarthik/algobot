#!/usr/bin/env node
/**
 * Downloads the gradle-wrapper.jar for Gradle 8.9
 * Run: node download-wrapper.js
 *
 * After running this script, you can delete it:
 *   del download-wrapper.js
 *   (or) rm download-wrapper.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const jarPath = path.join(__dirname, 'gradle', 'wrapper', 'gradle-wrapper.jar');

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
        download(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} from ${url}`));
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  // Ensure directory exists
  const dir = path.dirname(jarPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Try multiple sources
  const sources = [
    'https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar',
    'https://raw.githubusercontent.com/nicerobot/install-gradle/master/gradle-wrapper.jar',
    'https://github.com/nicerobot/install-gradle/raw/master/gradle-wrapper.jar',
  ];

  for (const url of sources) {
    try {
      console.log(`Trying: ${url}`);
      const data = await download(url);

      if (data.length < 10000) {
        console.log(`  WARNING: Downloaded only ${data.length} bytes, seems too small. Trying next source...`);
        continue;
      }

      fs.writeFileSync(jarPath, data);
      console.log(`  SUCCESS! Downloaded ${data.length} bytes to:`);
      console.log(`  ${jarPath}`);
      console.log('');
      console.log('Gradle wrapper is ready! You can now run:');
      console.log('  gradlew.bat tasks    (Windows cmd/PowerShell)');
      console.log('  ./gradlew tasks      (Git Bash / WSL)');
      return;
    } catch (err) {
      console.log(`  Failed: ${err.message}`);
    }
  }

  console.error('');
  console.error('ERROR: All download sources failed.');
  console.error('Please download gradle-wrapper.jar manually:');
  console.error(`  1. Go to: ${sources[0]}`);
  console.error(`  2. Save the file to: ${jarPath}`);
  process.exit(1);
}

main();
