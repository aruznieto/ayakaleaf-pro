import { v4 as uuid } from 'uuid'
import {
  adminUserInfo,
  dialog,
  ownerInput,
  projectAccess,
  row as projectRow,
  rowAction,
  search as searchProjects,
  search as searchUsers,
  searchBox,
  selectNewOwner,
} from '../../../helpers/adminTools'
import { login } from '../../../helpers/login'
import { createProject, projectName } from '../../../helpers/project'
import { postWithCsrf } from '../../../helpers/request'
import { ADMIN_EMAIL, ensureUserExists } from '../../../helpers/users'

// The project lists of the admin-tools module: a user's projects, opened from
// their name in Manage Users, and every project at /admin/project. The admin
// trashes, deletes, restores, purges and downloads projects for their owners
// and gives them to other users. Each result is checked from the owners'
// side, through the projects they can open.

const owner = `admin-tools-owner-${uuid()}@example.com`
const newOwner = `admin-tools-new-owner-${uuid()}@example.com`

// New accounts are named after their email address
const nameOf = (email: string) => email.split('@')[0]

function selectFilter(name: string) {
  cy.get('.project-list-filters').findByRole('button', { name }).click()
}

// The projects of the user, from their name in Manage Users
function visitProjectsOf(email: string) {
  cy.visit('/admin/user')
  searchUsers(email)
  cy.contains('tbody tr', email)
    .findByRole('link', { name: nameOf(email) })
    .click()
  cy.findByRole('navigation', { name: 'Project categories and tags' })
    .should('contain.text', nameOf(email))
}

function visitAllProjects() {
  cy.visit('/admin/project')
  searchBox().should('exist')
}

function createProjects(email: string, ...names: string[]) {
  login(email)
  const ids: string[] = []
  for (const name of names) {
    createProject(name).then(id => ids.push(id))
  }
  return cy.wrap(ids)
}

// The projects of the user as the admin's list reports them, deleted ones too
function adminProjects(email: string) {
  return adminUserInfo(email).then(info =>
    postWithCsrf(`/admin/user/${info.id}/projects`, {}).its('body.projects')
  )
}

before(function () {
  ensureUserExists(owner)
  ensureUserExists(newOwner)
})

describe("a user's projects", function () {
  it('lists only the projects of the user and goes back to the users', function () {
    const mine = projectName('Mine')
    const theirs = projectName('Theirs')
    createProjects(owner, mine)
    createProjects(newOwner, theirs)

    login(ADMIN_EMAIL)
    visitProjectsOf(owner)
    projectRow(mine).should('contain.text', nameOf(owner))
    projectRow(mine)
      .findByRole('link', { name: mine })
      .should('have.attr', 'href')
      .and('match', /^\/project\/[0-9a-f]{24}$/)
    cy.contains('tbody tr', theirs).should('not.exist')

    cy.findByRole('button', { name: 'Back' }).click()
    cy.contains('tbody tr', owner).should('exist')
    cy.go('forward')
    projectRow(mine).should('exist')
  })

  it("trashes a project for its owner and restores it", function () {
    const name = projectName('Trash')
    createProjects(owner, name).then(([projectId]) => {
      login(ADMIN_EMAIL)
      visitProjectsOf(owner)
      rowAction(name, 'Trash')
      dialog().within(() => {
        cy.contains('Trash Projects').should('exist')
        cy.contains(name).should('exist')
        cy.findByRole('button', { name: 'Trash' }).click()
      })
      dialog().should('not.exist')
      projectRow(name).should('not.exist')
      selectFilter('Trashed projects')
      projectRow(name).should('exist')

      projectAccess(owner).should('not.have.property', projectId)

      login(ADMIN_EMAIL)
      visitProjectsOf(owner)
      selectFilter('Trashed projects')
      rowAction(name, 'Restore')
      projectRow(name).should('not.exist')
      selectFilter('All projects')
      projectRow(name).should('exist')

      projectAccess(owner).its(projectId).should('equal', 'owner')
    })
  })

  it('deletes a trashed project, restores it and purges it', function () {
    const name = projectName('Delete')
    createProjects(owner, name).then(([projectId]) => {
      login(ADMIN_EMAIL)
      visitProjectsOf(owner)
      rowAction(name, 'Trash')
      dialog().findByRole('button', { name: 'Trash' }).click()
      selectFilter('Trashed projects')
      rowAction(name, 'Delete')
      dialog().within(() => {
        cy.contains('Delete Projects').should('exist')
        cy.findByRole('button', { name: 'Delete' }).click()
      })
      dialog().should('not.exist')
      selectFilter('Delete Projects')
      projectRow(name).should('exist')

      login(owner)
      cy.request({ url: `/project/${projectId}`, failOnStatusCode: false })
        .its('status')
        .should('equal', 404)

      login(ADMIN_EMAIL)
      visitProjectsOf(owner)
      selectFilter('Delete Projects')
      rowAction(name, 'Restore')
      dialog().findByRole('button', { name: 'Restore' }).click()
      dialog().should('not.exist')
      selectFilter('All projects')
      projectRow(name).should('exist')
      // Restored out of the trash, named "<name> (Restored)"
      projectAccess(owner).its(projectId).should('equal', 'owner')

      login(ADMIN_EMAIL)
      visitProjectsOf(owner)
      rowAction(name, 'Trash')
      dialog().findByRole('button', { name: 'Trash' }).click()
      selectFilter('Trashed projects')
      rowAction(name, 'Delete')
      dialog().findByRole('button', { name: 'Delete' }).click()
      selectFilter('Delete Projects')
      rowAction(name, 'purge')
      dialog().findByRole('button', { name: 'purge' }).click()
      dialog().should('not.exist')
      projectRow(name).should('not.exist')
      cy.reload()
      adminProjects(owner).then(projects => {
        expect(projects.map((p: { id: string }) => p.id)).not.to.include(
          projectId
        )
      })
    })
  })

  it('downloads a project as a zip file', function () {
    const name = projectName('Zip')
    createProjects(owner, name).then(([projectId]) => {
      login(ADMIN_EMAIL)
      visitProjectsOf(owner)
      projectRow(name)
        .findByRole('button', { name: 'Download .zip file' })
        .should('exist')
      cy.request(`/project/${projectId}/download/zip`).then(response => {
        expect(response.status).to.equal(200)
        expect(response.headers['content-type']).to.contain('zip')
      })
    })
  })
})

describe('changing the owner', function () {
  it("gives one project to another user and keeps the old owner as editor", function () {
    const name = projectName('Give')
    createProjects(owner, name).then(([projectId]) => {
      login(ADMIN_EMAIL)
      visitProjectsOf(owner)
      rowAction(name, 'Change owner')
      dialog().within(() => {
        cy.contains('Change project owner').should('exist')
        cy.contains(name).should('exist')
        cy.findByRole('button', { name: 'Change owner' }).should('be.disabled')
        selectNewOwner(newOwner)
        cy.findByRole('button', { name: 'Change owner' }).click()
      })
      dialog().should('not.exist')
      // The list of the old owner drops it
      projectRow(name).should('not.exist')

      projectAccess(newOwner).its(projectId).should('equal', 'owner')
      projectAccess(owner).its(projectId).should('equal', 'readWrite')

      login(ADMIN_EMAIL)
      visitProjectsOf(newOwner)
      projectRow(name).should('contain.text', nameOf(newOwner))
    })
  })

  it('does not offer the current owner as the new owner', function () {
    const name = projectName('Self')
    createProjects(owner, name)
    login(ADMIN_EMAIL)
    visitProjectsOf(owner)
    rowAction(name, 'Change owner')
    dialog().within(() => {
      ownerInput().type(owner)
      cy.contains('No results').should('exist')
      cy.findByRole('option').should('not.exist')
      cy.findByRole('button', { name: 'Cancel' }).click()
    })
  })

  it('gives several selected projects to another user at once', function () {
    const names = [projectName('BulkA'), projectName('BulkB')]
    const kept = projectName('Kept')
    createProjects(owner, ...names, kept).then(ids => {
      login(ADMIN_EMAIL)
      visitProjectsOf(owner)
      for (const name of names) {
        projectRow(name).find('input[type="checkbox"]').check()
      }
      cy.get('.project-tools')
        .findByRole('button', { name: 'Change owner' })
        .click()
      dialog().within(() => {
        for (const name of names) cy.contains(name).should('exist')
        cy.contains(kept).should('not.exist')
        selectNewOwner(newOwner)
        cy.findByRole('button', { name: 'Change owner' }).click()
      })
      dialog().should('not.exist')
      for (const name of names) projectRow(name).should('not.exist')
      projectRow(kept).should('exist')

      projectAccess(newOwner).then(access => {
        expect(access[ids[0]]).to.equal('owner')
        expect(access[ids[1]]).to.equal('owner')
        expect(access).not.to.have.property(ids[2])
      })
      projectAccess(owner).then(access => {
        expect(access[ids[0]]).to.equal('readWrite')
        expect(access[ids[1]]).to.equal('readWrite')
        expect(access[ids[2]]).to.equal('owner')
      })
    })
  })

  it("moves every project when the owner's account is deleted", function () {
    const leaving = `admin-tools-leaving-${uuid()}@example.com`
    ensureUserExists(leaving)
    const names = [projectName('LeftA'), projectName('LeftB')]
    createProjects(leaving, ...names).then(ids => {
      login(ADMIN_EMAIL)
      cy.visit('/admin/user')
      searchUsers(leaving)
      rowAction(leaving, 'Delete')
      dialog().within(() => {
        cy.findByLabelText('Transfer this user’s projects').check()
        selectNewOwner(newOwner)
        cy.findByRole('button', { name: 'Delete' }).click()
      })
      dialog().should('not.exist')

      projectAccess(newOwner).then(access => {
        expect(access[ids[0]]).to.equal('owner')
        expect(access[ids[1]]).to.equal('owner')
      })
      login(ADMIN_EMAIL)
      visitProjectsOf(newOwner)
      for (const name of names) projectRow(name).should('exist')
    })
  })
})

describe('several selected projects', function () {
  let names: string[]
  let ids: string[]

  function selectRows() {
    for (const name of names) {
      projectRow(name).find('input[type="checkbox"]').check()
    }
  }

  function toolbar() {
    return cy.get('.project-tools')
  }

  beforeEach(function () {
    names = [projectName('ManyA'), projectName('ManyB')]
    createProjects(owner, ...names).then(created => {
      ids = created
    })
    login(ADMIN_EMAIL)
    visitProjectsOf(owner)
    selectRows()
  })

  it('trashes them and takes them out of the trash', function () {
    toolbar().findByRole('button', { name: 'Trash' }).click()
    dialog().within(() => {
      for (const name of names) cy.contains(name).should('exist')
      cy.findByRole('button', { name: 'Trash' }).click()
    })
    dialog().should('not.exist')
    projectAccess(owner).then(access => {
      for (const id of ids) expect(access).not.to.have.property(id)
    })

    login(ADMIN_EMAIL)
    visitProjectsOf(owner)
    selectFilter('Trashed projects')
    selectRows()
    toolbar().findByRole('button', { name: 'Restore' }).click()
    for (const name of names) projectRow(name).should('not.exist')
    projectAccess(owner).then(access => {
      for (const id of ids) expect(access[id]).to.equal('owner')
    })
  })

  it('deletes them and purges them', function () {
    toolbar().findByRole('button', { name: 'Trash' }).click()
    dialog().findByRole('button', { name: 'Trash' }).click()
    dialog().should('not.exist')
    selectFilter('Trashed projects')
    selectRows()
    toolbar().findByRole('button', { name: 'Delete' }).click()
    dialog().findByRole('button', { name: 'Delete' }).click()
    dialog().should('not.exist')

    selectFilter('Delete Projects')
    for (const name of names) projectRow(name).should('exist')
    selectRows()
    toolbar().findByRole('button', { name: 'purge' }).click()
    dialog().findByRole('button', { name: 'purge' }).click()
    dialog().should('not.exist')
    adminProjects(owner).then(projects => {
      const left = projects.map((p: { id: string }) => p.id)
      for (const id of ids) expect(left).not.to.include(id)
    })
  })

  it('restores them after they were deleted', function () {
    toolbar().findByRole('button', { name: 'Trash' }).click()
    dialog().findByRole('button', { name: 'Trash' }).click()
    dialog().should('not.exist')
    selectFilter('Trashed projects')
    selectRows()
    toolbar().findByRole('button', { name: 'Delete' }).click()
    dialog().findByRole('button', { name: 'Delete' }).click()
    dialog().should('not.exist')

    selectFilter('Delete Projects')
    selectRows()
    toolbar().findByRole('button', { name: 'Restore' }).click()
    dialog().findByRole('button', { name: 'Restore' }).click()
    dialog().should('not.exist')
    projectAccess(owner).then(access => {
      for (const id of ids) expect(access[id]).to.equal('owner')
    })
  })

  it('downloads them in one zip file', function () {
    toolbar().findByRole('button', { name: 'Download' }).should('exist')
    cy.then(() =>
      cy.request(`/project/download/zip?project_ids=${ids.join(',')}`)
    ).then(response => {
      expect(response.status).to.equal(200)
      expect(response.headers['content-type']).to.contain('zip')
    })
  })
})

describe('every project', function () {
  it('lists the projects of all users with their owners', function () {
    const mine = projectName('AllMine')
    const theirs = projectName('AllTheirs')
    createProjects(owner, mine)
    createProjects(newOwner, theirs)

    login(ADMIN_EMAIL)
    cy.visit('/project')
    cy.findByRole('menuitem', { name: 'Admin' }).click()
    cy.findByRole('menuitem', { name: 'Project/Object Lookup' }).click()
    cy.url().should('contain', '/admin/project')
    projectRow(mine).should('contain.text', nameOf(owner))
    projectRow(theirs).should('contain.text', nameOf(newOwner))
  })

  it('finds projects by name, id and owner email', function () {
    const name = projectName('Find')
    createProjects(owner, name).then(([projectId]) => {
      login(ADMIN_EMAIL)
      visitAllProjects()
      searchProjects(name)
      projectRow(name).should('exist')
      cy.get('tbody tr').should('have.length', 1)

      searchProjects(projectId)
      projectRow(name).should('exist')
      cy.get('tbody tr').should('have.length', 1)

      searchProjects(owner)
      projectRow(name).should('exist')
      cy.contains('tbody tr', nameOf(newOwner)).should('not.exist')
    })
  })

  it('changes the owner and shows the new one in the list', function () {
    const name = projectName('AllGive')
    createProjects(owner, name).then(([projectId]) => {
      login(ADMIN_EMAIL)
      visitAllProjects()
      searchProjects(name)
      rowAction(name, 'Change owner')
      dialog().within(() => {
        selectNewOwner(newOwner)
        cy.findByRole('button', { name: 'Change owner' }).click()
      })
      dialog().should('not.exist')
      // The search results show the change too
      projectRow(name).should('contain.text', nameOf(newOwner))

      projectAccess(newOwner).its(projectId).should('equal', 'owner')
    })
  })

  it('takes a trashed project out of the search results', function () {
    const name = projectName('AllTrash')
    createProjects(owner, name)
    login(ADMIN_EMAIL)
    visitAllProjects()
    searchProjects(name)
    rowAction(name, 'Trash')
    dialog().findByRole('button', { name: 'Trash' }).click()
    dialog().should('not.exist')
    projectRow(name).should('not.exist')
    selectFilter('Trashed projects')
    projectRow(name).should('exist')
  })
})
