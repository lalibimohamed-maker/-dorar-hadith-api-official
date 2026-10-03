# Rechercher Omega — Distribution / Browser Layer v1

هذه الطبقة منفصلة عن Runtime الذي دُمج في PR #607. الأوزان الثنائية لا تدخل Git history ولا Git LFS، ويكون التوزيع عبر GitHub Releases مع manifests وبصمات SHA-256.

## Model installation manifest

كل نموذج محلي يحتاج هوية واضحة: model_id وversion وrevision وlicense، ثم الحجم وSHA-256 وتوقيع detached للmanifest. ملفات tokenizer لها hashes مستقلة وunicode test profile مستقل.

ملف runtime profile يسجل estimated peak RAM وruntime overhead وindex peak وtokenizer/runtime bytes وconcurrent buffers وsafety margin، إضافة إلى process/WebView caps عندما تكون معروفة.

Evidence index يحتفظ صراحة بـnode_id منفصلاً عن content_sha256. لا يوجد افتراض أن node_id يساوي hash للمحتوى.

## Resumable downloads

ByteRangeResumeEngine لا يعتبر وجود bytes جزئية دليلاً على سلامتها. لا يستأنف إلا من blocks تم التحقق منها بواسطة SHA-256.

عند الاستكمال يجب أن يكون الرد 206 Partial Content وأن يبدأ Content-Range عند offset المطلوب ويعلن الحجم الكلي المتوقع.

إذا أعاد الخادم 200 رغم طلب Range، يتم تصفير الملف الجزئي وإعادة التنزيل من الصفر. لا يجوز append للملف الكامل عند offset قديم.

يُستخدم If-Range مع ETag أو Last-Modified عند توفرهما. اختلاف validator يؤدي إلى البدء من جديد بدل خلط إصدارين.

بعد الاكتمال يجب أن يتطابق الحجم وwhole-file SHA-256 وكل block SHA-256 قبل اعتبار الملف صالحاً.

## Block-level integrity

المقسم scripts/omega-file-sharder.js في هذا المسار يولد chunks مناسبة لـGitHub Releases، ومع كل chunk بصمات blocks بحجم افتراضي 16 MiB. الـchunk الافتراضي 1900 MiB، ويظل أقل من حد asset في GitHub.

## Memory admission

navigator.deviceMemory قيمة تقريبية. لا يعامل النظام RAM المعلن كذاكرة متاحة للتطبيق، ولا يستخدم قاعدة OS reserve عالمية.

effective cap هو الحد الأصغر بين model cap المبني على deviceMemory وبين platform process cap وnative WebView cap عندما تكون هذه الحدود معروفة.

required memory هو peak model + runtime + index + tokenizer + concurrent buffers + safety margin.

## Tokenizer and canonical Unicode

Tokenizer artifacts منفصلة عن model weights. hashes للـtokenizer تتحقق مستقلاً، وتوجد round-trip tests صريحة. لا يُستخدم توليد النموذج كمصدر canonical للنص القرآني؛ canonical evidence يأتي من artifact موثق ومتحقق.

## Browser package isolation

packages/omega-browser حزمة مستقلة. لا تدخل dependencies الخاصة بالمتصفح في package تشغيل الخادم. build يستخدم esbuild 0.28.2 عبر npx مع shell:false، ولا تلتزم dist/ بالمستودع.

## Security boundary

Offline يقلل انتقال البيانات إلى الشبكة لكنه لا يجعل الجهاز نفسه trusted enclave. التشفير يحمي at-rest عند حماية المفتاح، بينما سلامة المصدر تعتمد على signatures/hashes والحدود العلمية تمنع تحويل مخرجات النموذج إلى Corpus evidence.
