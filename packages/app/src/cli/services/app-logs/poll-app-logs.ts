import {
  AppEventData,
  AppLogsPollingCommandOutputFunction,
  AppLogsPollingCommandRetryOutputFunction,
  AppLogsPollingCommandErrorOutputFunction,
} from './types.js'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {fetch} from '@shopify/cli-kit/node/http'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

const POLLING_INTERVAL_MS = 450
const POLLING_BACKOFF_INTERVAL_MS = 10000

const generateFetchAppLogUrl = async (
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
) => {
  const fqdn = await partnersFqdn()
  let url = `https://${fqdn}/app_logs/poll`

  if (!cursor) {
    return url
  }

  url += `?cursor=${cursor}`

  if (filters?.status) {
    url += `&status=${filters.status}`
  }
  if (filters?.source) {
    url += `&source=${filters.source}`
  }

  return url
}

export const pollAppLogs = async ({
  stdout,
  appLogsFetchInput: {jwtToken, cursor, filters},
  apiKey,
  resubscribeCallback,
  commandOutputFunction,
  retryOutputFunction,
  errorOutputFunction,
}: {
  stdout: Writable
  appLogsFetchInput: {jwtToken: string; cursor?: string; filters?: {status?: string; source?: string}}
  apiKey: string
  resubscribeCallback: () => Promise<void>
  commandOutputFunction: AppLogsPollingCommandOutputFunction
  retryOutputFunction: AppLogsPollingCommandRetryOutputFunction
  errorOutputFunction: AppLogsPollingCommandErrorOutputFunction
}) => {
  try {
    const url = await generateFetchAppLogUrl(cursor, filters)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    })

    if (!response.ok) {
      const responseText = await response.text()
      if (response.status === 401) {
        await resubscribeCallback()
      } else if (response.status === 429 || response.status >= 500) {
        // Custom Logic: Retry
        await retryOutputFunction({stdout, response})
        setTimeout(() => {
          pollAppLogs({
            stdout,
            appLogsFetchInput: {
              jwtToken,
              cursor: undefined,
              filters,
            },
            apiKey,
            resubscribeCallback,
            commandOutputFunction,
            retryOutputFunction,
            errorOutputFunction,
          }).catch((error) => {
            outputDebug(`Unexpected error during polling: ${error}}\n`)
          })
        }, POLLING_BACKOFF_INTERVAL_MS)
      } else {
        throw new Error(`Error while fetching: ${responseText}`)
      }
      return
    }

    const data = (await response.json()) as {
      app_logs?: AppEventData[]
      cursor?: string
      errors?: string[]
    }
    if (data.app_logs) {
      const {app_logs: appLogs} = data

      for (const log of appLogs) {
        // Custom Logic: Output for CLI
        // eslint-disable-next-line no-await-in-loop
        await commandOutputFunction({stdout, log, apiKey})
      }
    }

    const cursorFromResponse = data?.cursor

    setTimeout(() => {
      pollAppLogs({
        stdout,
        appLogsFetchInput: {
          jwtToken,
          cursor: cursorFromResponse,
          filters,
        },
        apiKey,
        resubscribeCallback,
        commandOutputFunction,
        retryOutputFunction,
        errorOutputFunction,
      }).catch((error) => {
        outputDebug(`Unexpected error during polling: ${error}}\n`)
      })
    }, POLLING_INTERVAL_MS)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // Custom Logic: Error
    errorOutputFunction({stdout})
    outputDebug(`${error}}\n`)
  }
}
