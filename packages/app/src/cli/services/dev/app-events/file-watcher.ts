/* eslint-disable no-case-declarations */
import {AppInterface} from '../../../models/app/app.js'
import {configurationFileNames} from '../../../constants.js'
import {dirname, isSubpath, joinPath, normalizePath, relativePath} from '@shopify/cli-kit/node/path'
import {FSWatcher} from 'chokidar'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {startHRTime, StartTime} from '@shopify/cli-kit/node/hrtime'
import {fileExistsSync, matchGlob, readFileSync} from '@shopify/cli-kit/node/fs'
import {debounce} from '@shopify/cli-kit/common/function'
import ignore from 'ignore'
import {Writable} from 'stream'

const EXTENSION_CREATION_TIMEOUT = 60000
/**
 * Event emitted by the file watcher
 *
 * Includes the type of the event, the path of the file that triggered the event and the extension path that contains the file.
 * path and extensionPath could be the same if the event is at the extension level (create, delete extension)
 *
 * @typeParam type - The type of the event
 * @typeParam path - The path of the file that triggered the event
 * @typeParam extensionPath - The path of the extension that contains the file
 * @typeParam startTime - The time when the event was triggered
 */
export interface WatcherEvent {
  type:
    | 'extension_folder_created'
    | 'extension_folder_deleted'
    | 'file_created'
    | 'file_updated'
    | 'file_deleted'
    | 'extensions_config_updated'
    | 'app_config_deleted'
  path: string
  extensionPath: string
  startTime: StartTime
}

export interface OutputContextOptions {
  stdout: Writable
  stderr: Writable
  signal: AbortSignal
}

/**
 * Watch for changes in the given app directory.
 *
 * It will watch for changes in the active config file and the extension directories.
 * When possible, changes will be interpreted to detect new/deleted extensions
 *
 * Changes to toml files will be reported as different events to other file changes.
 *
 * @param app - The app to watch
 * @param options - The output options
 * @param onChange - The callback to call when a change is detected
 */
export async function startFileWatcher(
  app: AppInterface,
  options: OutputContextOptions,
  onChange: (events: WatcherEvent[]) => void,
  debounceTime = 500,
) {
  const {default: chokidar} = await import('chokidar')

  const appConfigurationPath = app.configuration.path
  const extensionDirectories = [...(app.configuration.extension_directories ?? ['extensions'])].map((directory) => {
    return joinPath(app.directory, directory)
  })

  let currentEvents: WatcherEvent[] = []

  /**
   * Debounced function to emit the accumulated events.
   * This function will be called at most once every 500ms to avoid emitting too many events in a short period.
   */
  const debouncedEmit = debounce(emitEvents, debounceTime)

  /**
   * Emits the accumulated events and resets the current events list.
   * It also logs the number of events emitted and their paths for debugging purposes.
   */
  function emitEvents() {
    const events = currentEvents
    currentEvents = []
    const message = `🔉 ${events.length} EVENTS EMITTED in files: ${events.map((event) => event.path).join('\n')}`
    outputDebug(message, options.stdout)
    onChange(events)
  }

  // Each extension has its own ignore instance to avoid conflicts
  let ignored: {[key: string]: ignore.Ignore | undefined} = {}

  /**
   * Adds a new event to the current events list and schedules the debounced emit function.
   * If the event is already in the list, it will not be added again.
   *
   * @param event - The event to be added
   */
  function pushEvent(event: WatcherEvent) {
    const extension = app.realExtensions.find((ext) => ext.directory === event.extensionPath)
    const watchPaths = extension?.devSessionWatchPaths
    // If the affected extension defines custom watch paths, ignore the event if it's not in the list
    if (watchPaths) {
      const isAValidWatchedPath = watchPaths.some((pattern) => matchGlob(event.path, pattern))
      if (!isAValidWatchedPath) return
    }

    if (event.type === 'extension_folder_created') {
      ignored[event.path] = createIgnoreInstance(event.path)
    }

    // If the event is ignored by the custom gitignore patterns, don't push it
    if (event.extensionPath !== 'unknown' && ignored[event.extensionPath]) {
      const relative = relativePath(event.extensionPath, event.path)
      if (ignored[event.extensionPath]?.ignores(relative)) return
    }

    // If the event is already in the list, don't push it again
    if (currentEvents.some((extEvent) => extEvent.path === event.path && extEvent.type === event.type)) return
    currentEvents.push(event)
    debouncedEmit()
  }

  // Current active extension paths (not defined in the main app configuration file)
  // If a change happens outside of these paths, it will be ignored unless is for a new extension being created
  // When a new extension is created, the path is added to this list
  // When an extension is deleted, the path is removed from this list
  // For every change, the corresponding extensionPath will be also reported in the event
  let extensionPaths = app.realExtensions
    .map((ext) => normalizePath(ext.directory))
    .filter((dir) => dir !== app.directory)

  // Watch the extensions root directories and the app configuration file, nothing else.
  const watchPaths = [appConfigurationPath, ...extensionDirectories]

  // Read .gitignore files from extension directories and add the patterns to the ignored list
  ignored = createIgnoredInstances(extensionPaths)

  // Create watcher ignoring node_modules, git, test files, dist folders, vim swap files
  // PENDING: Use .gitgnore from app and extensions to ignore files.
  const watcher = chokidar.watch(watchPaths, {
    ignored: ['**/node_modules/**', '**/.git/**', '**/*.test.*', '**/dist/**', '**/*.swp', '**/generated/**'],
    persistent: true,
    ignoreInitial: true,
  })

  // Start chokidar watcher for 'all' events
  watcher.on('all', (event, path) => {
    const startTime = startHRTime()
    const isConfigAppPath = path === appConfigurationPath
    const extensionPath =
      extensionPaths.find((dir) => isSubpath(dir, path)) ?? (isConfigAppPath ? app.directory : 'unknown')
    const isExtensionToml = path.endsWith('.extension.toml')
    const isUnknownExtension = extensionPath === 'unknown'

    outputDebug(`🌀: ${event} ${path.replace(app.directory, '')}\n`)

    if (isUnknownExtension && !isExtensionToml && !isConfigAppPath) {
      // Ignore an event if it's not part of an existing extension
      // Except if it is a toml file (either app config or extension config)
      return
    }

    switch (event) {
      case 'change':
        if (isUnknownExtension) {
          // If the extension path is unknown, it means the extension was just created.
          // We need to wait for the lock file to disappear before triggering the event.
          return
        }
        if (isExtensionToml || isConfigAppPath) {
          pushEvent({type: 'extensions_config_updated', path, extensionPath, startTime})
        } else {
          pushEvent({type: 'file_updated', path, extensionPath, startTime})
        }
        break
      case 'add':
        // If it's a normal non-toml file, just report a file_created event.
        // If a toml file was added, a new extension(s) is being created.
        // We need to wait for the lock file to disappear before triggering the event.
        if (!isExtensionToml) {
          pushEvent({type: 'file_created', path, extensionPath, startTime})
          break
        }
        let totalWaitedTime = 0
        const realPath = dirname(path)
        const intervalId = setInterval(() => {
          if (fileExistsSync(joinPath(realPath, configurationFileNames.lockFile))) {
            outputDebug(`Waiting for extension to complete creation: ${path}\n`)
            totalWaitedTime += 500
          } else {
            clearInterval(intervalId)
            extensionPaths.push(realPath)
            pushEvent({type: 'extension_folder_created', path: realPath, extensionPath, startTime})
          }
          if (totalWaitedTime >= EXTENSION_CREATION_TIMEOUT) {
            clearInterval(intervalId)
            options.stderr.write(`Error loading new extension at path: ${path}.\n Please restart the process.`)
          }
        }, 200)
        break
      case 'unlink':
        // Ignore shoplock files
        if (path.endsWith(configurationFileNames.lockFile)) break

        if (isConfigAppPath) {
          pushEvent({type: 'app_config_deleted', path, extensionPath, startTime})
        } else if (isExtensionToml) {
          // When a toml is deleted, we can consider every extension in that folder was deleted.
          extensionPaths = extensionPaths.filter((extPath) => extPath !== extensionPath)
          pushEvent({type: 'extension_folder_deleted', path: extensionPath, extensionPath, startTime})
        } else {
          // This could be an extension delete event, Wait 500ms to see if the toml is deleted or not.
          setTimeout(() => {
            // If the extensionPath is not longer in the list, the extension was deleted while the timeout was running.
            if (!extensionPaths.includes(extensionPath)) return
            pushEvent({type: 'file_deleted', path, extensionPath, startTime})
          }, 500)
        }
        break
      // These events are ignored
      case 'addDir':
      case 'unlinkDir':
        break
    }
  })

  listenForAbortOnWatcher(watcher, options)
}

const listenForAbortOnWatcher = (watcher: FSWatcher, options: OutputContextOptions) => {
  options.signal.addEventListener('abort', () => {
    outputDebug(`Closing file watcher`, options.stdout)
    watcher
      .close()
      .then(() => outputDebug(`File watching closed`, options.stdout))
      .catch((error: Error) => outputDebug(`File watching failed to close: ${error.message}`, options.stderr))
  })
}

// Creates an ignore instance for each extension directory if a .gitignore file exists
// Returns a map of extension paths to ignore instances
function createIgnoredInstances(extensionDirectories: string[]): {[key: string]: ignore.Ignore | undefined} {
  const ignored: {[key: string]: ignore.Ignore | undefined} = {}
  for (const dir of extensionDirectories) {
    ignored[dir] = createIgnoreInstance(dir)
  }
  return ignored
}

// Returns an ignore instance for the given path if a .gitignore file exists, otherwise undefined
function createIgnoreInstance(path: string): ignore.Ignore | undefined {
  const gitIgnorePath = joinPath(path, '.gitignore')
  if (!fileExistsSync(gitIgnorePath)) return undefined
  const gitIgnoreContent = readFileSync(gitIgnorePath)
    .toString()
    .split('\n')
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern !== '' && !pattern.startsWith('#'))
  return ignore.default().add(gitIgnoreContent)
}
