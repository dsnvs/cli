import {Box, Text, Static, useInput, useStdin} from '@shopify/cli-kit/node/ink'
import React, {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react'

import figures from '@shopify/cli-kit/node/figures'
import {FunctionRunData} from '../../../function/replay.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {setupExtensionWatcher} from '../../extension/bundler.js'
import {exec} from '@shopify/cli-kit/node/system'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../../../models/extensions/specifications/function.js'
import {AppInterface} from '../../../../models/app/app.js'
import {Writable} from 'stream'
import { prettyPrintJsonIfPossible } from '../../../app-logs/utils.js'

export interface ReplayProps {
  selectedRun: FunctionRunData
  abortController: AbortController
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
}

interface FunctionRun {
  type: 'functionRun'
  input: string
  output: string
  logs: string
}

interface SystemMessage {
  type: 'systemMessage'
  message: string
}

type ReplayLog = FunctionRun | SystemMessage

const Replay: FunctionComponent<ReplayProps> = ({selectedRun, abortController, app, extension}) => {
  const now = new Date()
  const season = now.getMonth() > 3 ? 'Summer' : 'Winter'
  const year = now.getFullYear()

  // const [functionRuns, setFunctionRuns] = useState<FunctionRun[]>([])
  // const [replayLogs, setReplayLogs] = useState<String[]>([])
  const [logs, setLogs] = useState<ReplayLog[]>([])

  const {input, export: runExport} = selectedRun.payload

  useEffect(() => {
    const startWatchingFunction = async () => {
      const customStdout = new Writable({
        write(chunk, _enconding, next) {
          setLogs((logs) => [...logs, {type: 'systemMessage', message: chunk.toString()}])
          next()
        },
      })

      ;(global as any).andrewStdout = customStdout

      await setupExtensionWatcher({
        extension,
        app,
        stdout: customStdout, // TODO
        stderr: customStdout, // TODO
        onChange: async () => {
          // console.log("in onChange")
          // setLogs((logs) => [...logs, {type: 'systemMessage', message: 'Changes detected, rebuilding and rerunning'}])
          const functionRun = await runFunctionRunnerWithLogInput(extension, JSON.stringify(input), runExport)
          // console.log("the functionRun in onChange")
          // console.log(JSON.parse(functionRun.output).JsonOutput)
          // console.log("the function run to be added")
          // console.log(functionRun)
          // console.log("function after output is swapped")
          // functionRun.output = JSON.parse(functionRun.output).JsonOutput
          // console.log("all the functionRuns")
          // console.log(functionRuns)
          setLogs((logs) => [...logs, functionRun])
        },
        onReloadAndBuildError: async (error) => {
          // TODO: handle error
        },
        signal: abortController.signal,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    startWatchingFunction()

    // TODO: return a way to clean up watcher
  }, [input, runExport, app, extension])

  return (
    <>
      {/* Scrolling upper section */}
      <Static items={logs}>
        {(log, index) => {
          return (
            <Box key={`randomBoxKey${index}`} flexDirection="column">
              <ReplayLog log={log} />
            </Box>
          )
        }}
      </Static>
      {/* Bottom Bar */}
      <Box
        marginY={1}
        paddingTop={1}
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderTop
      >
        {/* {canUseShortcuts ? ( */}
        <Box flexDirection="column">
          <Box flexDirection="row">
          <Text>
            {figures.pointerSmall}&nbsp;
          </Text>
          {(selectedRun.status === "success") ? (
            <Text color="white" backgroundColor="green">
              {selectedRun.status.toUpperCase()}
            </Text>
            ) : (
            <Text color="white" backgroundColor="red">
              {selectedRun.status.toUpperCase()}
            </Text>
            )}
          <Text>
            &nbsp;| Watching for changes to {selectedRun.source}...
          </Text>
          </Box>
          <Text>
            {figures.pointerSmall} Press <Text bold>d</Text> {figures.lineVertical} diff output with original
          </Text>
          <Text>
            {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
          </Text>
        </Box>
      </Box>
    </>
  )
}

function ReplayLog({log}: {log: ReplayLog}) {
  if (log.type === 'functionRun') {
    return (
      <Box flexDirection="column">
        <Text color="black" backgroundColor="yellow">Input</Text>
        <Text>{prettyPrintJsonIfPossible(log.input)}</Text>
        <Text color="black" backgroundColor="blue">Logs</Text>
        <Text>{log.logs}</Text>
        <Text color="black" backgroundColor="green">Output</Text>
        <Text>{prettyPrintJsonIfPossible(log.output)}</Text>
      </Box>
    )
  }

  if (log.type === 'systemMessage') {
    return <Text>{log.message}</Text>
  }

  return null
}

export {Replay}

interface ReplayOptions {
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
  apiKey?: string
  stdout?: boolean
  path: string
  json: boolean
  watch: boolean
  log?: string
}

async function runFunctionRunnerWithLogInput(
  fun: ExtensionInstance<FunctionConfigType>,
  input: string,
  exportName: string,
): Promise<FunctionRun> {
  let functionRunnerOutput = ''
  const customStdout = new Writable({
    write(chunk, _encoding, next) {
      functionRunnerOutput += chunk
      next()
    },
  })

  await exec('npm', ['exec', '--', 'function-runner', '--json', '-f', fun.outputPath, '--export', exportName], {
    cwd: fun.directory,
    input,
    stdout: customStdout,
    stderr: 'inherit',
  })

  const result = JSON.parse(functionRunnerOutput)
  return {...result, type: 'functionRun'}
}
