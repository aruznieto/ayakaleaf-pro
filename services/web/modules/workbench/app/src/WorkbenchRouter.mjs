import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import WorkbenchController from './WorkbenchController.mjs'
import PermissionsMiddleware from './PermissionsMiddleware.mjs'

export default {
  apply(webRouter) {
    webRouter.get(
      '/workbench/access',
      AuthenticationController.requireLogin(),
      WorkbenchController.getAccess
    )
    // Workbench AI chat (Vercel AI SDK useChat endpoint). The global JSON body
    // parser (12 MB by default) handles the UI-message history payload.
    webRouter.post(
      '/workbench/tex-gpt',
      AuthenticationController.requireLogin(),
      PermissionsMiddleware.requireAiAccess,
      WorkbenchController.texGpt
    )
  },
}
