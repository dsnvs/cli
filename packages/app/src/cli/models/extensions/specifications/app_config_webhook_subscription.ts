import {WebhookSubscriptionUriValidation, removeTrailingSlash} from './validation/common.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const WebhookSubscriptionSpecIdentifier = 'webhook_subscription'

interface TransformedWebhookSubscription {
  api_version: string
  uri: string
  topic: string
  compliance_topics?: string[]
  include_fields?: string[]
  filter?: string
}

export const SingleWebhookSubscriptionSchema = zod.object({
  topic: zod.string(),
  api_version: zod.string(),
  uri: zod.preprocess(removeTrailingSlash, WebhookSubscriptionUriValidation, {required_error: 'Missing value at'}),
  include_fields: zod.array(zod.string({invalid_type_error: 'Value must be a string'})).optional(),
  filter: zod.string({invalid_type_error: 'Value must be a string'}).optional(),
})

/* this transforms webhooks remotely to be accepted by the TOML
ie.
  given:
  {
    subscriptions: [
      { topic: 'products/create', uri: 'https://example.com/webhooks/products'},
      { topic: 'orders/delete', uri: https://example.com/webhooks/orderss'},
      { topic: 'orders/create', uri: 'https://example.com/webhooks/orders'},
    ]
  }
  the function should return:
  {
    webhooks: {
          api_version: '2024-01',
          subscriptions: [
            {
              topics: ['orders/delete', 'orders/create'],
              uri: 'https://example.com/webhooks/orders',
            },
            {
              topics: ['products/create'],
              uri: 'https://example.com/webhooks/products',
            },
          ]
      }
  }
  */
function transformToWebhookSubscriptionConfig(content: object) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {api_version, topic, ...otherFields} = content as TransformedWebhookSubscription
  const subscription = {topics: [topic], ...otherFields}
  return {
    webhooks: {
      subscriptions: [subscription],
    },
  }
}

const WebhookSubscriptionTransformConfig: CustomTransformationConfig = {
  forward: (content) => content,
  reverse: (content: object) => transformToWebhookSubscriptionConfig(content),
}

const appWebhookSubscriptionSpec = createConfigExtensionSpecification({
  identifier: WebhookSubscriptionSpecIdentifier,
  schema: SingleWebhookSubscriptionSchema,
  transformConfig: WebhookSubscriptionTransformConfig,
  uidStrategy: 'dynamic',
})

export default appWebhookSubscriptionSpec
