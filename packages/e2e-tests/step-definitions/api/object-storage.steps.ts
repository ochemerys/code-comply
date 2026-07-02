import { After, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import {
  ObjectStorageClient,
  createObjectStorageClientFromEnv,
} from '../../../../apps/api/src/lib/storage/storage-client.js'

let client: ObjectStorageClient | null = null

function requireClient(): ObjectStorageClient {
  if (!client) {
    throw new Error('Object storage client not initialized')
  }
  return client
}

After({ tags: '@storage' }, async () => {
  client = null
})

Given('object storage is configured for E2E', function () {
  if (process.env.STORAGE_INTEGRATION_TEST !== '1') {
    return 'skipped'
  }
  if (
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_ENDPOINT
  ) {
    return 'skipped'
  }
  client = createObjectStorageClientFromEnv()
})

Given('inspection storage buckets exist', async function () {
  if (!client) {
    return 'skipped'
  }
  await requireClient().ensureBucketsExist()
})

When(
  'I upload {string} to the photos bucket at key {string} with content type {string}',
  async function (body: string, key: string, contentType: string) {
    if (!client) {
      return 'skipped'
    }
    await requireClient().putObject('photos', key, body, contentType)
  },
)

When(
  'I upload {string} to the documents bucket at key {string} with content type {string}',
  async function (body: string, key: string, contentType: string) {
    if (!client) {
      return 'skipped'
    }
    await requireClient().putObject('documents', key, body, contentType)
  },
)

Then(
  'the photos object at key {string} should contain text {string}',
  async function (key: string, expected: string) {
    if (!client) {
      return 'skipped'
    }
    const bytes = await requireClient().getObjectBytes('photos', key)
    expect(new TextDecoder().decode(bytes)).toBe(expected)
  },
)

Then(
  'the documents object at key {string} should contain text {string}',
  async function (key: string, expected: string) {
    if (!client) {
      return 'skipped'
    }
    const bytes = await requireClient().getObjectBytes('documents', key)
    expect(new TextDecoder().decode(bytes)).toBe(expected)
  },
)

Then(
  'a signed GET URL for the photos object at key {string} should return status {int} and body {string}',
  async function (key: string, statusCode: number, expectedBody: string) {
    if (!client) {
      return 'skipped'
    }
    const url = await requireClient().getSignedGetUrl('photos', key, 120)
    const res = await fetch(url)
    expect(res.status).toBe(statusCode)
    expect(await res.text()).toBe(expectedBody)
  },
)

Then('I delete the photos object at key {string}', async function (key: string) {
  if (!client) {
    return 'skipped'
  }
  await requireClient().deleteObject('photos', key)
})

Then('I delete the documents object at key {string}', async function (key: string) {
  if (!client) {
    return 'skipped'
  }
  await requireClient().deleteObject('documents', key)
})
