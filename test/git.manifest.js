'use strict'

const util = require('util')

const gitMock = require('./util/git.js')
const { mockRepoDisposer } = require('./util/git.js')

const npmlog = require('npmlog')
const path = require('path')
const rimraf = util.promisify(require('rimraf'))
const Tacks = require('tacks')
const { test } = require('tap')
const testDir = require('./util/test-dir.js')(__filename)

const Dir = Tacks.Dir
const File = Tacks.File

const manifest = require('../manifest')

const OPTS = {
  cache: path.join(testDir, 'cache'),
  registry: 'https://mock.reg',
  log: npmlog,
  retry: {
    retries: 1,
    factor: 1,
    minTimeout: 1,
    maxTimeout: 10
  }
}

test(
  'get manifest from package.json in git clone',
  {
    skip: process.platform === 'win32' && 'git daemon does not close on windows'
  },
  (t) => {
    const fixture = new Tacks(
      Dir({
        foo: Dir({
          'package.json': File({
            name: 'foo',
            version: '1.2.3'
          }),
          'index.js': File('hello')
        })
      })
    )
    fixture.create(testDir)

    const disposer = (target, result, shouldThrow = false) => {
      const returnResult = () => {
        if (shouldThrow) {
          throw result
        }
        return result
      }
      return mockRepoDisposer(target)
        .then(() => returnResult())
        .catch(() => returnResult())
    }

    const cb = (srv) => {
      return manifest(`bar@git://127.0.0.1:${srv.port}/`, OPTS).then((mani) => {
        t.similar(
          mani,
          {
            name: 'foo',
            version: '1.2.3',
            _resolved: new RegExp(`git://127.0.0.1:${srv.port}/#[a-f0-9]{40}$`),
            _shasum: null,
            _shrinkwrap: null,
            _id: 'foo@1.2.3'
          },
          'manifest fetched correctly'
        )
      })
    }

    return gitMock({ cwd: path.join(testDir, 'foo') }).then((srv) =>
      cb(srv)
        .then((result) => disposer(srv, result))
        .catch((err) => disposer(srv, err, true))
    )
  }
)

test('cleanup?', { skip: process.platform === 'win32' }, () => rimraf(testDir))
