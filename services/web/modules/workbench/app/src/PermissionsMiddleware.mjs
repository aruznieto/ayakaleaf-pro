import Settings from '@overleaf/settings'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'
import UserGetter from '../../../../app/src/Features/User/UserGetter.mjs'

export async function canUseAi(userId) {
  if (!userId) return false

  // Read current permissions so an admin can revoke access to an open session.
  const user = await UserGetter.promises.getUser(userId, { aiFeatures: 1 })
  if (!user || user.aiFeatures?.enabled === false) return false

  const features = await UserGetter.promises.getUserFeatures(userId)
  return (
    features.aiUsageQuota === (Settings.aiFeatures?.unlimitedQuota ?? 'unlimited') ||
    Boolean(features.aiErrorAssistant)
  )
}

export const requireAiAccess = expressify(async (req, res, next) => {
  if (!(await canUseAi(SessionManager.getLoggedInUserId(req.session)))) {
    return res.status(403).json({ error: 'ai_access_denied' })
  }
  next()
})

export default { requireAiAccess }
