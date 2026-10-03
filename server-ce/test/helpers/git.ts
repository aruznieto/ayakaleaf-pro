import { postWithCsrf } from './request'

// Git access to projects through git-bridge, with the git CLI of the Cypress
// container, the way users clone and push.

// Creates a personal access token for the logged in user, like "Generate
// token" in the account settings.
export function createGitToken(): Cypress.Chainable<string> {
  cy.visit('/user/settings')
  return postWithCsrf('/oauth/personal-access-tokens', {}).then(response => {
    expect(response.status).to.equal(200)
    return response.body.accessToken as string
  })
}

export function gitUrl(projectId: string, token: string) {
  return `http://git:${token}@sharelatex/git/${projectId}`
}

// Runs git in a fresh working copy folder, never failing the test by itself.
export function git(command: string) {
  return cy.exec(
    `export GIT_TERMINAL_PROMPT=0 HOME=/tmp/git-home && ${command}`,
    { failOnNonZeroExit: false, timeout: 60_000 }
  )
}

// A run-unique folder for a working copy
export function workingCopy(name: string) {
  return `/tmp/git-e2e/${name}-${Date.now()}`
}

export function gitClone(projectId: string, token: string, dir: string) {
  return git(`rm -rf ${dir} && git clone ${gitUrl(projectId, token)} ${dir}`)
}

// Writes a file, commits it and pushes.
export function gitCommitAndPush(
  dir: string,
  file: string,
  content: string,
  message: string
) {
  return git(
    `cd ${dir} && printf '%s' '${content.replaceAll("'", "'\\''")}' > ${file} && ` +
      `git add ${file} && ` +
      `git -c user.name=e2e -c user.email=e2e@example.com commit -q -m '${message}' && ` +
      'git push'
  )
}

// Invites the user to the project as the logged in owner, then accepts as
// that user through their notification.
export function shareProject(
  projectId: string,
  email: string,
  privileges: 'readOnly' | 'readAndWrite',
  inviteeLogin: () => void
) {
  cy.visit('/project')
  postWithCsrf(`/project/${projectId}/invite`, { email, privileges })
    .its('status')
    .should('equal', 200)
  inviteeLogin()
  cy.visit('/project')
  cy.request('/notifications').then(response => {
    const invite = response.body.find(
      (n: { messageOpts?: { projectId?: string } }) =>
        n.messageOpts?.projectId === projectId
    )
    postWithCsrf(
      `/project/${projectId}/invite/token/${invite.messageOpts.token}/accept`,
      {}
    )
      .its('status')
      .should('be.lessThan', 400)
  })
}
