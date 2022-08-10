import {git, error, path, output, api, http} from '@shopify/cli-kit'
// eslint-disable-next-line import/no-extraneous-dependencies
import {gql} from 'graphql-request'

interface DeployConfig {
  deploymentToken: string
  dmsAddress: string
  commitMessage?: string
  commitAuthor?: string
  commitSha?: string
  commitRef?: string
  timestamp?: string
  repository?: string
}
type ReqDeployConfig = Required<DeployConfig>

export async function deployToOxygen(_config: DeployConfig) {
  const config = await getGitData(_config)
  // eslint-disable-next-line no-console
  console.log('Deployment Config: ', config)

  const {deploymentID, assetBaseURL, error} = await createDeploymentStep(config)

  output.info(`Deployment ID: ${deploymentID}`)
  output.info(`Base Asset URL: ${assetBaseURL}`)
  output.info(`Error Message: ${error?.debugInfo}`)
  output.success('Deployment created!')
}

const getGitData = async (config: DeployConfig): Promise<ReqDeployConfig> => {
  git.ensurePresentOrAbort()
  git.ensureInsideGitDirectory()
  const simpleGit = git.factory()

  const getLatestCommit = async () => {
    try {
      const latestLog = await simpleGit.log({
        maxCount: 1,
      })
      if (!latestLog.latest) throw new error.Abort('Could not find latest commit')
      return latestLog.latest
    } catch {
      throw new error.Abort('Must have at least 1 commit to deploy')
    }
  }

  const getRepository = async () => {
    // git config --get remote.origin.url
    const remoteUrl = await simpleGit.getConfig('remote.origin.url', 'local')
    if (remoteUrl.value) {
      const urlObj = new URL(remoteUrl.value)
      const parsedPath = path.parse(urlObj.pathname)
      return `${parsedPath.dir}/${parsedPath.name}`
    }

    const projectPath = await simpleGit.revparse('--show-toplevel')
    return path.basename(projectPath)
  }

  const [latestCommit, repository] = await Promise.all([getLatestCommit(), getRepository()])
  const currentBranch = await simpleGit.revparse(['--abbrev-ref', 'HEAD'])

  // this is the current branch, not the commit ref so may need parse the latestCommit.ref
  return {
    deploymentToken: config.deploymentToken,
    dmsAddress: config.dmsAddress,
    commitMessage: config.commitMessage ?? latestCommit.message,
    commitAuthor: config.commitAuthor ?? latestCommit.author_name,
    commitSha: latestCommit.hash,
    commitRef: `refs/heads/${currentBranch}`,
    // commitRef: latestCommit.ref,
    timestamp: latestCommit.date,
    repository: repository.charAt(0) === '/' ? repository.substring(1) : repository,
  }
}

const createDeploymentStep = async (config: ReqDeployConfig): Promise<CreateDeploymentResponse> => {
  output.info('✨ Creating a deployment... ')

  const url = `https://${config.dmsAddress}/api/graphql/deploy/v1`
  const headers = await api.common.buildHeaders(config.deploymentToken)
  // need to create a seperate service for "dms" related calls instead of piggybacking on "shopify"
  const client = await http.graphqlClient({
    headers,
    service: 'shopify',
    url,
  })

  // need to make workflowID optional on DMS so we dont need to generate a random one
  const variables = {
    input: {
      repository: config.repository,
      branch: config.commitRef,
      commitHash: config.commitSha,
      commitAuthor: config.commitAuthor,
      commitMessage: config.commitMessage,
      commitTimestamp: config.timestamp,
      workflowID: `${Math.floor(Math.random() * 100000)}`,
    },
  }

  // need to handle errors
  const response: CreateDeploymentQuerySchema = await client.request(CreateDeploymentQuery, variables)
  return response.createDeployment
}

const CreateDeploymentQuery = gql`
  mutation createDeployment($input: CreateDeploymentInput!) {
    createDeployment(input: $input) {
      deploymentID
      assetBaseURL
      error {
        code
        unrecoverable
        debugInfo
      }
    }
  }
`

interface CreateDeploymentQuerySchema {
  createDeployment: CreateDeploymentResponse
}

interface CreateDeploymentResponse {
  deploymentID: string
  assetBaseURL: string
  error: CreateDeploymentError
}

interface CreateDeploymentError {
  code: string
  unrecoverable: boolean
  debugInfo: string
}
