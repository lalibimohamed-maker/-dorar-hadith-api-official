import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config", "specialized-engines-2026.json"), "utf8"));
const aliases={"sermons-lessons":["محاضرة","درس","خطبة","خطبة الجمعة","خطبة العيد","الزواج","عقد القران","رمضان","موعظة"],"prophetic-medicine":["الطب النبوي","علاج","عشبة","أعشاب","دواء","الحبة السوداء","العسل","الحجامة"],"dua-adhkar":["دعاء","أدعية","ذكر","أذكار","حصن المسلم","ورد","دعاء الشفاء","دعاء الرزق","قيام الليل","ختم القرآن"],"worship-teaching":["الصلاة","الوضوء","الطهارة","الغسل","التيمم","سجود السهو","سجود التلاوة","صلاة الاستسقاء","صلاة الميت","صلاة الجنازة","صفة صلاة النبي"]};
const priorityRules=[{engineId:"worship-teaching",patterns:[["صلاة","الجنازة"],["صلاة","الميت"],["كيف","أصلي","الجنازة"],["كيف","أصلي","الميت"],["صفة","صلاة","النبي"],["سجود","السهو"]]},{engineId:"sermons-lessons",patterns:[["موعظة","جنازة"],["خطبة","جنازة"],["درس","جنازة"]]}];
function normalize(value){return String(value||"").toLocaleLowerCase("ar").replace(/[إأآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/\s+/g," ").trim()}
function scoreTerms(q,terms){return terms.reduce((n,t)=>{const x=normalize(t);return !x||!q.includes(x)?n:n+(x.split(" ").length>1?20:10)},0)}
function matchesPriorityRule(q,rule){return rule.patterns.some(p=>p.every(t=>q.includes(normalize(t))))}
export function getSpecializedEngines(){return config.engines}
export function routeSpecializedQuestion(question){const q=normalize(question);const priority=priorityRules.find(r=>matchesPriorityRule(q,r));const scores=config.engines.map(engine=>({engine,score:scoreTerms(q,aliases[engine.id]||[engine.nameAr])})).sort((a,b)=>b.score-a.score);const best=priority?(scores.find(x=>x.engine.id===priority.engineId)||scores[0]):scores[0];const winning=priority?Math.max(best?.score||0,100):(best?.score||0);const source=best&&winning>0?best.engine:config.engines.find(x=>x.id==="source-to-answer");return{engineId:source?.id||"source-to-answer",confidence:best&&winning>0?Math.min(winning/100,1):.1,candidates:scores.filter(x=>x.score>0).map(x=>({id:x.engine.id,score:x.score})),sourceOrder:source?.sourceOrder||null,languagePolicy:config.engines.find(x=>x.id==="source-to-answer")?.languagePolicy||null}}
export function getEngine(id){return config.engines.find(engine=>engine.id===id)||null}
