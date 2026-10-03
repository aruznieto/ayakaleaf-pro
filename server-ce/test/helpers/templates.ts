import { compileProject } from './project'
import { createRateLimitWaiter } from './rateLimit'
import { postWithCsrf } from './request'

// The template pages and APIs share a limit of 60 requests per minute.
export const waitForTemplateSlot = createRateLimitWaiter(50, 60_000)

export type TemplateFields = {
  name: string
  category?: string
  license?: string
  authorMD?: string
  descriptionMD?: string
  override?: boolean
  build?: string
}

// Publishes a project through the endpoint of the "Manage Template" modal,
// after compiling it unless a build is given. Yields the response.
export function publishTemplate(projectId: string, fields: TemplateFields) {
  const post = (build: string) =>
    postWithCsrf(`/template/new/${projectId}`, {
      category: '/templates/academic-journal',
      license: 'cc_by_4.0',
      authorMD: 'Test Author',
      descriptionMD: 'A template.',
      override: false,
      build,
      ...fields,
    })
  if (fields.build) return post(fields.build)
  return compileProject(projectId).then(build => post(build))
}

// The template as the details page gets it, or null.
export function getTemplate(templateId: string) {
  waitForTemplateSlot()
  // .its('body') would fail on the null of an unknown template
  return cy
    .request(`/api/template?key=_id&val=${templateId}`)
    .then(response => response.body)
}

export function listTemplates(params: Record<string, string | number>) {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  )
  waitForTemplateSlot()
  return cy.request(`/api/templates?${query}`).its('body')
}

// Follows "Open as Template" on the details page and yields the id of the
// project it creates.
export function openAsTemplate(templateId: string): Cypress.Chainable<string> {
  visitTemplate(templateId)
  cy.findByRole('link', { name: 'Open as Template' }).click()
  return cy
    .url({ timeout: 60_000 })
    .should('match', /\/project\/[0-9a-f]{24}$/)
    .then(url => url.split('/').pop() as string)
}

export function visitTemplate(templateId: string) {
  waitForTemplateSlot()
  cy.visit(`/template/${templateId}`)
}

// Requests a template route without failing on its status.
export function requestTemplateRoute(url: string) {
  waitForTemplateSlot()
  return cy.request({ url, failOnStatusCode: false, encoding: 'binary' })
}
