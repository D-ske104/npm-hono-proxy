#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Resolve dist output relative to this CLI file location
const thisDir = dirname(fileURLToPath(import.meta.url))
const entry = resolve(thisDir, '..', 'dist', 'index.js')
const entryUrl = pathToFileURL(entry).href

// Dynamically import the built ESM entry
import(entryUrl)
