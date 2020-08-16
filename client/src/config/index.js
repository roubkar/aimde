export let SERVER_HOST, SERVER_API_HOST, WS_HOST;

if (window.location.hostname === 'aim-dev.loc') {
  SERVER_HOST = 'http://aim-dev.loc:43801';
  SERVER_API_HOST = `${SERVER_HOST}/api/v1`;
  WS_HOST = 'ws://aim-dev.loc:43802/live';
} else {
  SERVER_HOST = `http://${window.location.hostname}:${window.location.port}`;
  SERVER_API_HOST = `${SERVER_HOST}/api/v1`;
  WS_HOST = `ws://${window.location.hostname}:${window.location.port}/live`;
}

export const USER_ANALYTICS_COOKIE_NAME = '__AIMDE__:USER_ANALYTICS_COOKIE_NAME';
export const USER_LAST_SEARCH_QUERY = '__AIMDE__:USER_LAST_SEARCH_QUERY';

export const SEGMENT_WRITE_KEY = 'Rj1I4AisLSvsvAnPW7OqkoYBUTXJRBHK';

export const AIM_QL_VERSION = 1;