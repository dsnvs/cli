import {ALLOWED_ROLES, Role} from '../../utilities/theme-selector/fetch.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {list} from '../../services/list.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'

export default class List extends ThemeCommand {
  static description = 'Lists the themes in your store, along with their IDs and statuses.'

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    password: themeFlags.password,
    store: themeFlags.store,
    role: Flags.custom<Role>({
      description: 'Only list themes with the given role.',
      options: ALLOWED_ROLES,
      env: 'SHOPIFY_FLAG_ROLE',
    })(),
    name: Flags.string({
      description: 'Only list themes that contain the given name.',
      env: 'SHOPIFY_FLAG_NAME',
    }),
    id: Flags.integer({
      description: 'Only list theme with the given ID.',
      env: 'SHOPIFY_FLAG_ID',
    }),
    environment: themeFlags.environment,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)

    if (flags.environment) {
      await Promise.all(
        flags.environment.map(async (env) => {
          const envConfig = await loadEnvironment(env, 'shopify.theme.toml')
          const envFlags = {
            ...flags,
            ...envConfig,
            environment: env,
          }
          const store = ensureThemeStore(envFlags)
          const adminSession = await ensureAuthenticatedThemes(store, envFlags.password)
          await list(adminSession, envFlags)
        }),
      )
    } else {
      const store = ensureThemeStore(flags)
      const adminSession = await ensureAuthenticatedThemes(store, flags.password)
      await list(adminSession, flags)
    }
  }
}
// Note: I think paraller is what we are looking for overall, and but I'm not sure what will surface with push/pull commands.

// Sequential Option?
// if (flags.environment) {
//   for (const env of flags.environment) {
//     const envConfig = await loadEnvironment(env, 'shopify.theme.toml')
//     const envFlags = {
//       ...flags,
//       ...envConfig,
//       environment: env,
//     }
//     const store = ensureThemeStore(envFlags)
//     const adminSession = await ensureAuthenticatedThemes(store, envFlags.password)
//     console.log(`\nEnvironment: ${env}`)
//     await list(adminSession, envFlags)
//   }
// }
