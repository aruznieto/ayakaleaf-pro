import { login } from '../../../helpers/login'
import {
  createProject,
  openProject,
  projectName,
} from '../../../helpers/project'
import { ADMIN_EMAIL, ensureAdminExists } from '../../../helpers/users'

const alpha = 'Lowercase Greek letter alpha'
const beta = 'Lowercase Greek letter beta'

function openPalette() {
  // The compact editor toolbar can move its symbol button into overflow.
  cy.findByRole('button', { name: 'Insert', exact: true }).click()
  cy.findByRole('menuitem', { name: 'Symbol', exact: true }).click()
  cy.get('.symbol-palette-container').should('be.visible')
  cy.findByRole('searchbox', { name: 'Search' }).should('be.focused')
}

function searchSymbols(query: string) {
  cy.findByRole('searchbox', { name: 'Search' }).clear().type(query)
}

before(function () {
  ensureAdminExists()
})

describe('symbol palette', function () {
  beforeEach(function () {
    login(ADMIN_EMAIL)
    createProject(projectName('Symbols')).then(openProject)
  })

  for (const { kind, query } of [
    { kind: 'LaTeX command', query: '\\alpha' },
    { kind: 'description', query: 'lowercase greek letter alpha' },
    { kind: 'character alias', query: 'α' },
  ]) {
    it(`searches symbols by ${kind}`, function () {
      openPalette()
      searchSymbols(query)
      // Search is debounced; retry the rendered results rather than sleep.
      cy.findByRole('listbox', { name: 'Symbols' }).within(() => {
        cy.findByRole('option', { name: alpha }).should('be.visible')
        cy.findByRole('option', { name: beta }).should('not.exist')
      })
    })
  }

  it('shows no results for an unknown symbol and restores symbols when cleared', function () {
    openPalette()
    searchSymbols('no-such-symbol-e2e')
    cy.findByText('No symbols found').should('be.visible')
    cy.findByRole('listbox', { name: 'Symbols' }).should('not.exist')

    cy.findByRole('searchbox', { name: 'Search' }).clear()
    cy.findByText('No symbols found').should('not.exist')
    cy.findByRole('option', { name: alpha }).should('be.visible')
    cy.findByRole('option', { name: beta }).should('be.visible')
  })

  it('inserts clicked symbols at the editor cursor and advances it', function () {
    const marker = '% symbol palette: '
    cy.findByText('\\maketitle').parent().type(`{end}\n${marker}`)
    openPalette()

    searchSymbols('\\alpha')
    cy.findByRole('option', { name: beta }).should('not.exist')
    cy.findByRole('option', { name: alpha }).click()
    cy.get('.cm-content')
      .should('contain.text', `${marker}\\alpha`)
      .and('be.focused')

    // Clicking a symbol keeps the palette open; searching must preserve the
    // editor selection so the next symbol follows the first one.
    searchSymbols('\\beta')
    cy.findByRole('option', { name: alpha }).should('not.exist')
    cy.findByRole('option', { name: beta }).click()
    cy.get('.cm-content')
      .should('contain.text', `${marker}\\alpha\\beta`)
      .and('be.focused')
  })
})
