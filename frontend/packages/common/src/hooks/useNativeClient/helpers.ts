import { FrontEndHost, NativeMode, NativeAPI } from './types';

export const getPreference = async (key: string, defaultValue?: string) => {
  try {
    const result = localStorage.getItem(`preference/${key}`);
    const value = result ?? defaultValue;

    return value ? JSON.parse(value) : '';
  } catch {
    return '';
  }
};

export const setPreference = async (
  key: string,
  obj: NativeMode | FrontEndHost
) => {
  try {
    const value = JSON.stringify(obj);
    localStorage.setItem(`preference/${key}`, value);
  } catch (e) {
    console.error(e);
  }
};

export const removePreference = async (key: string) => {
  localStorage.removeItem(`preference/${key}`);
};

export const getNativeAPI = (): NativeAPI | null => {
  // Electron
  if (!!window.electronNativeAPI) return window.electronNativeAPI;

  return null;
};

export const frontEndHostUrl = ({ protocol, ip, port }: FrontEndHost) =>
  port === 0 ? `${protocol}://${ip}` : `${protocol}://${ip}:${port}`;

export const frontEndHostDiscoveryGraphql = (server: FrontEndHost) =>
  `${frontEndHostUrl({
    ...server,
    port: server.port + 1,
    protocol: 'http',
  })}/graphql`;

export const frontEndHostDisplay = ({ protocol, ip, port }: FrontEndHost) => {
  switch (protocol) {
    case 'https':
      return port === 443 || port === 0
        ? `https://${ip}`
        : `https://${ip}:${port}`;
    default:
      return port === 80 || port === 0
        ? `http://${ip}`
        : `http://${ip}:${port}`;
  }
};

export const matchUniqueServer = (a: FrontEndHost, b: FrontEndHost) =>
  // Allow port to run multiple instances on one machine (at least for dev)
  a.hardwareId === b.hardwareId && a.port === b.port;
