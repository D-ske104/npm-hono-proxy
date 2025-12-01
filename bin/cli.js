#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

// Resolve dist output and execute
const entry = resolve(process.cwd(), 'dist', 'index.mjs')
const entryUrl = pathToFileURL(entry).href

// Dynamically import the built ESM entry
import(entryUrl)
