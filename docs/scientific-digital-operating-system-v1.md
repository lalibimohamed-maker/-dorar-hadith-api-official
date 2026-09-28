# موسوعة دين الله — نظام التشغيل العلمي والرقمي v1

الحالة التشغيلية لكل عمل تفصل صراحة بين Discovery وIdentity وEdition وDigital Copy وRights وPublication.

## State machine

`DISCOVERED -> IDENTIFIED -> EDITION_RESOLVED -> SOURCE_VERIFIED -> RIGHTS_VERIFIED -> ACQUIRED -> SHA256_LOCKED -> PDF_VALIDATED -> PAGE_INTEGRITY_PASSED -> OCR -> OCR_CONFIDENCE_REVIEW -> TEXT_COLLATION -> TEXT_VERIFIED -> QUALITY_SCORED -> PUBLICATION_APPROVED`.

أي نقص أو فشل ينتج `HOLD`، ولا توجد قفزة تلقائية بين المراحل.

## الهوية والحقوق

الهوية تحمل WORK_ID وEDITION_ID وDIGITAL_COPY_ID وSOURCE_ID وRIGHTS_EVIDENCE_ID. بيانات الحقوق مطلوبة كاملة، وإثبات الاكتشاف أو metadata لا يمنح صلاحية إعادة التوزيع.

## الجودة

النموذج المرجعي: Identity 20%، Source 20%، Scan 15%، Completeness 15%، OCR 15%، Metadata 10%، Rights 5%، مع حد نشر 80.

## سلامة الصفحات وOCR

سلامة الصفحات لا تكتفي بعدد الصفحات؛ يلزم دليل للصفحات المفقودة والمكررة والفارغة والاتجاه والتلف واكتمال المجلدات. OCR مشتق وغير سلطوي، ويحتفظ بهوية الصفحة وSHA-256 للصورة والمحرك والإصدار واللغة والثقة. انخفاض الثقة أو نقص دليل المقابلة يحجز المسار.

## المقابلة والتغيير

تظهر فروق OCR/صورة الصفحة وفروق الطبعات والاختلافات غير المحسومة صراحة. تغيّر المصدر أو الطبعة أو الحقوق أو SHA-256 أو عدد الصفحات أو جودة OCR يطلق توصية إعادة اكتساب، لا إعادة اكتساب تلقائية.

## المراقبة والنسخ الاحتياطي

يسجل النظام latency وsuccess/candidate/acquisition rates والفشل والـholds والتعارضات والرفض وتاريخ النسخ الاحتياطي وآخر اختبار استرجاع. الجاهزية تتطلب نسختين مشفرتين على الأقل، إحداهما منفصلة، واختبار استرجاع، مع RPO/RTO مستهدفين 24 ساعة.

## النشر

لا يمر النشر إلا بعد كل المراحل، درجة جودة >=80، الحقوق المثبتة، وسجل تدقيق. هذه الطبقة فوق Corpus ولا تعيد كتابة المحتوى العلمي.
