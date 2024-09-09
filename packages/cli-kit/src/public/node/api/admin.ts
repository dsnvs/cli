import {graphqlRequest, GraphQLVariables} from './graphql.js'
import {AdminSession} from '../session.js'
import {outputContent, outputToken} from '../../../public/node/output.js'
import {BugError, AbortError} from '../error.js'
import {restRequestBody, restRequestHeaders, restRequestUrl} from '../../../private/node/api/rest.js'
import {fetch} from '../http.js'
import {ClientError, gql} from 'graphql-request'

/**
 * Executes a GraphQL query against the Admin API.
 *
 * @param query - GraphQL query to execute.
 * @param session - Shopify admin session including token and Store FQDN.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function adminRequest<T>(query: string, session: AdminSession, variables?: GraphQLVariables): Promise<T> {
  const api = 'Admin'
  const version = await fetchLatestSupportedApiVersion(session)
  const url = adminUrl(session.storeFqdn, version)
  return graphqlRequest({query, api, url, token: session.token, variables})
}

/**
 * GraphQL query to retrieve the latest supported API version.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @returns - The latest supported API version.
 */
async function fetchLatestSupportedApiVersion(session: AdminSession): Promise<string> {
  const apiVersions = await supportedApiVersions(session)
  return apiVersions.reverse()[0]!
}

/**
 * GraphQL query to retrieve all supported API versions.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @returns - An array of supported API versions.
 */
export async function supportedApiVersions(session: AdminSession): Promise<string[]> {
  const apiVersions = await fetchApiVersions(session)
  return apiVersions
    .filter((item) => item.supported)
    .map((item) => item.handle)
    .sort()
}

/**
 * GraphQL query to retrieve all API versions.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @returns - An array of supported and unsupported API versions.
 */
async function fetchApiVersions(session: AdminSession): Promise<ApiVersion[]> {
  const url = adminUrl(session.storeFqdn, 'unstable')
  const query = apiVersionQuery()
  try {
    const data: ApiVersionResponse = await graphqlRequest({
      query,
      api: 'Admin',
      url,
      token: session.token,
      variables: {},
      responseOptions: {handleErrors: false},
    })

    return data.publicApiVersions
  } catch (error) {
    if (error instanceof ClientError && error.response.status === 403) {
      const storeName = session.storeFqdn.replace('.myshopify.com', '')
      throw new AbortError(
        outputContent`Looks like you don't have access to this dev store: (${outputToken.link(
          storeName,
          `https://${session.storeFqdn}`,
        )})`,
        outputContent`If you're not the owner, create a dev store staff account for yourself`,
      )
    }
    throw new BugError(`Unknown error connecting to your store`)
  }
}

/**
 * Returns the Admin API URL for the given store and version.
 *
 * @param store - Store FQDN.
 * @param version - API version.
 * @returns - Admin API URL.
 */
export function adminUrl(store: string, version: string | undefined): string {
  const realVersion = version || 'unstable'
  return `https://${store}/admin/api/${realVersion}/graphql.json`
}

interface ApiVersion {
  handle: string
  supported: boolean
}

interface ApiVersionResponse {
  publicApiVersions: ApiVersion[]
}

/**
 * GraphQL query string to retrieve the latest supported API version.
 *
 * @returns - A query string.
 */
function apiVersionQuery(): string {
  return gql`
    query {
      publicApiVersions {
        handle
        supported
      }
    }
  `
}

/**
 * Executes a REST request against the Admin API.
 *
 * @param method - Request's HTTP method.
 * @param path - Path of the REST resource.
 * @param session - Shopify Admin session including token and Store FQDN.
 * @param requestBody - Request body of including REST resource specific parameters.
 * @param searchParams - Search params, appended to the URL.
 * @param apiVersion - Admin API version.
 * @returns - The {@link RestResponse}.
 */
export async function restRequest<T>(
  method: string,
  path: string,
  session: AdminSession,
  requestBody?: T,
  searchParams: {[name: string]: string} = {},
  apiVersion = 'unstable',
): Promise<RestResponse> {
  const url = restRequestUrl(session, apiVersion, path, searchParams)
  const body = restRequestBody<T>(requestBody)

  const headers = restRequestHeaders(session)
  const response = await fetch(url, {
    headers,
    method,
    body,
  })

  const json = await response.json().catch(() => ({}))

  return {
    json,
    status: response.status,
    headers: response.headers.raw(),
  }
}

/**
 * Respose of a REST request.
 */
export interface RestResponse {
  /**
   * REST JSON respose.
   */
  // Using `any` to avoid introducing extra DTO layers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any

  /**
   * HTTP response status.
   */
  status: number

  /**
   * HTTP response headers.
   */
  headers: {[key: string]: string[]}
}
