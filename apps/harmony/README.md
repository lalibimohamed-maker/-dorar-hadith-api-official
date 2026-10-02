# موسوعة دينُ اللّه — Al-Huda / HarmonyOS

هذا المسار هو التكامل الأصلي لـ **Al-Huda — الهُدَى** مع HarmonyOS، وليس مجرد نسخة PWA.

## التكامل النظامي

- مشروع ArkTS/DevEco Studio مستقل في `apps/harmony`.
- هوية المساعد ثابتة: **Al-Huda — الهُدَى**.
- طبقة الصوت تشترك مع النواة: VAD → Qwen3-ASR → Al-Huda/Al-Taqwa → TTS اختياري.
- وظائف Al-Huda موصوفة كـ Skill/Agent/Intents Kit entry بحيث يمكن لنقطة الذكاء النظامية استدعاؤها عندما يدعم إصدار الجهاز والحساب ذلك.
- لا نفترض أن كل إصدار HarmonyOS يسمح لتطبيق خارجي أن يصبح المساعد الافتراضي أو يستبدل 小艺؛ لا نعلن ذلك دون دليل جهاز/منصة.
- صلاحية الميكروفون مرتبطة بتفاعل المستخدم وصلاحيات النظام.

## الأجهزة

ملف الوحدة يستهدف الهاتف واللوحي و2-in-1 والتلفاز والارتداء. نفس النواة تستخدم عبر هذه الملفات مع Device Profile يغيّر الواجهة والموارد.

## محرك المنصة

`System/Xiaoyi entry → Al-Huda Skill Adapter → native audio bridge → VAD → Qwen3-ASR → Al-Huda/Al-Taqwa → optional TTS`

## التوثيق

يُرجع التكامل إلى وثائق Huawei الرسمية الخاصة بـ DevEco Studio وArkTS وIntents Kit وCore Speech Kit وSkill/Agent. لا نختلق custom intents غير موثقة.

المصادر الرسمية:
- https://developer.huawei.com/consumer/cn/doc/
- https://developer.huawei.com/consumer/cn/features/
- https://developer.huawei.com/consumer/cn/celia/

## حدود التنفيذ

المشروع يحتوي الآن على **native scaffold + system-entry contract**. نشر Skill الفعلي، اعتماده من Huawei، وإثبات ظهوره في إعدادات جهاز HarmonyOS حقيقي مراحل خارج GitHub وتحتاج حساب المطور/بيئة DevEco والجهاز المستهدف.