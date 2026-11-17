# المرحلة صفر — خط الأساس وجرد اعتماد Vercel

> تاريخ المراجعة: 17 نوفمبر 2026  
> المستودع: `saaedcs50/Smart-diet-v2`  
> الفرع المرجعي: `main`  
> Commit المرجعي: `8d48f7d782236e78b011a9033f84a89578c70a9c`  
> النطاق: جرد ساكن فقط. لم تُعدّل شيفرة التطبيق أو قواعد البيانات أو إعدادات الخدمات أو متغيرات الإنتاج.

## 1. النتيجة التنفيذية

**اكتمل جرد المرحلة صفر.** أصبح لدينا خط أساس موثق لمسارات API الفعلية، ومستدعيها داخل الواجهة، ونقاط دخول Node/Vercel، ومتغيرات البيئة، وخدمات Supabase، والنشر والرجوع.

النتيجة الأساسية: التطبيق ليس مرتبطًا بمنطق أعمال خاص بـ Vercel، لكنه ما زال يُنشر حاليًا عبر تكامل Git مع Vercel ويدخل API من خلال Vercel Function في `api/index.ts`. توجد بالفعل طبقة Express مشتركة ومدخل Node مستقل في `server.ts`، لكن هذا لا يثبت أن تشغيل التطبيق خارج Vercel جاهز دون تعديلات. ما زالت هناك نقاط تهيئة يجب معالجتها قبل الانتقال، وأبرزها `PORT` الثابت، واعتماد استدعاء API على المسار النسبي `/api/coach-session`، واختلاف متغيرات Preview عن Production.

لم يتم تنفيذ أي فصل للخادم أو نقل للاستضافة في هذه المرحلة.

## 2. خط الأساس والنشر الحالي

| البند | الحالة المرصودة |
|---|---|
| مستودع GitHub | `saaedcs50/Smart-diet-v2` |
| الفرع الأساسي | `main` |
| Commit الحالي عند بدء المراجعة | `8d48f7d782236e78b011a9033f84a89578c70a9c` |
| Commit السابق المباشر | `7495ce0756c0d4d6453ee737d69723d2f73b991e` |
| مشروع Vercel | `smart-diet-v2` |
| Vercel Project ID | `prj_cNx5MB1hm32kA3ZImXqh2iGBz1xM` |
| نطاق Production المتصل والمتحقق | `smart-diet-v2.vercel.app` |
| نطاق API | لا يوجد نطاق API منفصل مرصود؛ API حاليًا على نفس الأصل تحت `/api` |
| آخر Production Deployment | `dpl_Ev8feNhzBPmgGYjhYUr24qVVjeTm` — `READY` |
| Commit المنشور في Production | يطابق Commit الحالي على `main` أعلاه |
| إعداد Node في Vercel | `24.x` |
| Rollback مرصود | آخر نشر Production السابق: `dpl_6rxbJoohyDxC3vRqFEDx4b5c2ioQ`، Commit `7495ce0756c0d4d6453ee737d69723d2f73b991e`، حالته `READY` |
| حماية `main` | غير مفعّلة؛ لا توجد Required Status Checks مفروضة على الفرع |

### فحص الصحة الفعلي

- الصفحة `https://smart-diet-v2.vercel.app/` فتحت بنجاح وأرجعت محتوى الواجهة العربية.
- المسار `https://smart-diet-v2.vercel.app/api/health` أرجع `{"status":"ok"}`.
- مسار الصحة على أحدث Preview مفحوص، `/api/health` على النشر `dpl_Fngh3hwM4W4G8SoTJo3tmeGgWyT8`، أعاد HTTP 500.
- إعدادات Preview المرصودة لا تتضمن `COACH_PIN` أو `SESSION_SECRET`، بينما `api/index.ts` يشغّل `validateSecurityConfig()` عند تحميل Function، و`src/server/api.ts` يرفض غيابهما عندما تكون `NODE_ENV=production`. هذا تفسير مرجّح للتعارض، لكنه **ليس سببًا جذريًا مثبتًا**؛ لم تُرجع سجلات Vercel المتاحة سجلات طلبات ضمن نافذة الاحتفاظ.

يجب إصلاح أو تفسير فشل Preview قبل الاعتماد عليه كبيئة تحقق للمرحلة التالية. لم أغيّر متغيرات Preview في المرحلة صفر.

## 3. خريطة نقاط دخول الخادم واعتماد Vercel

| المسار / الملف | الوظيفة الحالية | نوع الاعتماد | قرار العزل / المعالجة |
|---|---|---|---|
| `api/index.ts` | مدخل Vercel Function؛ ينشئ Express app، يضبط `trust proxy=1`، يتحقق من إعدادات الأمان، ثم يركّب `apiRouter` | Vercel Function convention | إبقاؤه Adapter مؤقتًا أثناء الانتقال؛ لا تنقل منطق الأعمال إليه |
| `src/server/api.ts` | تعريف Express router ومسارات Health وCoach Session، والتحقق من PIN وتوقيع/إبطال الجلسات | Express + Node crypto | طبقة مشتركة قابلة لإعادة الاستخدام خارج Vercel |
| `src/server/coachGuardStore.ts` | تخزين محاولات PIN والإبطال في الذاكرة محليًا أو Upstash Redis REST | Upstash REST عبر `fetch`؛ لا يعتمد على Vercel SDK | الإبقاء على الواجهة الحالية للمخزن؛ التأكد من ضبط Redis في بيئة الخادم الجديدة |
| `server.ts` | مدخل Node مستقل؛ يركّب API ويخدم Vite في التطوير وملفات `dist` في الإنتاج | Node + Express | أساس صالح لفصل الاستضافة، مع ضرورة جعل المنفذ من `process.env.PORT` بدل القيمة الثابتة 3000، ومراجعة `trust proxy` |
| `package.json` | يبني Vite ثم يجمّع `server.ts` إلى `dist/server.cjs` | Node 24 / Vite / esbuild | لا توجد حزمة `@vercel/*` ضمن dependencies أو devDependencies؛ لا توجد تبعية SDK خاصة بـ Vercel مثبتة |
| `vercel.json` | يحدد `npm run build` و`dist` ويحوّل `/api/(.*)` إلى `/api` ثم يحوّل بقية المسارات إلى `/index.html` | إعدادات توجيه ونشر Vercel | إعداد نشر خاص بالمنصة؛ لا يمثل منطق التطبيق ويجب ألا يُستخدم كبديل لإعداد الخادم المستقل |
| `.github/workflows/quality.yml` | CI: فحص الأنواع وESLint والاختبارات والبناء وفحص الاعتماديات والأسرار وRLS | GitHub Actions | مستقل عن Vercel في جوهره؛ يبقى خط الجودة قبل وبعد النقل |

**ملاحظة مهمة:** البناء ينتج `dist/server.cjs` بالفعل، لكن إعداد `vercel.json` ومسار `api/index.ts` يثبتان أن Vercel يستقبل API عبر Function adapter. لا يوجد دليل في إعداد Vercel الحالي على أن `server.cjs` هو العملية التي تشغّل API على Vercel. لا ينبغي الخلط بين «إنتاج ملف Node مستقل» و«تشغيله فعليًا على بيئة خارج Vercel».

### إعدادات البناء والتشغيل

- `package.json.engines.node = 24.x`.
- `build = vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/server.cjs`.
- `start = node dist/server.cjs`.
- `dev = tsx server.ts`.
- `server.ts` يحدد `const PORT = 3000` ولا يقرأ `process.env.PORT`. هذا مانع نقل مباشر لكثير من منصات تشغيل Node التي تخصص المنفذ عبر البيئة.
- كل من `api/index.ts` و`server.ts` يضبط `app.set('trust proxy', 1)`. يجب مطابقة عدد البروكسيات الموثوقة مع البنية الجديدة وعدم تعميم هذا الافتراض دون فحص.

## 4. خريطة جميع مسارات API التي عُثر عليها

المسارات معرفة في `src/server/api.ts`:

| HTTP | المسار | المعالج | الغرض |
|---|---|---|---|
| GET | `/health` | `handleHealth` | فحص صحة بسيط |
| GET | `/api/health` | `handleHealth` | فحص الصحة خلف مسار Vercel الحالي |
| POST | `/coach-session` | `handleCreateSession` | التحقق من PIN وإنشاء جلسة موقعة |
| POST | `/api/coach-session` | `handleCreateSession` | المسار الذي تستخدمه الواجهة حاليًا |
| DELETE | `/coach-session` | `handleDeleteSession` | إبطال الجلسة |
| DELETE | `/api/coach-session` | `handleDeleteSession` | المسار الذي تستخدمه الواجهة حاليًا |

لم يظهر Router آخر في مدخل API أو ملفات الخادم التي تمت مراجعتها.

### مستدعو API في الواجهة

| الملف | الاستدعاء | التفاصيل |
|---|---|---|
| `src/utils/coachServer.ts` | POST `/api/coach-session` | يرسل PIN في JSON body؛ مهلة الطلب 5 ثوانٍ؛ يتعامل مع 403 و429 وفشل الاتصال |
| `src/utils/coachServer.ts` | DELETE `/api/coach-session` | يرسل رمز الجلسة في ترويسة `x-coach-session` |
| `src/components/coach/CoachPinGate.tsx` | يستخدم `createCoachServerSession` | إعداد أول PIN والتحقق من الخادم |
| `src/components/PinModal.tsx` | يستخدم `createCoachServerSession` | إعداد PIN / التحقق قبل نجاح الدخول |

كلا استدعاءي API يستخدمان مسارًا نسبيًا من نفس الأصل، وليس عنوان Backend مستقلًا. لا يوجد `VITE_API_BASE_URL` في `.env.example` أو في متغيرات مشروع Vercel التي تمت مراجعتها. عند فصل API إلى نطاق مستقل، سيلزم تحديد عنوانه أو وضع Reverse Proxy يحافظ على `/api`.

### سلوك الحماية المرتبط بالجلسة

- الخادم يستخدم HMAC-SHA256 لتوقيع الجلسات، ومدة الجلسة ساعة واحدة.
- مقارنة PIN تستخدم hash مع `timingSafeEqual`.
- مخزن الحماية الدائم يستخدم Upstash Redis REST من خلال `fetch` فقط.
- خمس محاولات فاشلة تؤدي إلى قفل أولي 5 دقائق، مع تصاعد حتى سقف 60 دقيقة.
- في Production، غياب متغيري Upstash يؤدي إلى فشل مغلق `GuardUnavailableError` بدل العودة الصامتة لمخزن الذاكرة.
- `SESSION_SECRET` و`COACH_PIN` مطلوبان عند تشغيل `validateSecurityConfig()` في بيئة الإنتاج.
- العميل يحفظ رمز الجلسة في localStorage ويرسله في ترويسة `x-coach-session` عند الإبطال. لم يظهر اعتماد جلسة Coach على Cookie في الملفات التي تمت مراجعتها.
- لا يوجد CORS middleware في مداخل Express التي تمت مراجعتها؛ التشغيل الحالي Same-Origin. النقل إلى نطاق API مختلف يحتاج سياسة CORS محددة للأصول المسموح بها، وليس فتحًا عامًا افتراضيًا.
- `VITE_COACH_LOCAL_ONLY` موجود في إعدادات Vercel بالقيمة `true`، لكن التنفيذ في `src/utils/coachAuth.ts` لا يسمح به إلا إذا كان `import.meta.env.DEV === true`. لذلك لا ينبغي اعتباره مسار تجاوز فعّالًا في Production. تعليق المتغير في Vercel يقول إن API متوقف؛ التعليق قديم/مضلل مقارنةً بالكود الحالي وفحص Production الحالي.

## 5. خريطة Supabase الحالية

| البيئة | مشروع Supabase | Project Ref | الحالة | استخدام Vercel |
|---|---|---|---|---|
| Production | `smart-diet-platform` | `lhjyshlxbsnesayivxpb` | `ACTIVE_HEALTHY` | `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` على Production |
| Preview / Staging | `smart-diet-v2-staging` | `dubevgijagqjgwcibqeo` | `ACTIVE_HEALTHY` | قيم منفصلة لـ `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` على Preview |

- `src/platform/supabase.ts` ينشئ Supabase client مركزيًا من متغيرات Vite، ويحتفظ بنسخة cached. لا يحتوي الملف على رابط مشروع hard-coded.
- `src/platform/auth.tsx` يستخدم Supabase Auth عبر البريد/كلمة المرور وGoogle OAuth، ويقرأ ملف المستخدم من `profiles`.
- رابط OAuth يعاد توجيهه إلى `window.location.origin + '/platform'`. هذا لا يثبت اعتمادًا على نطاق Vercel ثابت داخل الشيفرة، لكنه يعني أن النطاق الجديد يجب إضافته إلى قائمة Redirect URLs المسموحة في إعدادات Supabase Auth.
- وظيفة Edge Function باسم `notify` موجودة ونشطة في المشروعين: Production إصدار 5 وStaging إصدار 1، والتحقق من JWT مفعّل في كليهما.
- الشيفرة الحالية لوظيفة `supabase/functions/notify/index.ts` تقرأ `SUPABASE_URL` و`SUPABASE_ANON_KEY` و`SUPABASE_SERVICE_ROLE_KEY` من `Deno.env`. وتستدعي RPC باسم `get_push_signing_config` للحصول على مفاتيح VAPID من إعداد التوقيع المحمي؛ لا تقرأ `VAPID_PRIVATE_KEY` أو `VAPID_SUBJECT` مباشرة من البيئة في الجزء الحالي من الشيفرة.
- يوجد تعارض توثيقي يحتاج تسوية لاحقًا: `.env.example` ما زال يضع `VAPID_PRIVATE_KEY` و`VAPID_SUBJECT` ضمن أسرار Edge Function، في حين أن التنفيذ الحالي يحصل على إعداد VAPID من RPC. لا نغيّر أسرار Supabase في المرحلة صفر.

## 6. سجل متغيرات البيئة

لم تُقرأ أو تُعرض قيم الأسرار. الجدول يسجل الأسماء، نطاق استخدامها، وما رُصد في إعدادات Vercel أو ملفات المشروع فقط.

### متغيرات Frontend العامة (تدخل في بناء المتصفح)

| الاسم | الاستخدام | النطاق المرصود |
|---|---|---|
| `VITE_SUPABASE_URL` | عنوان Supabase | Production يشير إلى مشروع الإنتاج؛ Preview يشير إلى مشروع Staging |
| `VITE_SUPABASE_ANON_KEY` | مفتاح Supabase العام للمتصفح | قيمة منفصلة حسب البيئة |
| `VITE_VAPID_PUBLIC_KEY` | مفتاح VAPID العام لتسجيل Web Push | Production وPreview |
| `VITE_PLATFORM_ENABLED` | تفعيل واجهة المنصة | Production وPreview |
| `VITE_COACH_LOCAL_ONLY` | علم بناء خاص بمسار PIN المحلي | موجود في Vercel لـ Production وPreview؛ الكود يقيّده بوضع DEV، لذا لا يُعتمد عليه في Production |

### أسرار Backend فقط

| الاسم | الاستخدام | النطاق المرصود |
|---|---|---|
| `COACH_PIN` | PIN الخادم الخاص ببوابة الأخصائي | Production فقط في إعدادات Vercel المرصودة |
| `SESSION_SECRET` | HMAC لتوقيع جلسات الأخصائي | Production فقط في إعدادات Vercel المرصودة |
| `UPSTASH_REDIS_REST_URL` | نقطة اتصال Redis لحماية PIN وإبطال الرموز | Production وPreview |
| `UPSTASH_REDIS_REST_TOKEN` | رمز مصادقة Redis | Production وPreview |

**ملاحظة تشغيلية:** عدم وجود `COACH_PIN` و`SESSION_SECRET` ضمن Preview لا يتوافق بوضوح مع تحقق إعدادات الأمان عند تحميل API إذا كان Runtime Preview يعمل مع `NODE_ENV=production`. فشل `/api/health` في Preview موثق أعلاه، ويجب حسمه قبل اعتبار Preview صالحة لاختبار الخادم.

### متغيرات Supabase Edge Function

| الاسم | طبيعة الاستخدام وفق المصدر |
|---|---|
| `SUPABASE_URL` | يقرأه كود `notify` من `Deno.env` |
| `SUPABASE_ANON_KEY` | يقرأه كود `notify` من `Deno.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | سر إداري يقرأه كود `notify` من `Deno.env` |
| إعداد VAPID عبر `get_push_signing_config` | يُحمّل عبر RPC من إعداد توقيع محمي؛ لا يُعامل كمفتاح Frontend |
| `VAPID_PRIVATE_KEY` و`VAPID_SUBJECT` | مذكوران في `.env.example` كأسرار Edge Function، لكنهما غير مقروءين مباشرة في تنفيذ `notify` الحالي؛ التوثيق يحتاج تحديثًا بعد مطابقة إعداد Vault/SQL |

### متغير قديم

- `LEGACY_UNUSED_PUSH_KEY` ما زال موجودًا في Vercel لكل البيئات. تعليقه يقول إنه متقاعد وفارغ عمدًا بعد الانتقال إلى Web Push، لكن Metadata في Vercel تعرض له تحذير `readable-secret`. لا نستنتج من هذا وحده أن سرًا فعّالًا مكشوف، ولا نحذف المتغير قبل مراجعة المصدر وتأكيد عدم وجود مستهلك له.

## 7. تكاملات Vercel وما يجب عزله

| الاعتماد | هل هو اعتماد على Vercel؟ | المعالجة المطلوبة في مرحلة التنفيذ اللاحقة |
|---|---|---|
| Git-to-Vercel auto deployment | نعم، تشغيل/توزيع | استبداله أو الإبقاء عليه كمسار نشر اختياري وفق خطة النقل |
| `api/index.ts` | نعم، طريقة اكتشاف Function | تشغيل Express app المستقل خارج Vercel مع الحفاظ على router المشترك |
| `vercel.json` rewrites | نعم، توجيه خاص بالمنصة | نقل سلوك SPA و`/api` إلى إعدادات المضيف الجديد أو Reverse Proxy |
| `@vercel/*` SDK | غير موجود في package.json | لا يوجد SDK مثبت يحتاج استبدالًا |
| Express router `src/server/api.ts` | لا | قابل لإعادة الاستخدام |
| Upstash REST عبر `fetch` | لا | يحتاج فقط متغيرات الاتصال الصحيحة |
| Supabase JS/Auth | لا | تبقى الخدمة مستقلة عن مستضيف الواجهة |
| `server.ts` و`dist/server.cjs` | Node مستقل، لكنه غير مثبت أنه مدخل Vercel الحالي | معالجة المنفذ وProxy والتشغيل/المراقبة قبل النقل |
| OAuth redirect | ليس نطاقًا ثابتًا في الكود | تحديث Redirect URL allowlist في Supabase عند اعتماد نطاق جديد |
| Same-origin API calls | تعتمد على بقاء API تحت نفس الأصل | تحديد API origin أو Reverse Proxy؛ وإعداد CORS إذا أصبح Cross-Origin |

## 8. CI / الاختبارات / سلامة التراجع

آخر Quality workflow على Commit المرجعي اكتمل بنجاح، وجميع وظائفه الثلاث نجحت:

1. Types, lint, tests, build:
   - `npm ci` — نجاح
   - `npm run lint` — نجاح
   - `npm test` — نجاح
   - `npm run build` — نجاح
2. Dependency & secret scanning:
   - OSV lockfile scan — نجاح
   - Gitleaks — نجاح
3. Supabase RLS static validation:
   - فحص تمكين RLS وتغطية السياسات — نجاح
   - التحقق من وجود مصدر Edge Function — نجاح

رابط تشغيل CI: https://github.com/saaedcs50/Smart-diet-v2/actions/runs/44117334695

الفرع `main` غير محمي حاليًا، ونتائج CI ليست Required Checks مفروضة على الفرع. هذه ملاحظة حوكمة؛ لم أغيّر إعدادات GitHub ضمن المرحلة صفر.

لم تُعَد الاختبارات محليًا أثناء هذه المرحلة لأن الخطة تحددها كجرد ساكن، ولأن Quality workflow على Commit المرجعي يثبت نجاح الفحوصات بالفعل.

## 9. المخاطر والفجوات التي يجب أخذها للمرحلة التالية

| الأولوية | الفجوة | الدليل / الأثر |
|---|---|---|
| عالية | Preview API يعيد 500 | فحص `/api/health` على Preview؛ مع غياب `COACH_PIN` و`SESSION_SECRET` في Preview. السبب المرجح يحتاج تأكيدًا من runtime/طلب logs |
| عالية | API caller مربوط بمسار نسبي | `src/utils/coachServer.ts` يستخدم `/api/coach-session`؛ فصل نطاق API يتطلب base URL أو Reverse Proxy |
| عالية | `PORT` ثابت | `server.ts` يربط على 3000 بدل `process.env.PORT` |
| متوسطة | `trust proxy=1` افتراض بنيوي | يؤثر في قراءة IP، وهو جزء من قفل محاولات PIN |
| متوسطة | عدم وجود CORS في Express | مناسب للمسار Same-Origin الحالي؛ غير كافٍ بمجرد فصل API إلى نطاق آخر |
| متوسطة | نقص متغيرات Coach secrets على Preview | يجب تحديد سياسة Preview: قيم اختبار مستقلة أم تعطيل مسارات Coach صراحة |
| متوسطة | OAuth allowlist خارج المستودع | يجب إضافة نطاق الاستضافة المستهدف إلى Supabase Auth Redirect URLs |
| متوسطة | توثيق VAPID قديم/غير متطابق | `.env.example` يذكر متغيرات لا تقرؤها Edge Function الحالية مباشرة |
| منخفضة | علم `VITE_COACH_LOCAL_ONLY` وتعليقه متعارضان | القيمة موجودة في Vercel، لكن الكود يقيّد التنفيذ بـ DEV فقط |
| منخفضة | متغير `LEGACY_UNUSED_PUSH_KEY` موجود رغم وصفه بالمتقاعد | لا يحذف قبل مراجعة تاريخ الاستهلاك والتحقق من سبب Metadata التحذيرية |

## 10. حدود التنفيذ في هذه المرحلة

تم تنفيذ الجرد والتوثيق فقط. لم يحدث أي مما يلي:

- لم تتغير شيفرة التطبيق أو سلوك PIN أو المصادقة.
- لم تُنشأ قاعدة بيانات أو تُشغّل Migration أو يتغير RLS.
- لم تُحذف أو تُعدّل أي Environment Variables.
- لم تُغيّر إعدادات Vercel أو DNS أو نطاقات Production.
- لم يُنقل API أو Frontend إلى مستضيف آخر.
- لم تُغيّر إعدادات OAuth في Supabase.
- لم يُحذف أي مورد أو سر.

## 11. معيار إغلاق المرحلة صفر

| شرط المرحلة | النتيجة |
|---|---|
| تسجيل Commit البداية وآخر Production Deployment | مكتمل |
| تثبيت نطاق الواجهة وAPI وSupabase | مكتمل؛ API على نفس أصل الواجهة |
| مراجعة package/build/runtime | مكتمل |
| مراجعة `api/index.ts` و`vercel.json` ومدخل Node | مكتمل |
| خريطة المسارات الفعلية ومستدعيها | مكتمل للمسارات المعرفة في router والمستدعيين المرصودين |
| تصنيف متغيرات Frontend / Backend / Edge Function | مكتمل مع تسجيل اختلاف .env.example عن Edge Function |
| مراجعة Supabase Auth redirect | مكتمل من ناحية الكود؛ إعداد allowlist الخارجي يلزم تأكيده عند اعتماد نطاق جديد |
| مراجعة Upstash وآلية التخزين | مكتمل |
| مراجعة CI وحالة Rollback | مكتمل |
| توثيق Preview 500 والفجوات بدل إخفائها | مكتمل |
| تغيير Production أو قاعدة البيانات | لم يحدث، وهذا مقصود في Phase 0 |

**الحالة النهائية: Phase 0 inventory complete.** لا تبدأ عملية الفصل الفعلي قبل معالجة/تفسير فشل Preview، وتحديد خطة API origin و`PORT` و`trust proxy` وCORS، وتوثيق إعدادات OAuth وEdge Function secrets للبيئة المستهدفة.
