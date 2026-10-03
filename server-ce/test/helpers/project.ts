import { postWithCsrf } from './request'

// Creates a project over HTTP and returns its id. A blank project's main.tex
// uses the project name as title and has an "Introduction" section.
export function createProject(
  projectName: string,
  template: 'none' | 'example' = 'none'
): Cypress.Chainable<string> {
  cy.visit('/project')
  return postWithCsrf('/project/new', { projectName, template }).then(
    response => {
      expect(response.status).to.equal(200)
      return response.body.project_id as string
    }
  )
}

export function openProject(projectId: string) {
  cy.visit(`/project/${projectId}`)
  waitForMainDocToLoad()
}

export function waitForMainDocToLoad() {
  cy.log('Wait for main doc to load; it will steal the focus after loading')
  cy.get('.cm-content').should('contain.text', 'Introduction')
}
