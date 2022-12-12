import {isTruthy} from './utilities.js'
import {getCachedSpinFqdn, setCachedSpinFqdn} from './spin-cache.js'
import constants from '../constants.js'
import {captureOutput} from '../system.js'
import {Abort} from '../error.js'
import {content, token} from '../output.js'
import {exists, readSync} from '../file.js'
import {getEnvironmentVariables} from '../public/node/environment.js'

const spinFqdnFilePath = '/etc/spin/machine/fqdn'

/**
 * When ran in a Spin environment, it returns the fqdn of the instance.
 *
 * Will cache the value of the Spin FQDN during the execution of the CLI.
 * To avoid multiple calls to `readSync` or `show`
 * @returns fqdn of the Spin environment.
 */
export async function fqdn(): Promise<string> {
  let spinFqdn = getCachedSpinFqdn()
  if (spinFqdn) return spinFqdn

  if (await exists(spinFqdnFilePath)) {
    spinFqdn = await readSync(spinFqdnFilePath).toString()
  } else {
    const spinInstance = await instance()
    const showResponse = await show(spinInstance)

    spinFqdn = showResponse.fqdn
  }
  setCachedSpinFqdn(spinFqdn)
  return spinFqdn
}

/**
 * Runs "spin show" and returns the JSON-parsed output.
 * @param spinInstance - When it's undefined, we'll fetch the latest one.
 * @returns The JSON-parsed output of the Spin CLI.
 * @throws Any error raised from the underlying Spin CLI.
 */
export async function show(spinInstance: string | undefined): Promise<{fqdn: string}> {
  const latest = spinInstance === undefined
  const args = latest ? ['show', '--latest', '--json'] : ['show', '--json']
  const output = await captureOutput('spin', args, {env: getEnvironmentVariables()})
  const json = JSON.parse(output)
  if (json.error) {
    const errorMessage = content`${token.genericShellCommand(
      `spin`,
    )} yielded the following error trying to obtain the fully qualified domain name of the Spin instance:
  ${json.error}
    `
    let nextSteps: string | undefined
    if (spinInstance) {
      nextSteps = `Make sure ${spinInstance} is the instance name and not a fully qualified domain name`
    }
    throw new Abort(errorMessage, nextSteps)
  } else {
    return json
  }
}

/**
 * Returns true if the CLI is running in a Spin environment.
 * @returns True if the CLI is running in a Spin environment.
 */
export function isSpin(): boolean {
  return isTruthy(getEnvironmentVariables()[constants.environmentVariables.spin])
}

/**
 * Returns the value of the SPIN_INSTANCE environment variable.
 * @returns The value of the SPIN_INSTANCE environment variable.
 */
export function instance(): string | undefined {
  return getEnvironmentVariables()[constants.environmentVariables.spinInstance]
}

/**
 * Returns the value of the SPIN_WORKSPACE environment variable.
 * @returns The value of the SPIN_WORKSPACE environment variable.
 */
export function workspace(): string | undefined {
  return getEnvironmentVariables()[constants.environmentVariables.spinWorkspace]
}

/**
 * Returns the value of the SPIN_NAMESPACE environment variable.
 * @returns The value of the SPIN_NAMESPACE environment variable.
 */
export function namespace(): string | undefined {
  return getEnvironmentVariables()[constants.environmentVariables.spinNamespace]
}

/**
 * Returns the value of the SPIN_HOST environment variable.
 * @returns The value of the SPIN_HOST environment variable.
 */
export function host(): string | undefined {
  return getEnvironmentVariables()[constants.environmentVariables.spinHost]
}
