// This is an autogenerated file. Don't edit this file manually.
export interface themeinit {
  /**
   * The Git URL to clone from. Defaults to Shopify's example theme, Dawn: https://github.com/Shopify/dawn.git
   * @environment SHOPIFY_FLAG_CLONE_URL
   */
  '-u, --clone-url <value>'?: string

  /**
   * Uses the new framework theme as the default clone-url
   * @environment SHOPIFY_FLAG_CLONE_URL
   */
  '-p, --dev-preview'?: ''

  /**
   * Downloads the latest release of the `clone-url`
   * @environment SHOPIFY_FLAG_LATEST
   */
  '-l, --latest'?: ''

  /**
   * Disable color output.
   * @environment SHOPIFY_FLAG_NO_COLOR
   */
  '--no-color'?: ''

  /**
   * The path to your theme directory.
   * @environment SHOPIFY_FLAG_PATH
   */
  '--path <value>'?: string

  /**
   * Increase the verbosity of the output.
   * @environment SHOPIFY_FLAG_VERBOSE
   */
  '--verbose'?: ''
}
