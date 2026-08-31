import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const outDir = 'dist/video-prototypes/ant-communication-27-18';
mkdirSync(outDir, { recursive: true });

const ass = String.raw`[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Arabic,DejaVu Sans,34,&H00FFFFFF,&H00FFFFFF,&H00101010,&H60000000,0,0,0,0,100,100,0,0,1,2,1,2,60,60,55,1
Style: Small,DejaVu Sans,24,&H00D8E8FF,&H00D8E8FF,&H00101010,&H60000000,0,0,0,0,100,100,0,0,1,2,1,2,60,60,22,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:04.00,Arabic,,60,60,55,,النمل والاتصال: نموذج أولي موسوعي
Dialogue: 0,0:00:00.00,0:00:04.00,Small,,60,60,22,,Evidence-first documentary animatic • no third-party footage embedded
Dialogue: 0,0:00:04.00,0:00:08.00,Arabic,,60,60,55,,التواصل عند النمل: كيميائي ولمسي واهتزازي
Dialogue: 0,0:00:04.00,0:00:08.00,Small,,60,60,22,,Sources: Scientific Reports 2021 • animal communication review
Dialogue: 0,0:00:08.00,0:00:12.00,Arabic,,60,60,55,,تتغير بعض الإشارات الاهتزازية بحسب السياق السلوكي
Dialogue: 0,0:00:08.00,0:00:12.00,Small,,60,60,22,,Claim class: scientific observation • not human speech equivalence
Dialogue: 0,0:00:12.00,0:00:16.00,Arabic,,60,60,55,,﴿حَتّىٰ إِذا أَتَوا عَلىٰ وادِ النَّملِ قالَت نَملَةٌ يا أَيُّهَا النَّملُ ادخُلوا مَساكِنَكُم لا يَحطِمَنَّكُم سُلَيمانُ وَجُنودُهُ وَهُم لا يَشعُرونَ﴾
Dialogue: 0,0:00:12.00,0:00:16.00,Small,,60,60,22,,القرآن الكريم • النمل 27:18 • Arabic text kept verbatim in the source layer
Dialogue: 0,0:00:16.00,0:00:20.00,Arabic,,60,60,55,,قاعدة الموسوعة: الصلة التفسيرية لا تتحول آليًا إلى حقيقة علمية أو دعوى إعجاز
Dialogue: 0,0:00:16.00,0:00:20.00,Small,,60,60,22,,Next stage: rights-cleared footage + licensed recitation + word alignment + full mastering
`;

writeFileSync(join(outDir, 'captions.ass'), ass, 'utf8');

const filter = [
  'drawbox=x=0:y=0:w=1280:h=720:color=0x101827@1:t=fill',
  'drawbox=x=80:y=480:w=1120:h=6:color=0x6fa8dc@0.65:t=fill',
  'drawbox=x=260:y=360:w=150:h=60:color=0x6f7d8c@0.95:t=fill',
  'drawbox=x=235:y=420:w=200:h=16:color=0x6f7d8c@0.95:t=fill',
  'drawbox=x=485:y=330:w=150:h=60:color=0x6f7d8c@0.95:t=fill',
  'drawbox=x=460:y=390:w=200:h=16:color=0x6f7d8c@0.95:t=fill',
  'drawbox=x=710:y=380:w=150:h=60:color=0x6f7d8c@0.95:t=fill',
  'drawbox=x=685:y=440:w=200:h=16:color=0x6f7d8c@0.95:t=fill',
  'drawbox=x=920:y=300:w=150:h=60:color=0x6f7d8c@0.95:t=fill',
  'drawbox=x=895:y=360:w=200:h=16:color=0x6f7d8c@0.95:t=fill',
  'drawbox=x=120+70*sin(2*t):y=210:w=120:h=12:color=0xf2c94c@0.95:t=fill',
  'drawbox=x=520+50*sin(1.5*t):y=230:w=120:h=12:color=0xf2c94c@0.95:t=fill',
  'drawbox=x=890+40*sin(1.2*t):y=180:w=120:h=12:color=0xf2c94c@0.95:t=fill',
  'drawbox=x=0:y=0:w=1280:h=720:color=white@0:t=fill',
  'subtitles=' + join(outDir, 'captions.ass')
].join(',');

const output = join(outDir, 'ant-communication-27-18-animatic.mp4');
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'color=c=0x101827:s=1280x720:r=30:d=20',
  '-vf', filter,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  output
], { stdio: 'inherit' });

writeFileSync(join(outDir, 'README.txt'), [
  'First Din Allah Encyclopedia evidence-driven video prototype.',
  'This is a deterministic vector animatic, not the final photorealistic documentary renderer.',
  'It intentionally embeds no third-party footage and no unlicensed recitation.',
  'The Quran verse is displayed from the source layer; production rendering must use the approved canonical text asset.',
  'Scientific evidence: Scientific Reports 2021 on ant stridulatory signalling and behavioural context; Animal Behaviour review on ant acoustic signalling.',
  'Next production stage: insert rights-cleared footage or original generated scenes, licensed recitation, word alignment, color-fidelity pipeline, and 48K-class mastering.'
].join('\n'), 'utf8');

console.log(`Rendered ${output}`);
