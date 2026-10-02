package dinullah.voice

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.app.role.RoleManager

/**
 * User-directed Android assistant selection.
 *
 * The app never silently changes the device assistant. On supported Android
 * versions it uses the system assistant-role flow.
 */
object AlHudaAssistantRoleController {
    fun isSupported(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

    fun isRoleHeld(activity: Activity): Boolean {
        if (!isSupported()) return false
        val roleManager = activity.getSystemService(RoleManager::class.java) ?: return false
        return roleManager.isRoleHeld(RoleManager.ROLE_ASSISTANT)
    }

    fun requestRole(activity: Activity): Boolean {
        if (!isSupported()) return false
        val roleManager = activity.getSystemService(RoleManager::class.java) ?: return false
        if (!roleManager.isRoleAvailable(RoleManager.ROLE_ASSISTANT)) return false
        if (roleManager.isRoleHeld(RoleManager.ROLE_ASSISTANT)) return true
        activity.startActivityForResult(
            roleManager.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT),
            REQUEST_ASSISTANT_ROLE
        )
        return true
    }

    fun openAssistantSettings(activity: Activity) {
        activity.startActivity(Intent(Settings.ACTION_VOICE_INPUT_SETTINGS))
    }

    const val REQUEST_ASSISTANT_ROLE: Int = 4817
}
