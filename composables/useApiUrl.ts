export const useApiUrl = () => {
  const config = useRuntimeConfig()
  const baseUrl = (config.public.apiBaseUrl || '').trim()

  return (path: string) => {
    if (/^https?:\/\//i.test(path)) {
      return path
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`

    if (!baseUrl) {
      return normalizedPath
    }

    return `${baseUrl.replace(/\/+$/, '')}${normalizedPath}`
  }
}
