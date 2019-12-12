import { useState, useRef } from 'react'
import { request, Options as RequestOptions } from '@peajs/request'
import { useEffect } from 'react'
import { useStore } from 'stook'
import compose from 'koa-compose'
import isEqual from 'react-fast-compare'
import { fetcher } from './fetcher'
import {
  FetchResult,
  Refetch,
  Options,
  HooksResult,
  Deps,
  Params,
  FetcherItem,
  Update,
  UpdateResult,
  Ctx,
  Middleware,
  RestOptions,
} from './types'

/**
 * get final url for http
 * @param url
 * @param baseURL
 */
function getReqURL(url: string, baseURL: string) {
  const isAbsoluteURL = /http:\/\/|https:\/\//.test(url)

  if (isAbsoluteURL) return url
  const arr = url.split(/\s+/)

  // handle something like: 'POST: /todos'
  if (arr.length === 2) return `${arr[0]} ${baseURL + arr[1]}`

  return baseURL + arr[0]
}

function last<T>(arr: T[]): T {
  return arr[arr.length - 1]
}

function getDeps(options: Options): Deps {
  if (Array.isArray(options.deps)) return options.deps
  return []
}

function getMethod(url: string, options: Options = {}) {
  const arr = url.split(/\s+/)
  if (arr.length === 2) return arr[0]
  const { method = 'GET' } = options
  return method
}

function getFetcherName(url: string, options: Options = {}) {
  if (options.key) return options.key
  const method = getMethod(url, options)
  url = last(url.split(/\s+/))
  return `${method} ${url}`
}

export class Client {
  restOptions: RestOptions
  middleware: Middleware[] = []

  ctx: Ctx = {
    body: undefined,
    headers: {},
    valid: true,
  }

  constructor(config: RestOptions) {
    this.restOptions = config
  }

  applyMiddleware = (fn: Middleware) => {
    this.middleware.push(fn)
  }

  config = (opt: RestOptions) => {
    this.restOptions = { ...this.restOptions, ...opt }
  }

  fetch = async <T = any>(url: string, options: RequestOptions = {}): Promise<T> => {
    const action = async (ctx: Ctx) => {
      const { baseURL, headers } = this.restOptions
      const reqURL = getReqURL(url, baseURL)

      // merge global headers, interceptor headers,fetch headers
      options.headers = { ...headers, ...this.ctx.headers, ...options.headers } as any

      try {
        ctx.body = await request(reqURL, options)
      } catch (error) {
        ctx.body = error
        ctx.valid = false
        throw ctx.body
      }
    }

    await compose([...this.middleware, action])(this.ctx)

    if (!this.ctx.valid) throw this.ctx.body
    return this.ctx.body
  }

  useFetch = <T extends any>(url: string, options: Options<T> = {}) => {
    let unmounted = false
    const { initialData: data, onUpdate } = options
    const initialState = { loading: true, data } as FetchResult<T>
    const deps = getDeps(options)
    const fetcherName = getFetcherName(url, options)
    const [result, setState] = useStore(fetcherName, initialState)

    const update = (updatedState: Partial<FetchResult<T>>) => {
      const newState = { ...result, ...updatedState }
      setState(newState)
      onUpdate && onUpdate(newState)
    }

    const getParams = (options: Options): Params | null => {
      if (!options.params) return {}
      if (typeof options.params !== 'function') return options.params
      try {
        return options.params()
      } catch (error) {
        return null
      }
    }

    const paramsRef = useRef<Params | null>(getParams(options))

    if (!isEqual(paramsRef.current, getParams(options))) {
      paramsRef.current = getParams(options)
    }

    const doFetch = async (opt?: Options) => {
      try {
        const data: T = await this.fetch(url, opt || {})
        if (!unmounted) {
          update({ loading: false, data })
        }
        return data
      } catch (error) {
        if (!unmounted) {
          update({ loading: false, error })
        }
        throw error
      }
    }

    const refetch: Refetch = async <P = any>(opt?: Options): Promise<P> => {
      const refetchedData: any = await doFetch(opt)
      return refetchedData as P
    }

    useEffect(() => {
      if (paramsRef.current !== null) {
        doFetch({ ...options, params: paramsRef.current })
      }

      // store refetch fn to fetcher
      fetcher.set(fetcherName, { refetch } as FetcherItem<T>)

      return () => {
        unmounted = true
      }
    }, [...deps, paramsRef.current])

    return { ...result, refetch } as HooksResult<T>
  }

  useUpdate = <T = any>(url: string, options: RequestOptions = {}) => {
    const initialState = {} as UpdateResult<T>
    const [result, setState] = useState(initialState)

    const updateData = async (updateOptions: RequestOptions = {}) => {
      setState(prev => ({ ...prev, loading: true }))
      try {
        options.method = options.method || 'POST'
        const data: T = await this.fetch(url, { ...options, ...updateOptions })
        setState(prev => ({ ...prev, loading: false, data }))
      } catch (error) {
        setState(prev => ({ ...prev, loading: false, error }))
      }
    }

    const update = (updateOptions: RequestOptions = {}): any => {
      updateData(updateOptions)
    }

    const out: [Update, UpdateResult<T>] = [update, result]

    return out
  }
}