# E2E tests

These tests install Overleaf Pro the same way a user would (with the
[toolkit](https://github.com/ayaka-notes/toolkit)), then click through it in a
browser with Cypress.

CI runs them daily against the latest ops image, one suite per runner
(`.github/workflows/test_ops_image.yml`). It can also be started by hand with
another ops tag.

## How to run

Go to `server-ce/test/toolkit` and run:

```sh
make setup SUITE=launchpad   # install and start Overleaf
make test_launchpad          # run the launchpad tests
make clean                   # remove everything again
```

Run `make clean` before you set up for another suite, every suite starts
from an empty Overleaf.

If port 80 is already in use on your machine, add `OVERLEAF_PORT=8080` to
`make setup`. To test an image other than the latest ops image, add
`OVERLEAF_IMAGE=<image>`.

The E2E settings disable request rate limits. The login-register suite sets
`E2E_DISABLE_RATE_LIMITS=false` because it also tests registration rate limiting.

## Suites

One folder per module in `toolkit/suites/`, named and nested like
`services/web/modules`:

- `launchpad/` – creating the first admin, status checks, admin adds a user.
- `login-register/` – login, logout and public sign up with email and
  password. The `domain/` variant runs afterwards with sign up restricted to
  one email domain.
- `sandboxed-compiles/` – compiling in sibling containers, switching between
  two TeX Live images, XeLaTeX, errors, stopping a compile, SyncTeX.
- `symbol-palette/` – searching by command, description and character,
  empty search results, clicking symbols to insert them at the editor cursor.
- `template-gallery/` – publishing a project as a template, the gallery
  (categories, search, sort, pages), editing, overwriting and deleting
  templates, creating projects from them, permissions.
- `authentication/ldap/`, `authentication/saml/`, `authentication/oidc/` –
  login through [goauthentik](https://goauthentik.io), admin mapping and its
  updates on login. LDAP and SAML start with the launchpad's email-only admin
  form on the empty instance. Each has a variant without admin mapping, OIDC
  one with allowed email domains too. These are separate suites, run them
  with `make setup SUITE=authentication/saml` and
  `make test SUITE=authentication/saml`.

Things that need email (activation mails, password reset) are not tested.

## What is where

- `toolkit/suites/` – the tests, see above.
- `toolkit/config/` – settings every suite uses, written into the toolkit's
  `config/overleaf.rc` and `config/variables.env`.
- `toolkit/suites/<name>/overleaf.rc`, `variables.env` – optional extra
  settings for just that suite, applied after `toolkit/config/`.
- `toolkit/suites/<name>/<variant>/` – optional second mode of the same
  module: its own specs plus the settings that differ. `make test_<name>`
  applies them, restarts Overleaf and runs the variant after the main specs.
- `helpers/` – small functions shared by tests, like logging in or creating
  a user or a project.
- `toolkit/services/` – extra containers a suite needs, e.g. `authentik/`.
  A suite lists them in its `services` file. `make setup` starts them next to
  Overleaf on the toolkit's network, `make clean` removes them. Their secrets
  are generated on every setup, none are stored in the repository.
- `toolkit/bin/` – scripts used by the Makefile.
- `toolkit/Makefile` – the `setup`, `test_<name>` and `clean` commands.
- Everything else (`Dockerfile.cypress`, `cypress.config.ts`,
  `package.json`, ...) is plumbing you normally don't touch.

## Adding tests for a new module

1. Make a folder `toolkit/suites/<name>/` and put `*.spec.ts` files in it.
2. Need special settings? Add `overleaf.rc` or `variables.env` in that folder
   with only the lines you want to change.
3. The tests must not rely on other suites, each one runs on its own fresh
   instance. Create users with `ensureUserExists` from `helpers/users.ts`.
4. `make setup SUITE=<name>`, then `make test_<name>`.
5. Add `<name>` to the `e2e-test` matrix in `test_ops_image.yml`.
