/**
 * Private Key Format Fixer
 * 
 * This script helps you format your Google private key correctly for .env file
 * 
 * Usage:
 * 1. Save your private key from the JSON file to a temporary file: temp-key.txt
 * 2. Run: node fix-private-key.js
 * 3. Copy the output and paste it into your .env file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔧 Private Key Format Fixer\n');
console.log('This script will help you format your Google private key correctly.\n');

// Method 1: Read from JSON file if it exists
const jsonPath = path.join(__dirname, 'service-account.json');
if (fs.existsSync(jsonPath)) {
    console.log('✅ Found service-account.json\n');

    try {
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        console.log('Copy these lines to your .env file:\n');
        console.log('='.repeat(80));
        console.log(`GOOGLE_SERVICE_ACCOUNT_EMAIL=${jsonData.client_email}`);
        console.log(`GOOGLE_PRIVATE_KEY="${jsonData.private_key}"`);
        console.log('='.repeat(80));
        console.log('\n✅ Done! Copy the lines above to your .env file\n');

    } catch (err) {
        console.error('❌ Error reading JSON file:', err.message);
    }
} else {
    console.log('📝 Method 1: Using service-account.json (RECOMMENDED)');
    console.log('---------------------------------------------------');
    console.log('1. Download your service account JSON key from Google Cloud Console');
    console.log('2. Save it as "service-account.json" in this directory');
    console.log('3. Run this script again: node fix-private-key.js\n');

    console.log('📝 Method 2: Manual Copy-Paste');
    console.log('-------------------------------');
    console.log('If you have the JSON content, here\'s what to do:\n');
    console.log('1. Open your service-account JSON file');
    console.log('2. Find the "private_key" field');
    console.log('3. Copy the ENTIRE value including the quotes and \\n characters');
    console.log('   Example: "-----BEGIN PRIVATE KEY-----\\nMIIEv...\\n-----END PRIVATE KEY-----\\n"');
    console.log('4. In your .env file, add it like this:\n');
    console.log('   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEv...\\n-----END PRIVATE KEY-----\\n"\n');
    console.log('⚠️  IMPORTANT: Keep the \\n as TWO characters (backslash + n), not actual line breaks!\n');
}

// Show current .env status
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log('📄 Current .env file check:');
    console.log('---------------------------');

    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    const keyLine = lines.find(line => line.startsWith('GOOGLE_PRIVATE_KEY='));

    if (keyLine) {
        const hasQuotes = keyLine.includes('"');
        const hasEscapedNewlines = keyLine.includes('\\n');
        const hasBegin = keyLine.includes('BEGIN PRIVATE KEY');

        console.log(`✓ GOOGLE_PRIVATE_KEY found: ${hasQuotes ? '✅' : '❌'} Has quotes`);
        console.log(`  ${hasEscapedNewlines ? '✅' : '❌'} Has \\n escape sequences`);
        console.log(`  ${hasBegin ? '✅' : '❌'} Has BEGIN PRIVATE KEY header`);

        if (!hasQuotes || !hasEscapedNewlines || !hasBegin) {
            console.log('\n⚠️  Your private key format needs to be fixed!');
        }
    } else {
        console.log('❌ GOOGLE_PRIVATE_KEY not found in .env file');
    }

    console.log('');
}