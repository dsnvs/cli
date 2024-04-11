import {CreditCardPaymentsAppExtensionDeployConfigType} from '../payments_app_extension_schemas/credit_card_payments_app_extension_schema.js'
import {CustomCreditCardPaymentsAppExtensionDeployConfigType} from '../payments_app_extension_schemas/custom_credit_card_payments_app_extension_schema.js'
import {CustomOnsitePaymentsAppExtensionDeployConfigType} from '../payments_app_extension_schemas/custom_onsite_payments_app_extension_schema.js'
import {RedeemablePaymentsAppExtensionDeployConfigType} from '../payments_app_extension_schemas/redeemable_payments_app_extension_schema.js'
import {ExtensionRegistration} from '../../../../api/graphql/all_app_extension_registrations.js'
import {slugify} from '@shopify/cli-kit/common/string'

type Config =
  | CreditCardPaymentsAppExtensionDeployConfigType
  | CustomCreditCardPaymentsAppExtensionDeployConfigType
  | CustomOnsitePaymentsAppExtensionDeployConfigType
  | RedeemablePaymentsAppExtensionDeployConfigType

export function extensionUuidToHandle(config: Config, allExtensions: ExtensionRegistration[]) {
  const copyConfig = {...config}
  let uiExtensionHandle = copyConfig.ui_extension_handle

  if ('ui_extension_registration_uuid' in copyConfig) {
    const uiExtensionTitle = allExtensions.find((ext) => ext.uuid === copyConfig.ui_extension_registration_uuid)?.title

    if (uiExtensionTitle && !uiExtensionHandle) {
      uiExtensionHandle = slugify(uiExtensionTitle)
    }
  }

  return uiExtensionHandle
}
