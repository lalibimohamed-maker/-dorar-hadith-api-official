# Rechercher Ω — Offline & Local-First Architecture (2026)

## الهدف

يعمل محرك الموسوعة بثلاثة أوضاع واضحة:

- offline_only: الاستدلال والاسترجاع والبوابات داخل الجهاز، ولا يجوز أن يحتاج شبكة.
- online_only: استخدام مسار الخدمة المركزية.
- auto: يحاول المسار المحلي عندما تثبت ملاءمة الجهاز والنموذج، ثم ينتقل إلى Online إذا كان ذلك ضرورياً.

## الحدود العلمية

كل من Offline وOnline يمر عبر:

Local/Remote Retrieval -> Verified Evidence -> Strict Evidence Gate -> Unsupported Claim Gate -> Answer

النموذج المحلي ليس مصدراً علمياً، ولا يجوز له تعديل Corpus أو تحويل نص مولد إلى دليل.

## المتصفح والهاتف

المسار المستهدف:

Transformers.js -> ONNX Runtime Web -> WASM/WebGPU

في وضع Offline تضبط الحزمة allowRemoteModels=false وlocal_files_only=true، وتستخدم localModelPath محلياً مع Cache/WASM assets المعبأة مسبقاً.

## الحاسوب

يمكن توفير مسار محلي مبني على llama.cpp مع GGUF. هذا مسار مختلف عن ONNX Runtime Web: GGUF ليس تنسيق ONNX.

## الاسترجاع

Orama مناسب كمحرك JavaScript محلي للبحث النصي، وUSearch كخيار لفهارس المتجهات عند توفر حزمة WASM/native المناسبة. العلاقات يمكن حفظها في DuckDB-Wasm أو SQLite-Wasm-compatible adapter.

## التكميم والذاكرة

تسجل كل حزمة نموذج نوع التكميم وrevision وSHA-256 وقياس peak RAM.

حجم الملف وحده لا يساوي peak RAM. لذلك لا نعد بأن هاتف 4GB RAM يستطيع حتماً تشغيل نموذج ملفه 1.8GB؛ القرار يعتمد على القياس الفعلي للنموذج والبيئة.

## الصوت وOCR

يمكن إضافة sherpa-onnx للصوت وONNX Runtime لمحركات OCR، بشرط أن تكون النماذج وWASM assets متوفرة محلياً قبل تفعيل Offline.

## التوزيع

الأوزان لا تدخل Git history ولا Git LFS. عند نشر artifacts الثنائية الكبيرة تستخدم GitHub Releases مع manifest وSHA-256 والتجزئة عند الحاجة.

## الخصوصية

Offline يقلل انتقال الاستعلام والأدلة إلى الشبكة. لكنه لا يجعل الجهاز نفسه صندوقاً آمناً؛ حماية البيانات المحلية تعتمد أيضاً على نظام تشغيل الجهاز والتخزين ومفتاح التشفير.
