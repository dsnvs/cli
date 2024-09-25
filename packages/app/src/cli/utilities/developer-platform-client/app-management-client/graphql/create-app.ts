import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {gql} from 'graphql-request'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
export const CreateAppMutation = gql`
  mutation CreateApp($initialVersion: AppVersionInput!) {
    appCreate(initialVersion: $initialVersion) {
      app {
        id
        key
      }
      userErrors {
        category
        message
        on
      }
    }
  }
`

export interface CreateAppMutationVariables {
  initialVersion: {sourceUrl: string} | {source: JsonMapType}
}

export interface CreateAppMutationSchema {
  appCreate: {
    app: {
      id: string
      key: string
    }
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
