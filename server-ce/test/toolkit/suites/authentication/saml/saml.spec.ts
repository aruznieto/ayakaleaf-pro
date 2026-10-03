import {
  currentUser,
  idpEmail,
  isSiteAdmin,
  resetAuthentikGroups,
  setAuthentikGroup,
  ssoLogin,
} from '../../../../helpers/auth'
import { postWithCsrf } from '../../../../helpers/request'

// SAML login against authentik (services/authentik). Admins are mapped from
// the multi-valued Group attribute containing "Admins". The first admin is
// created on /launchpad, which runs on the fresh instance first.

before(function () {
  resetAuthentikGroups()
})

function samlLogin(username: string) {
  ssoLogin('/saml/login', username)
}

describe('launchpad with SAML', function () {
  it('asks only for the email of the first admin', function () {
    cy.visit('/launchpad')
    cy.findByRole('heading', { name: 'Create the first Admin account' })
    cy.findByRole('heading', { name: 'SAML' })
    cy.findByLabelText('Email')
    cy.get('input[name="password"]').should('not.exist')
  })

  it('refuses the LDAP admin registration', function () {
    cy.visit('/launchpad')
    postWithCsrf('/launchpad/register_ldap_admin', { email: idpEmail('carol') })
      .its('status')
      .should('equal', 403)
  })

  it('creates the first admin, who then logs in through SAML', function () {
    cy.visit('/launchpad')
    cy.findByLabelText('Email').type(idpEmail('carol'))
    cy.findByRole('button', { name: 'Register' }).click()
    cy.url().should('contain', '/login')

    samlLogin('carol')
    isSiteAdmin().should('equal', true)
    currentUser().its('email').should('equal', idpEmail('carol'))
    cy.visit('/launchpad')
    cy.findByRole('heading', { name: 'Status Checks' })
  })

  it('does not offer the form once the admin exists', function () {
    cy.visit('/launchpad')
    cy.url().should('contain', '/login')
  })
})

describe('SAML login', function () {
  it('makes a user whose Group attribute contains Admins an admin', function () {
    samlLogin('alice')
    isSiteAdmin().should('equal', true)
    currentUser().then(user => {
      expect(user.email).to.equal(idpEmail('alice'))
      expect(user.first_name).to.equal('Alice Admin')
    })
  })

  it('does not make a user of other groups an admin', function () {
    samlLogin('bob')
    isSiteAdmin().should('equal', false)
  })

  it('does not make a user without groups an admin', function () {
    samlLogin('dave')
    isSiteAdmin().should('equal', false)
  })

  it('updates the admin flag on every login', function () {
    setAuthentikGroup('alice', 'Admins', false)
    samlLogin('alice')
    isSiteAdmin().should('equal', false)

    setAuthentikGroup('alice', 'Admins', true)
    samlLogin('alice')
    isSiteAdmin().should('equal', true)
  })

  it('logs in an existing account again', function () {
    samlLogin('bob')
    currentUser().its('email').should('equal', idpEmail('bob'))
  })
})
