import {renderConcurrent, renderTasks, renderVideo} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {moduleDirectory} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

export async function asyncTasks() {
  // renderConcurrent
  let backendPromiseResolve: () => void

  const backendPromise = new Promise<void>(function (resolve, _reject) {
    backendPromiseResolve = resolve
  })

  const backendProcess = {
    prefix: 'backend',
    action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
      stdout.write('first backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('second backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('third backend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))

      backendPromiseResolve()
    },
  }

  const frontendProcess = {
    prefix: 'frontend',
    action: async (stdout: Writable, _stderr: Writable, _signal: AbortSignal) => {
      await backendPromise

      stdout.write('first frontend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('second frontend message')
      await new Promise((resolve) => setTimeout(resolve, 1000))
      stdout.write('third frontend message')
    },
  }

  await renderConcurrent({
    processes: [backendProcess, frontendProcess],
  })

  // renderTasks
  const tasks = [
    {
      title: 'Installing dependencies',
      task: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      },
    },
    {
      title: 'Downloading assets',
      task: async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      },
    },
  ]

  await renderTasks(tasks)

  const thisFileDir = moduleDirectory(import.meta.url)
  const videoDir = thisFileDir.concat('/../../../../assets/video/kitchen-sink')

  await renderVideo({
    videoPath: videoDir.concat("/simple-spinner.gif"),
    duration: 15000,
    maxWidth: 25,
  })

  await renderVideo({
    videoPath: videoDir.concat("/out-bg.json"),
    audioPath: videoDir.concat("/audio.mp3"),
    captionsPath: videoDir.concat("/captions.srt"),
    duration: 30030,
    maxWidth: 120,
  })
}
