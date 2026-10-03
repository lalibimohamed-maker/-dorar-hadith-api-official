import { AlHudaVoiceRuntime } from '../voice/AlHudaVoiceRuntime';

@Entry
@Component
struct Index {
  private voice: AlHudaVoiceRuntime = new AlHudaVoiceRuntime();
  @State status: string = 'Al-Huda — الهُدَى جاهز';

  build() {
    Column({ space: 16 }) {
      Text('Al-Huda — الهُدَى')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)

      Text(this.status)
        .fontSize(18)

      Button('🎙️ ابدأ التفاعل الصوتي')
        .onClick(() => {
          this.status = 'سيطلب Al-Huda صلاحية الميكروفون من النظام.';
        })

      Button('إيقاف')
        .onClick(async () => {
          await this.voice.stop();
          this.status = 'تم إيقاف Al-Huda';
        })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding(24)
  }
}
