const QIBLA={lat:21.422487,lon:39.826206};
const MODULES=[
['wudu','الوضوء','💧'],['major-ghusl','الغسل الأكبر','🚿'],['tayammum','التيمم','🪨'],['prophetic-prayer','صفة صلاة النبي ﷺ','🕌'],['sujud-sahw','سجود السهو','↩️'],['sujud-tilawah','سجود التلاوة','📖'],['sujud-shukr','سجود الشكر','🤲'],['adhan','الأذان','🔊'],['iqamah','الإقامة','🕌'],['funeral-prayer','صلاة الجنازة','🤲'],['istisqa','صلاة الاستسقاء','🌧️'],['fasting','الصيام','🌙'],['zakat','الزكاة','💰'],['zakat-fitr','زكاة الفطر','🌾'],['hajj','الحج','🕋'],['umrah','العمرة','🕋'],['ruqyah','الرقية الشرعية','📿']
];
const QURAN=[
[1,'الحروف العربية المفردة'],[2,'الحروف المركبة'],[3,'الحروف المقطعة'],[4,'الحركات'],[5,'التنوين'],[6,'تهجي الكلمات'],
[7,'المد'],[8,'حروف المد الصغيرة'],[9,'اللين'],[10,'تطبيقات المد واللين'],[11,'السكون'],[12,'تطبيقات السكون'],
[13,'الشدة'],[14,'تقويم الشدة'],[15,'الشدة مع السكون'],[16,'الشدة المزدوجة'],[17,'الشدة بعد المدة'],[18,'الخاتمة']
];
const LESSONS={
'wudu':['النية','غسل الكفين','المضمضة والاستنشاق','غسل الوجه','غسل اليدين إلى المرفقين','مسح الرأس','غسل الرجلين'],
'major-ghusl':['النية','غسل الفرج','الوضوء','إفاضة الماء على الرأس','إفاضة الماء على سائر الجسد'],
'tayammum':['تحقق سبب التيمم','القصد إلى الصعيد الطيب','مسح الوجه واليدين على الصفة الثابتة'],
'prophetic-prayer':['استقبال القبلة','تكبيرة الإحرام','القيام والقراءة','الركوع والرفع','السجود والجلوس','التشهد','السلام'],
'sujud-sahw':['تحديد سبب السهو','موضع السجود بحسب الرواية','إتمام الصلاة على الصفة التي تدل عليها الرواية'],
'sujud-tilawah':['معرفة موضع السجدة','التكبير بحسب الحال والرواية','السجود والذكر','الرفع بحسب الحال'],
'sujud-shukr':['تحقق سبب الشكر','السجود على الصفة التي يثبتها الدليل'],
'adhan':['الألفاظ الثابتة','الحيعلتان','متابعة المؤذن','الدعاء بعد الأذان'],
'iqamah':['الألفاظ الثابتة','عدد التكرار بحسب الرواية','قد قامت الصلاة'],
'funeral-prayer':['التكبيرة الأولى والقراءة','الصلاة على النبي ﷺ','الدعاء للميت','التكبيرة الرابعة والسلام'],
'istisqa':['الخروج والاستسقاء','الصلاة على الصفة الثابتة','الدعاء والاستغفار'],
'fasting':['النية','الإمساك','آداب الصيام','الإفطار','الأعذار والقضاء'],
'zakat':['تحديد نوع المال','تحديد النصاب','تحقق الحول حيث يشترط','حساب الواجب','مصارف الزكاة'],
'zakat-fitr':['من تلزمه','المقدار الثابت','وقت الإخراج','المصرف وفق القول الموثق'],
'hajj':['الإحرام','الطواف','السعي','الوقوف بعرفة','المبيت والرمي','التحلل','طواف الإفاضة'],
'umrah':['الإحرام','الطواف','السعي','الحلق أو التقصير'],
'ruqyah':['القراءة الثابتة','الأدعية الثابتة','النفث حيث ورد','اجتناب غير المشروع']};

let current={id:'wudu',index:0};
const $=id=>document.getElementById(id);
function renderModules(){ $('modules').innerHTML=MODULES.map(([id,n,i])=>`<button class="module" data-module="${id}">${i} <b>${n}</b><span class="muted">درس تفاعلي</span></button>`).join(''); }
function speak(text){if(!('speechSynthesis'in window))return; speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);u.lang='ar-SA';u.rate=.84;speechSynthesis.speak(u)}
function renderLesson(){const steps=LESSONS[current.id]||[];const label=MODULES.find(x=>x[0]===current.id)?.[1]||current.id;const i=Math.min(current.index,Math.max(steps.length-1,0));const title=steps[i]||'اختر درسًا';$('lesson').innerHTML=`<div class="step"><h3>${label} — خطوة ${i+1} من ${steps.length}</h3><div class="progress"><i style="width:${steps.length?((i+1)/steps.length)*100:0}%"></i></div><p><b>${title}</b></p><p class="muted">هذه الخطوة مرتبطة بسجل الأدلة في طبقة الموسوعة. لا يُعرض نص حديث أو حكم على أنه ثابت حتى يمر بمرحلة التحقق والتخريج.</p><div class="row"><button class="btn" id="speak-step">🔊 استمع</button><button class="btn" id="prev-step">السابق</button><button class="btn" id="next-step">التالي</button></div></div>`}
function renderQuran(){ $('quran-lessons').innerHTML=QURAN.map(([n,t])=>`<button class="module" data-quran="${n}"><b>الدرس ${n}</b>${t}</button>`).join(''); }
function bearing(lat,lon){const r=d=>d*Math.PI/180;const d=r(QIBLA.lon-lon);const p1=r(lat),p2=r(QIBLA.lat);const y=Math.sin(d)*Math.cos(p2);const x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(d);return (Math.atan2(y,x)*180/Math.PI+360)%360}
function locationSuccess(pos){const lat=pos.coords.latitude,lon=pos.coords.longitude,b=bearing(lat,lon);$('qibla-angle').style.transform=`rotate(${b}deg)`;$('qibla-text').textContent=`الموقع: ${lat.toFixed(5)}, ${lon.toFixed(5)} — اتجاه القبلة الجغرافي الأولي: ${b.toFixed(1)}° من الشمال.`}
function locate(){if(!navigator.geolocation){$('qibla-text').textContent='المتصفح لا يدعم تحديد الموقع.';return}navigator.geolocation.getCurrentPosition(locationSuccess,()=>{$('qibla-text').textContent='تعذر الحصول على الموقع. يمكنك السماح بالموقع ثم المحاولة مجددًا.'},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})}
async function prayerTimes(){if(!navigator.geolocation){$('times').textContent='لا يتوفر تحديد الموقع.';return}navigator.geolocation.getCurrentPosition(async p=>{const {latitude,longitude}=p.coords;const url=`https://api.aladhan.com/v1/timings?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&method=4`;try{const r=await fetch(url);const j=await r.json();const t=j?.data?.timings||{};$('times').innerHTML=['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'].map(k=>`<div class="step"><b>${k}</b> — ${t[k]||'—'}</div>`).join('')+`<p class="muted">طريقة الحساب المرسلة: 4 (أم القرى). خدمة مواقيت خارجية؛ تعرض الموسوعة مصدر الحساب للمستخدم ولا تخفيه.</p>`}catch(e){$('times').textContent='تعذر جلب المواقيت الآن.'}},()=>{$('times').textContent='السماح بالموقع مطلوب لحساب المواقيت.'},{enableHighAccuracy:true,timeout:10000,maximumAge:60000})}
function zakat(){const base=Math.max(Number($('z-base').value||0),0),nisab=Math.max(Number($('z-nisab').value||0),0),eligible=$('z-eligible').checked;const due=eligible&&nisab>0&&base>=nisab?base*.025:0;$('z-result').textContent=`المبلغ المحتسب: ${base.toFixed(2)} — النصاب: ${nisab.toFixed(2)} — الزكاة التعليمية: ${due.toFixed(2)}`}

document.addEventListener('click',e=>{const mod=e.target.closest('[data-module]')?.dataset.module;if(mod){current={id:mod,index:0};renderLesson()}const q=e.target.closest('[data-quran]')?.dataset.quran;if(q){speak(`الدرس ${q} من الدروس الهجائية الرسمية. راجع صفحة الدرس في المصدر الرسمي لتفاصيل التدريب الصوتي والبصري.`)}if(e.target.id==='speak-step'){const steps=LESSONS[current.id]||[];speak(steps[current.index]||'')}if(e.target.id==='prev-step'){current.index=Math.max(0,current.index-1);renderLesson()}if(e.target.id==='next-step'){current.index=Math.min((LESSONS[current.id]||[]).length-1,current.index+1);renderLesson()}if(e.target.id==='locate')locate();if(e.target.id==='prayer-times')prayerTimes();if(e.target.id==='theme'){document.body.classList.toggle('dark');e.target.textContent=document.body.classList.contains('dark')?'☀️ الوضع الضوئي':'🌙 الوضع الليلي'}});
document.querySelectorAll('#z-base,#z-nisab,#z-eligible').forEach(x=>x.addEventListener('input',zakat));
document.querySelector('[data-tab="worship"]').addEventListener('click',()=>{});
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==btn.dataset.tab)}));
$('speak-quran').addEventListener('click',()=>speak('الدروس الهجائية لتعلم قراءة القرآن الكريم بطريقة سهلة ومجودة.'));$('stop-quran').addEventListener('click',()=>speechSynthesis?.cancel());
renderModules();renderLesson();renderQuran();zakat();
