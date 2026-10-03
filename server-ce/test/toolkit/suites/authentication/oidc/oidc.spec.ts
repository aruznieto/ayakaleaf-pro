import {
  authentikLogin,
  currentUser,
  idpEmail,
  isSiteAdmin,
  resetAuthentikGroups,
  setAuthentikGroup,
  ssoLogin,
} from '../../../../helpers/auth'
import { login } from '../../../../helpers/login'
import { postWithCsrf } from '../../../../helpers/request'

// OIDC login against authentik (services/authentik). Admins are mapped from
// the groups claim containing "Admins". With OIDC the launchpad keeps the
// local form, the first admin gets a local password and keeps it.

before(function () {
  resetAuthentikGroups()
})

const carolPassword = `Local-${Cypress._.random(1e9)}-Pass`

function oidcLogin(username: string) {
  ssoLogin('/oidc/login', username)
}

describe('launchpad with OIDC', function () {
  it('creates a local first admin with a password', function () {
    cy.visit('/launchpad')
    cy.findByLabelText('Email').type(idpEmail('carol'))
    cy.findByLabelText('Password').type(carolPassword)
    cy.findByRole('button', { name: 'Register' }).click()
    cy.url().should('contain', '/login')
  })

  it('keeps the first admin an admin after the first OIDC login', function () {
    oidcLogin('carol')
    isSiteAdmin().should('equal', true)
    currentUser().its('email').should('equal', idpEmail('carol'))
  })

  it('keeps the local password of the first admin', function () {
    cy.clearAllCookies()
    login(idpEmail('carol'), carolPassword)
    cy.visit('/project')
    cy.url().should('contain', '/project')
  })
})

describe('OIDC login', function () {
  it('makes a user whose groups contain Admins an admin', function () {
    oidcLogin('alice')
    isSiteAdmin().should('equal', true)
    currentUser().then(user => {
      expect(user.email).to.equal(idpEmail('alice'))
    })
  })

  it('does not make a user of other groups an admin', function () {
    oidcLogin('bob')
    isSiteAdmin().should('equal', false)
  })

  it('does not make a user with an empty groups claim an admin', function () {
    oidcLogin('dave')
    isSiteAdmin().should('equal', false)
  })

  it('updates the admin flag on every login', function () {
    setAuthentikGroup('alice', 'Admins', false)
    oidcLogin('alice')
    isSiteAdmin().should('equal', false)

    setAuthentikGroup('alice', 'Admins', true)
    oidcLogin('alice')
    isSiteAdmin().should('equal', true)
  })
})

describe('linking OIDC to an account', function () {
  function unlink() {
    cy.visit('/user/settings')
    postWithCsrf('/user/oauth-unlink', { providerId: 'authentik' })
      .its('status')
      .should('equal', 200)
  }

  it('links the account again on the next OIDC login after unlinking', function () {
    login(idpEmail('carol'), carolPassword)
    unlink()

    oidcLogin('carol')
    currentUser().its('email').should('equal', idpEmail('carol'))
    isSiteAdmin().should('equal', true)
  })

  // The state reported in issue #96: admin flag gone and OIDC unlinked
  it('restores the admin flag when an unlinked, demoted admin logs in again', function () {
    setAuthentikGroup('carol', 'Admins', false)
    oidcLogin('carol')
    isSiteAdmin().should('equal', false)

    login(idpEmail('carol'), carolPassword)
    unlink()

    setAuthentikGroup('carol', 'Admins', true)
    oidcLogin('carol')
    currentUser().its('email').should('equal', idpEmail('carol'))
    isSiteAdmin().should('equal', true)
  })

  it('links the account from the settings page', function () {
    login(idpEmail('carol'), carolPassword)
    unlink()

    // The Link button of the settings page, see ssoLogin for why not cy.visit()
    cy.visit('/user/settings')
    cy.get('a[href="/oidc/login?intent=link"]').click()
    authentikLogin('carol')
    // The link flow returns to the settings page, still logged in as carol
    cy.url({ timeout: 30_000 }).should('contain', '/user/settings')
    currentUser().its('email').should('equal', idpEmail('carol'))
  })
})
