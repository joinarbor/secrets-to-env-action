import * as core from '@actions/core'
import {appendFile} from 'fs'

import {camelCase} from 'camel-case'
import {constantCase} from 'constant-case'
import {pascalCase} from 'pascal-case'
import {snakeCase} from 'snake-case'

let excludeList = [
  // this variable is already exported automatically
  'github_token'
]

const convertTypes: Record<string, (s: string) => string> = {
  lower: s => s.toLowerCase(),
  upper: s => s.toUpperCase(),
  camel: camelCase,
  constant: constantCase,
  pascal: pascalCase,
  snake: snakeCase
}

async function run(): Promise<void> {
  try {
    const secretsJson: string = core.getInput('secrets', {
      required: true
    })
    const varsJson: string = core.getInput('vars')
    const keyPrefix: string = core.getInput('prefix')
    const includeListStr: string = core.getInput('include')
    const excludeListStr: string = core.getInput('exclude')
    const convert: string = core.getInput('convert')
    const output: string = core.getInput('output')

    let secrets: Record<string, string>
    let vars: Record<string, string>
    try {
      secrets = JSON.parse(secretsJson)
      vars = JSON.parse(varsJson)
      if (vars) {
        secrets = {...secrets, ...vars}
      }
    } catch (e) {
      throw new Error(`Cannot parse JSON secrets.
Make sure you add the following to this action:

with:
      secrets: \${{ toJSON(secrets) }}
`)
    }

    let includeList: string[] | null = null
    if (includeListStr.length) {
      includeList = includeListStr.split(',').map(key => key.trim())
    }

    if (excludeListStr.length) {
      excludeList = excludeList.concat(
        excludeListStr.split(',').map(key => key.trim())
      )
    }

    core.debug(`Using include list: ${includeList?.join(', ')}`)
    core.debug(`Using exclude list: ${excludeList.join(', ')}`)

    for (const key of Object.keys(secrets)) {
      if (includeList && !includeList.includes(key)) {
        continue
      }

      if (excludeList.includes(key)) {
        continue
      }

      let newKey = keyPrefix.length ? `${keyPrefix}${key}` : key

      if (convert.length) {
        if (!convertTypes[convert]) {
          throw new Error(
            `Unknown convert value "${convert}". Available: ${Object.keys(
              convertTypes
            ).join(', ')}`
          )
        }
        newKey = convertTypes[convert](newKey)
      }

      if (process.env[newKey]) {
        core.warning(`Will re-write "${newKey}" environment variable.`)
      }

      core.exportVariable(newKey, secrets[key])
      core.info(`Exported secret ${newKey}`)
      if (output) {
        appendFile(
          output,
          `\n${newKey}=${secrets[key].replace(/[\r\n]+/gm, '')}`,
          err => {
            if (err) throw err
          }
        )
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
