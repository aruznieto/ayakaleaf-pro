# E2E tests against an instance deployed the way users deploy it: clone the
# toolkit, bin/init, edit config/, bin/up. Cypress then drives it from a
# container on the toolkit's docker network.
#
#   make setup [SUITE=<suite>]   deploy, layering suites/<suite>/ config if any
#   make test_<suite>            run suites/<suite>/*.spec.ts, then each variant
#                                subfolder with its own config (see bin/run-suite)
#   make clean                   remove the deployment and its data

SHELL := /bin/bash

MONOREPO := $(abspath ../../..)
TEST_ROOT := $(abspath ..)

TOOLKIT_REPO ?= https://github.com/ayaka-notes/toolkit.git
TOOLKIT_REF ?= 5132d5a0e97659b8149df2b407585d21853d7486
TOOLKIT_DIR ?= $(HOME)/ayakaleaf-toolkit-e2e
TOOLKIT_NETWORK ?= overleaf_default

# Image under test, tagged locally as OVERLEAF_IMAGE_NAME:<toolkit version>
OVERLEAF_IMAGE ?= ghcr.io/ayaka-notes/overleaf-pro/ops:latest
OVERLEAF_IMAGE_NAME := $(shell sed -n 's/^OVERLEAF_IMAGE_NAME=//p' config/overleaf.rc)

CYPRESS_IMAGE ?= overleaf-pro-e2e-cypress
STARTUP_TIMEOUT ?= 300

SUITE ?=
# Host port, only needed when the toolkit default (80) is taken locally
OVERLEAF_PORT ?=

.PHONY: setup clean

setup:
	@if [[ -e "$(TOOLKIT_DIR)" ]]; then \
		echo "$(TOOLKIT_DIR) already exists, run 'make clean' first"; \
		exit 1; \
	fi
	@if [[ -n "$(SUITE)" && ! -d "suites/$(SUITE)" ]]; then \
		echo "unknown suite '$(SUITE)'"; \
		exit 1; \
	fi
	git clone --quiet $(TOOLKIT_REPO) $(TOOLKIT_DIR)
	git -C $(TOOLKIT_DIR) checkout --quiet $(TOOLKIT_REF)
	$(TOOLKIT_DIR)/bin/init
	bin/apply-config $(TOOLKIT_DIR)/config/overleaf.rc config/overleaf.rc
	bin/apply-config $(TOOLKIT_DIR)/config/variables.env config/variables.env
	@for f in overleaf.rc variables.env; do \
		if [[ -n "$(SUITE)" && -f "suites/$(SUITE)/$$f" ]]; then \
			echo "Applying suites/$(SUITE)/$$f"; \
			bin/apply-config $(TOOLKIT_DIR)/config/$$f suites/$(SUITE)/$$f; \
		fi; \
	done
	@if [[ -n "$(OVERLEAF_PORT)" ]]; then \
		bin/apply-config $(TOOLKIT_DIR)/config/overleaf.rc <(echo "OVERLEAF_PORT=$(OVERLEAF_PORT)"); \
	fi
	docker image inspect $(OVERLEAF_IMAGE) >/dev/null 2>&1 || docker pull $(OVERLEAF_IMAGE)
	docker tag $(OVERLEAF_IMAGE) $(OVERLEAF_IMAGE_NAME):$$(head -n 1 $(TOOLKIT_DIR)/config/version)
	docker build \
		--build-arg USER_UID=$$(id -u) \
		--build-arg USER_GID=$$(id -g) \
		--file Dockerfile.cypress \
		--tag $(CYPRESS_IMAGE) \
		$(MONOREPO)
	$(TOOLKIT_DIR)/bin/up -d
	bin/wait-for-overleaf $(STARTUP_TIMEOUT)

test_%:
	@if [[ ! -d "suites/$*" ]]; then echo "unknown suite '$*'"; exit 1; fi
	TOOLKIT_DIR=$(TOOLKIT_DIR) \
	TOOLKIT_NETWORK=$(TOOLKIT_NETWORK) \
	TEST_ROOT=$(TEST_ROOT) \
	CYPRESS_IMAGE=$(CYPRESS_IMAGE) \
	STARTUP_TIMEOUT=$(STARTUP_TIMEOUT) \
		bin/run-suite $*

clean:
	@if [[ -d "$(TOOLKIT_DIR)" ]]; then \
		$(TOOLKIT_DIR)/bin/docker-compose down --volumes --remove-orphans --timeout 0; \
		docker run --rm --volume $(TOOLKIT_DIR):/toolkit --entrypoint rm $(OVERLEAF_IMAGE) -rf /toolkit/data; \
		rm -rf $(TOOLKIT_DIR); \
	fi
	rm -rf cypress/results cypress/downloads
