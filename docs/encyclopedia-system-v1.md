# موسوعة دين الله — نظام التشغيل العلمي والرقمي v1

## 1. القاعدة

`DISCOVERY != IDENTITY != EDITION != DIGITAL_COPY != RIGHTS != PUBLICATION`

وجود كتاب في الكتالوج لا يعني وجود نسخة رقمية، ووجود نسخة رقمية لا يعني صلاحية إعادة نشرها.

## 2. المسار الكامل

```text
DISCOVERED
  -> IDENTIFIED
  -> EDITION_RESOLVED
  -> SOURCE_VERIFIED
  -> RIGHTS_VERIFIED
  -> ACQUIRED
  -> SHA256_LOCKED
  -> PDF_VALIDATED
  -> PAGE_INTEGRITY_PASSED
  -> OCR
  -> OCR_CONFIDENCE_REVIEW
  -> TEXT_COLLATION
  -> TEXT_VERIFIED
  -> QUALITY_SCORED
  -> PUBLICATION_APPROVED
```

أي مرحلة ناقصة تتحول إلى `HOLD` ولا تُتجاوز تلقائيًا.

## 3. هوية البيانات

- `WORK_ID`: العمل العلمي نفسه.
- `EDITION_ID`: طبعة محددة للمؤلف/العمل.
- `DIGITAL_COPY_ID`: النسخة الرقمية المحددة من مصدر محدد، مع وقت الحصول وSHA-256.
- `SOURCE_ID`: الجهة/الرابط الذي يثبت وجود النسخة.
- `RIGHTS_EVIDENCE_ID`: الدليل الذي يثبت حالة الحقوق.

## 4. محركات المصادر العالمية

| المحرك | الدور | اكتساب تلقائي | إثبات الحقوق تلقائيًا |
|---|---|---:|---:|
| Waqfeya | اكتساب + بيانات ببليوغرافية | نعم عند مطابقة الطبعة والمصدر | لا |
| Internet Archive | أرشيف/اكتساب | نعم عند وجود ملف مطابق | لا |
| Open Library | هوية/طبعة/IA resolution | لا | لا |
| Library of Congress | هوية/مصدر مؤسسي | لا | لا |
| Google Books | هوية/طبعة/حالة إتاحة | لا | لا |
| Crossref | بيانات ببليوغرافية/ترخيص metadata | لا | لا |

لا يُعتبر أي رابط اكتشاف أو metadata تصريحًا بإعادة التوزيع.

## 5. الحقوق

يجب حفظ: `rights_source`, `rights_evidence`, `rights_checked_at`, `rights_checked_by`, `license`, `territory`, `expiry`, `redistribution_allowed`, `derivative_allowed`.

## 6. الجودة

الدرجة المرجعية: Identity 20%، Source 20%، Scan 15%، Completeness 15%، OCR 15%، Metadata 10%، Rights 5%.

النشر يتطلب درجة >= 80 مع اجتياز بوابة الحقوق والمصدر والسلامة.

## 7. سلامة الصفحات

الفحص الحالي يبدأ من سلامة PDF وعدد الصفحات. المرحلة التالية يجب أن تضيف تحليل الصور لاكتشاف الصفحات المفقودة/المكررة/الفارغة/المعكوسة/المشوشة، ومطابقة عدد المجلدات مع الطبعة المتوقعة.

## 8. OCR

OCR طبقة مشتقة وليست أصلًا سلطويًا. يجب حفظ نسخة الصفحة، النص الجانبي، محرك OCR وإصداره، اللغة، درجة الثقة لكل صفحة، وSHA-256 للمصدر.

صفحات الثقة المنخفضة تدخل مراجعة بشرية؛ لا يتحول OCR إلى `TEXT_VERIFIED` بمجرد نجاح التنفيذ.

## 9. المقابلة النصية

يجب مقارنة OCR بصورة الصفحة، ومقارنة الطبعات المختلفة، ثم تسجيل الاختلافات كأحداث قابلة للمراجعة بدل إخفائها.

## 10. الرسوم البيانية

### Edition graph
`WORK -> EDITION -> DIGITAL_COPY -> SOURCE -> RIGHTS_EVIDENCE`

### Citation graph
`WORK -> VOLUME -> PAGE -> PASSAGE -> CLAIM`

### Knowledge graph
`PERSON -> WORK -> TOPIC -> VERSE/HADITH -> PLACE/DATE -> CLAIM`

## 11. كشف التغييرات

يجب اكتشاف تغير المصدر، الطبعة، الحقوق، SHA-256، عدد الصفحات، أو جودة OCR. إعادة الاكتساب لا تحدث إلا عند تغير يستحق ذلك.

## 12. المراقبة

تقاس صحة كل محرك: latency، success rate، candidate rate، acquisition rate، validation failures، rights holds، low-confidence OCR pages، collation conflicts، publication rejections، آخر نسخة احتياطية، وآخر اختبار استرجاع.

## 13. النسخ الاحتياطي

الحد الأدنى: نسختان مشفرتان، إحداهما خارجية/منفصلة، مع RPO وRTO مستهدفين 24 ساعة، واختبار استرجاع دوري. وجود النسخة الاحتياطية دون اختبار الاسترجاع لا يعتبر نجاحًا.

## 14. سجل التدقيق

كل تغيير مهم يجب أن يحمل: `who`, `what`, `when`, `source`, `old_value`, `new_value`, `reason`, `commit`, `hash`.

## 15. قاعدة النشر

القاعدة النهائية:

> لا نشر عام دون هوية واضحة + طبعة محددة + مصدر موثوق + حقوق مثبتة + سلامة ملف + سلامة صفحات + تحقق نصي + درجة جودة ناجحة + سجل تدقيق.
