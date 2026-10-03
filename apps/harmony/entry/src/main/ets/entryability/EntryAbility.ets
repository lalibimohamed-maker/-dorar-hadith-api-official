import { UIAbility, AbilityConstant, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  onCreate(_want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    console.info('Al-Huda HarmonyOS ability created');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        console.error('Al-Huda loadContent failed: ' + JSON.stringify(err));
      }
    });
  }

  onWindowStageDestroy(): void {
    console.info('Al-Huda HarmonyOS window destroyed');
  }
}
