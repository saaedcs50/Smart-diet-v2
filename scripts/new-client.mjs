// ============================================================================
// سكريبت توليد نسخة عميل جديد (White Label Automation)
// ============================================================================
// الاستخدام:
//   node scripts/new-client.mjs <اسم-العميل>
//   node scripts/new-client.mjs <اسم-العميل> --build
//   node scripts/new-client.mjs <اسم-العميل> --pin=48291 --build
//
// PIN لا يُكتب في brand.json أبدًا — فقط في .env.<slug> كـ COACH_PIN
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const slug = process.argv[2];
const shouldBuild = process.argv.includes('--build');
const pinArg = process.argv.find((a) => a.startsWith('--pin='));

if (!slug) {
  console.error('❌ لازم تحدد اسم العميل. مثال:');
  console.error('   node scripts/new-client.mjs dr-ahmed --build');
  console.error('   node scripts/new-client.mjs dr-ahmed --pin=48291 --build');
  process.exit(1);
}

const clientConfigPath = path.join(root, 'clients', `${slug}.json`);

if (!existsSync(clientConfigPath)) {
  console.error(`❌ الملف مش موجود: clients/${slug}.json`);
  console.error('   جهّزه الأول بنسخ clients/_template.json وتعبئته ببيانات العميل.');
  process.exit(1);
}

const clientConfig = JSON.parse(readFileSync(clientConfigPath, 'utf-8'));

const requiredFields = ['appName', 'shortName', 'doctorName', 'clinicName'];
const placeholderMarkers = ['اسم التطبيق للعميل', 'اسم مختصر', 'د. الاسم', 'اسم العيادة كامل'];

for (const field of requiredFields) {
  const value = clientConfig[field];
  if (!value || placeholderMarkers.includes(value)) {
    console.error(`❌ الحقل "${field}" في clients/${slug}.json لسه فاضي أو نص القالب الافتراضي.`);
    process.exit(1);
  }
}

const sessionSecret = crypto.randomBytes(32).toString('hex');
// رمز صريح: 5 أرقام على الأقل مقبولة، الأقصر مرفوض. التوليد التلقائي: 8 أرقام.
const pinArgRaw = pinArg ? pinArg.split('=')[1].trim() : '';
if (pinArg && pinArgRaw.length < 5) {
  console.error('❌ رمز PIN قصير: لازم 5 أرقام على الأقل.');
  process.exit(1);
}
const coachPin = pinArgRaw || String(crypto.randomInt(10000000, 99999999));

const brandOutput = {
  appName: clientConfig.appName,
  shortName: clientConfig.shortName,
  clinicName: clientConfig.clinicName,
  doctorName: clientConfig.doctorName,
  doctorNameAlt: clientConfig.doctorNameAlt || clientConfig.doctorName,
  specialistTitle: clientConfig.specialistTitle || 'أخصائي التغذية',
  specialistShort: clientConfig.specialistShort || 'الأخصائي',
  specialistTo: clientConfig.specialistTo || 'للأخصائي',
  description: clientConfig.description || '',
  themeColor: clientConfig.themeColor || '#5B2482',
  accentColor: clientConfig.accentColor || '#E21B6D',
  backgroundColor: clientConfig.backgroundColor || '#F8F7F9',
  // ملفات العملاء القديمة قد تفتقد الحقلين الجديدين — التعبئة بقيم Peacock
  tertiaryColor: clientConfig.tertiaryColor || '#70D6C5',
  tintColor: clientConfig.tintColor || '#CAE5BC',
  whatsapp: clientConfig.whatsapp || '',
  logoPath: clientConfig.logoPath || '/icon.svg',
};

writeFileSync(
  path.join(root, 'src/config/brand.json'),
  JSON.stringify(brandOutput, null, 2) + '\n',
  'utf-8'
);

const envContent = `# متغيرات بيئة خاصة بالعميل: ${slug}
# تم توليدها تلقائيًا في ${new Date().toISOString()}
# انقل القيم دي لإعدادات المتغيرات البيئية في Vercel وقت النشر.
# لا ترفع هذا الملف إلى Git.

NODE_ENV=production
SESSION_SECRET=${sessionSecret}
COACH_PIN=${coachPin}
APP_URL=
`;

const envPath = path.join(root, `.env.${slug}`);
writeFileSync(envPath, envContent, 'utf-8');

execSync('node scripts/apply-brand.mjs', { cwd: root, stdio: 'inherit' });

if (shouldBuild) {
  console.log(`\n🏗️  جاري بناء نسخة "${slug}"...`);
  execSync('npm run build', { cwd: root, stdio: 'inherit' });

  const clientDistDir = path.join(root, 'dist-clients', slug);
  mkdirSync(clientDistDir, { recursive: true });
  cpSync(path.join(root, 'dist'), clientDistDir, { recursive: true });
  console.log(`✅ الناتج جاهز في: dist-clients/${slug}/`);
}

console.log('\n' + '='.repeat(60));
console.log(`✅ نسخة العميل "${slug}" جاهزة`);
console.log('='.repeat(60));
console.log(`الاسم: ${brandOutput.appName} — ${brandOutput.doctorName}`);
console.log(`شعار PWA: ${brandOutput.logoPath}`);
console.log(`رمز PIN: ${coachPin}  (في .env.${slug} فقط — ليس في الواجهة)`);
console.log('\nالخطوات التالية:');
console.log(`  1. سلّم رمز PIN للعميل بطريقة آمنة.`);
console.log(`  2. انقل محتوى .env.${slug} لإعدادات البيئة في Vercel.`);
console.log(`  3. شعار: public/brands/${slug}.png ثم logoPath="/brands/${slug}.png"`);
if (!shouldBuild) {
  console.log(`  4. شغّل: node scripts/new-client.mjs ${slug} --build`);
}
console.log('  5. امسح ملف .env.' + slug + ' بعد نقل القيم.');
console.log('='.repeat(60) + '\n');
