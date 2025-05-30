import type { NextApiRequest, NextApiResponse } from 'next';

import { getSession } from '@/session/iron-session';
import { parseUserinfo } from '@/utils/helpers';
import { INVOTASTIC_HOST } from '@/utils/constants';
import { wristbandAuth } from '@/wristband-auth';
import { CallbackResultType, CallbackResult } from '@wristband/nextjs-auth';
import { Userinfo } from '@/types/wristband-types';
import { createCsrfToken, updateCsrfCookie } from '@/utils/csrf';

export default async function handleCallback(req: NextApiRequest, res: NextApiResponse) {
  try {
    /* WRISTBAND_TOUCHPOINT - AUTHENTICATION */
    // After the user authenticates, exchange the incoming authorization code for JWTs and also retrieve userinfo.
    const callbackResult: CallbackResult = await wristbandAuth.pageRouter.callback(req, res);
    const { callbackData, redirectUrl, type } = callbackResult;

    if (type === CallbackResultType.REDIRECT_REQUIRED) {
      return res.redirect(redirectUrl!);
    }

    // Save any necessary fields for the user's app session into a session cookie.
    const session = await getSession(req, res);
    session.isAuthenticated = true;
    session.accessToken = callbackData!.accessToken;
    // Convert the "expiresIn" seconds into an expiration date with the format of milliseconds from the epoch.
    session.expiresAt = Date.now() + callbackData!.expiresIn * 1000;
    session.refreshToken = callbackData!.refreshToken;
    session.user = parseUserinfo(callbackData!.userinfo as Userinfo);
    session.tenantDomainName = callbackData!.tenantDomainName;
    session.tenantCustomDomain = callbackData!.tenantCustomDomain || undefined;

    // Establish CSRF secret and cookie.
    const csrfToken = createCsrfToken();
    session.csrfToken = csrfToken;
    await updateCsrfCookie(csrfToken, res);

    // Save all fields into the session
    await session.save();

    // Send the user back to the Invotastic application.
    return res.redirect(callbackData!.returnUrl || `http://${INVOTASTIC_HOST}`);
  } catch (error: unknown) {
    console.error(error);
  }
}
