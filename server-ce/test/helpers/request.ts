// POSTs like the page's own forms do, using the CSRF token of the current page.
export function postWithCsrf(url: string, body: Record<string, string>) {
  return cy
    .get('meta[name="ol-csrfToken"]')
    .invoke('attr', 'content')
    .then(csrfToken =>
      cy.request({
        method: 'POST',
        url,
        body,
        headers: { 'X-Csrf-Token': csrfToken as string },
        failOnStatusCode: false,
        followRedirect: false,
      })
    )
}
