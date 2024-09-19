// This is an autogenerated file. Don't edit this file manually.
export interface themeconsole {
  /**
   * The environment to apply to the current command.
   * @environment SHOPIFY_FLAG_ENVIRONMENT
   */
  '-e, --environment <value>'?: string

  /**
   * Disable color output.
   * @environment SHOPIFY_FLAG_NO_COLOR
   */
  '--no-color'?: ''

  /**
   * Password generated from the Theme Access app.
   * @environment SHOPIFY_CLI_THEME_TOKEN
   */
  '--password <value>'?: string

  /**
   * Store URL. It can be the store prefix (example) or the full myshopify.com URL (example.myshopify.com, https://example.myshopify.com).
   * @environment SHOPIFY_FLAG_STORE
   */
  '-s, --store <value>'?: string

  /**
   * The password for storefronts with password protection.
   * @environment SHOPIFY_FLAG_STORE_PASSWORD
   */
  '--store-password <value>'?: string

  /**
   * The url to be used as context
   * @environment SHOPIFY_FLAG_URL
   */
  '--url <value>'?: string

  /**
   * Increase the verbosity of the output.
   * @environment SHOPIFY_FLAG_VERBOSE
   */
  '--verbose'?: ''
}
